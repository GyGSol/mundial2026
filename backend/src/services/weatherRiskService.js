import { resolveStadiumCoordinates } from '../data/stadiumCoordinates.js';
import {
  resolveLightningProtocolCopy,
  resolveStadiumWeatherProfile,
} from '../data/stadiumWeatherProfile.js';
import {
  isWeatherSuspensionExpired,
  normalizeWeatherOps,
  NOAA_RESUME_WAIT_MS,
} from './matchWeatherOpsRules.js';
import { matchEvidenceShowsInProgress, maxEffectivePlayMinute } from './matchStatusRules.js';
import { parseElapsedClockToSortKey } from './matchLiveData.js';
import { localizeAuthorityAlertsBlock } from '../../../shared/weatherAlertI18n.js';

const AUTHORITY_ALERTS_CACHE_TTL_LIVE_MS = 3 * 60 * 1000;
const AUTHORITY_ALERTS_CACHE_TTL_DEFAULT_MS = 30 * 60 * 1000;
const authorityAlertsCache = new Map();

const STOP_EVENT_TYPES = new Set([
  'Tornado Warning',
  'Severe Thunderstorm Warning',
  'Severe Thunderstorm Watch',
  'Tornado Watch',
  'Flash Flood Warning',
]);

const ELEVATED_EVENT_TYPES = new Set([
  'Special Weather Statement',
  'Severe Weather Statement',
  'Flood Advisory',
  'Wind Advisory',
]);

const STORM_WMO_CODES = new Set([95, 96, 99]);

function authorityAlertsCacheKey(source, lat, lon) {
  return `${source}:${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function readAuthorityAlertsCache(key, ttlMs) {
  const entry = authorityAlertsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    authorityAlertsCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeAuthorityAlertsCache(key, value) {
  authorityAlertsCache.set(key, { at: Date.now(), value });
}

export function assessOpenMeteoRisk(weather) {
  if (!weather?.available) {
    return { contribution: 'none', signals: [] };
  }

  const signals = [];
  let score = 0;

  const snapshots = [weather.current, weather.kickoffForecast].filter(Boolean);
  for (const snap of snapshots) {
    const code = Number(snap.weatherCode);
    if (STORM_WMO_CODES.has(code)) {
      signals.push({ type: 'wmo_storm', code, description: snap.description });
      score = Math.max(score, 3);
    }
    const precip = Number(snap.precipitationPct);
    if (Number.isFinite(precip) && precip >= 70) {
      signals.push({ type: 'high_precip_prob', value: precip });
      score = Math.max(score, 2);
    }
    const gusts = Number(snap.windGustKmh);
    if (Number.isFinite(gusts) && gusts >= 60) {
      signals.push({ type: 'high_wind_gust', value: gusts });
      score = Math.max(score, 2);
    }
    const precipMm = Number(snap.precipitationMm);
    if (Number.isFinite(precipMm) && precipMm >= 5) {
      signals.push({ type: 'heavy_precip_mm', value: precipMm });
      score = Math.max(score, 2);
    }
  }

  const level = score >= 3 ? 'stop' : score >= 2 ? 'high' : score >= 1 ? 'elevated' : 'low';
  return { contribution: level, signals, score };
}

export function assessNwsAlerts(alerts = []) {
  if (!alerts.length) {
    return { contribution: 'low', alerts: [], primaryAlert: null };
  }

  const parsed = alerts.map((a) => ({
    id: a.id ?? a.properties?.id ?? null,
    event: a.properties?.event ?? a.event ?? 'Alerta',
    headline: a.properties?.headline ?? a.headline ?? null,
    severity: a.properties?.severity ?? a.severity ?? null,
    urgency: a.properties?.urgency ?? a.urgency ?? null,
    sent: a.properties?.sent ?? a.sent ?? null,
    expires: a.properties?.expires ?? a.expires ?? null,
  }));

  const hasStop = parsed.some((a) => STOP_EVENT_TYPES.has(a.event));
  const hasElevated = parsed.some((a) => ELEVATED_EVENT_TYPES.has(a.event));

  const contribution = hasStop ? 'stop' : hasElevated ? 'elevated' : 'low';
  const primaryAlert = parsed.find((a) => STOP_EVENT_TYPES.has(a.event)) ?? parsed[0] ?? null;

  return { contribution, alerts: parsed, primaryAlert };
}

const MSC_STOP_NAME_RE =
  /thunderstorm|tornado|lightning|severe|hail|rainfall warning|wind warning|winter storm warning/i;

export function assessMscAlerts(alerts = []) {
  if (!alerts.length) {
    return { contribution: 'low', alerts: [], primaryAlert: null };
  }

  const parsed = alerts.map((a) => ({
    id: a.id ?? a.properties?.id ?? null,
    event: a.properties?.alert_name_en ?? a.properties?.alert_short_name_en ?? 'Alerta',
    alertType: a.properties?.alert_type ?? null,
    headline: a.properties?.alert_short_name_en ?? null,
    severity: a.properties?.risk_colour_en ?? null,
    sent: a.properties?.publication_datetime ?? null,
    expires: a.properties?.expiration_datetime ?? null,
  }));

  const isStormRelated = (alert) => MSC_STOP_NAME_RE.test(String(alert.event ?? ''));
  const hasStop = parsed.some((a) => a.alertType === 'warning' && isStormRelated(a));
  const hasElevated = parsed.some(
    (a) => (a.alertType === 'watch' || a.alertType === 'advisory') && isStormRelated(a)
  );

  const contribution = hasStop ? 'stop' : hasElevated ? 'elevated' : 'low';
  const primaryAlert =
    parsed.find((a) => a.alertType === 'warning' && isStormRelated(a)) ?? parsed[0] ?? null;

  return { contribution, alerts: parsed, primaryAlert };
}

function formatAuthorityAlertsBlock(result) {
  return {
    alertCount: result.alerts.length,
    primaryAlert: result.primaryAlert,
    alerts: result.alerts.slice(0, 5),
    fetchError: result.fetchError ?? null,
  };
}

export function mergeRiskLevels(...levels) {
  const order = { low: 0, elevated: 1, high: 2, stop: 3 };
  let best = 'low';
  for (const level of levels) {
    if ((order[level] ?? 0) > (order[best] ?? 0)) best = level;
  }
  return best;
}

export async function fetchNwsAlertsForPoint(
  { latitude, longitude },
  { fetchImpl = fetch, urgent = false } = {}
) {
  const key = authorityAlertsCacheKey('nws', latitude, longitude);
  const ttl = urgent ? AUTHORITY_ALERTS_CACHE_TTL_LIVE_MS : AUTHORITY_ALERTS_CACHE_TTL_DEFAULT_MS;
  const cached = readAuthorityAlertsCache(key, ttl);
  if (cached) return cached;

  const url = `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`;
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': 'mundial2026-pred/1.0 (weather-risk)',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`NWS respondió ${response.status}`);
    }
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    writeAuthorityAlertsCache(key, features);
    return features;
  } catch (err) {
    return { error: err.message, features: [] };
  }
}

export async function fetchMscAlertsForPoint(
  { latitude, longitude },
  { fetchImpl = fetch, urgent = false } = {}
) {
  const key = authorityAlertsCacheKey('msc', latitude, longitude);
  const ttl = urgent ? AUTHORITY_ALERTS_CACHE_TTL_LIVE_MS : AUTHORITY_ALERTS_CACHE_TTL_DEFAULT_MS;
  const cached = readAuthorityAlertsCache(key, ttl);
  if (cached) return cached;

  const pad = 0.12;
  const bbox = `${longitude - pad},${latitude - pad},${longitude + pad},${latitude + pad}`;
  const url = `https://api.weather.gc.ca/collections/weather-alerts/items?bbox=${bbox}&f=json&limit=20`;
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': 'mundial2026-pred/1.0 (weather-risk)',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`MSC respondió ${response.status}`);
    }
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    writeAuthorityAlertsCache(key, features);
    return features;
  } catch (err) {
    return { error: err.message, features: [] };
  }
}

export async function assessVenueWeatherRisk(
  stadium,
  { weather = null, kickoffAt = null, urgent = false, fetchImpl = fetch } = {}
) {
  const coordinates = resolveStadiumCoordinates(stadium);
  const profile = resolveStadiumWeatherProfile(stadium);
  const protocol = resolveLightningProtocolCopy(profile);

  if (!coordinates) {
    return {
      available: false,
      reason: 'coordinates_unavailable',
      riskLevel: 'low',
      profile,
      protocol,
    };
  }

  const openMeteo = assessOpenMeteoRisk(weather);
  let authorityResult = { contribution: 'low', alerts: [], primaryAlert: null, source: null };

  if (profile.lightningProtocolRegion === 'usa-noaa') {
    const nwsRaw = await fetchNwsAlertsForPoint(coordinates, { fetchImpl, urgent });
    const features = Array.isArray(nwsRaw) ? nwsRaw : nwsRaw?.features ?? [];
    authorityResult = { ...assessNwsAlerts(features), source: 'nws' };
    if (nwsRaw?.error) {
      authorityResult.fetchError = nwsRaw.error;
    }
  } else if (profile.lightningProtocolRegion === 'canada') {
    const mscRaw = await fetchMscAlertsForPoint(coordinates, { fetchImpl, urgent });
    const features = Array.isArray(mscRaw) ? mscRaw : mscRaw?.features ?? [];
    authorityResult = { ...assessMscAlerts(features), source: 'msc' };
    if (mscRaw?.error) {
      authorityResult.fetchError = mscRaw.error;
    }
  }

  const riskLevel = mergeRiskLevels(openMeteo.contribution, authorityResult.contribution);
  const now = Date.now();
  const lastAlertAt = authorityResult.primaryAlert?.sent ?? null;
  const authorityAlertId = authorityResult.primaryAlert?.id ?? null;
  const authorityAlertSource =
    authorityResult.contribution !== 'low'
      ? authorityResult.source
      : openMeteo.contribution === 'stop'
        ? 'open-meteo'
        : null;
  const resumeEarliestAt =
    riskLevel === 'stop' && lastAlertAt
      ? new Date(new Date(lastAlertAt).getTime() + NOAA_RESUME_WAIT_MS)
      : riskLevel === 'stop'
        ? new Date(now + NOAA_RESUME_WAIT_MS)
        : null;

  const kickoffMs = kickoffAt ? new Date(kickoffAt).getTime() : NaN;
  const withinWindow =
    urgent ||
    (Number.isFinite(kickoffMs) && Math.abs(kickoffMs - now) <= 2 * 60 * 60 * 1000);

  const emptyAlerts = {
    alertCount: 0,
    primaryAlert: null,
    alerts: [],
    fetchError: null,
  };

  return {
    available: true,
    riskLevel,
    withinWindow,
    profile,
    protocol,
    openMeteo: openMeteo.signals,
    authorityAlertSource,
    nws:
      authorityResult.source === 'nws'
        ? formatAuthorityAlertsBlock(authorityResult)
        : emptyAlerts,
    msc:
      authorityResult.source === 'msc'
        ? formatAuthorityAlertsBlock(authorityResult)
        : emptyAlerts,
    recommendation:
      riskLevel === 'stop'
        ? 'high_delay_likely'
        : riskLevel === 'high'
          ? 'monitor_closely'
          : riskLevel === 'elevated'
            ? 'possible_delay'
            : 'normal',
    resumeEarliestAt: resumeEarliestAt?.toISOString?.() ?? null,
    lastAlertAt: lastAlertAt ?? null,
    authorityAlertId,
    nwsAlertId: authorityAlertId,
    fetchedAt: new Date().toISOString(),
  };
}

export function formatWeatherRiskForClient(risk) {
  if (!risk) return null;
  return {
    available: Boolean(risk.available),
    reason: risk.reason ?? null,
    riskLevel: risk.riskLevel ?? 'low',
    recommendation: risk.recommendation ?? null,
    profile: risk.profile ?? null,
    protocol: risk.protocol ?? null,
    openMeteo: risk.openMeteo ?? [],
    authorityAlertSource: risk.authorityAlertSource ?? null,
    nws: localizeAuthorityAlertsBlock(risk.nws),
    msc: localizeAuthorityAlertsBlock(risk.msc),
    resumeEarliestAt: risk.resumeEarliestAt ?? null,
    lastAlertAt: risk.lastAlertAt ?? null,
    fetchedAt: risk.fetchedAt ?? null,
  };
}

export function matchEvidentlyStartedOnField(match) {
  const elapsed = match?.raw?.time_elapsed ?? match?.raw?.timeElapsed;
  const normalized = String(elapsed ?? '').toLowerCase();
  if (!normalized || normalized === 'notstarted' || normalized === '0') return false;
  return true;
}

export function shouldSuggestPreKickoffDelay(risk, match) {
  if (!risk?.available || risk.riskLevel !== 'stop') return false;
  if (match?.status !== 'upcoming') return false;
  return !matchEvidentlyStartedOnField(match);
}

function isOpenMeteoOnlyWeatherAuthority(risk) {
  return risk?.authorityAlertSource === 'open-meteo';
}

/** Open-Meteo solo no suspende en canchas con techo retráctil; hace falta alerta NWS/MSC. */
export function shouldAllowOpenMeteoInPlaySuspension(risk, stadium = {}) {
  void risk;
  const profile = resolveStadiumWeatherProfile(stadium);
  return !profile.hasRetractableRoof;
}

function playMinuteForWeatherOps(match) {
  const fromEvidence = maxEffectivePlayMinute(match);
  if (fromEvidence != null) return fromEvidence;

  const token = match?.raw?.time_elapsed ?? match?.raw?.timeElapsed;
  if (!token) return null;
  const key = parseElapsedClockToSortKey(String(token));
  return key > Number.NEGATIVE_INFINITY ? key : null;
}

/** Escenario B — partido ya `live` con riesgo `stop` (rayos / tormenta severa). */
export function shouldSuggestInPlaySuspension(risk, match, stadium = {}) {
  if (!risk?.available || risk.riskLevel !== 'stop') return false;
  if (match?.status !== 'live') return false;
  if (!matchEvidentlyStartedOnField(match)) return false;

  const phase = normalizeWeatherOps(match.weatherOps).phase;
  if (phase === 'suspended' || phase === 'pre_kickoff_delay' || phase === 'postponed') {
    return false;
  }

  // Open-Meteo es pronóstico, no autoridad en tiempo real: no suspende partidos en curso.
  if (isOpenMeteoOnlyWeatherAuthority(risk)) return false;

  return true;
}

/** Renueva lastAlertAt / resumeEarliestAt mientras sigue el riesgo `stop`. */
export function shouldRefreshInPlaySuspension(risk, match, stadium = {}) {
  if (!risk?.available || risk.riskLevel !== 'stop') return false;
  if (match?.status !== 'live') return false;
  const ops = normalizeWeatherOps(match.weatherOps);
  if (ops.phase !== 'suspended' || ops.source === 'admin') return false;
  if (ops.source === 'open-meteo' && !shouldAllowOpenMeteoInPlaySuspension(risk, stadium)) {
    return false;
  }
  if (shouldClearContradictedInPlaySuspension(match, risk, stadium)) return false;
  return true;
}

/**
 * Limpia suspensión automática de Open-Meteo cuando el partido sigue en juego
 * (timeline/minuto, con o sin goles) o el estadio tiene techo retráctil.
 */
export function shouldClearContradictedInPlaySuspension(match, risk, stadium = {}) {
  const ops = normalizeWeatherOps(match.weatherOps);
  if (match?.status !== 'live' || ops.phase !== 'suspended') return false;
  if (ops.source === 'admin' || ops.source === 'nws' || ops.source === 'msc') return false;

  const openMeteoSuspension =
    ops.source === 'open-meteo' || isOpenMeteoOnlyWeatherAuthority(risk);
  if (!openMeteoSuspension) return false;

  const profile = resolveStadiumWeatherProfile(stadium);
  if (profile.hasRetractableRoof) return true;

  const playMinute = playMinuteForWeatherOps(match);
  const totalGoals = (Number(match.homeScore) || 0) + (Number(match.awayScore) || 0);

  if (playMinute != null && playMinute >= 10 && totalGoals > 0) return true;
  if (playMinute != null && playMinute >= 5 && totalGoals > 0) return true;

  if (matchEvidenceShowsInProgress(match)) {
    const evidenceMinute = maxEffectivePlayMinute(match) ?? playMinute;
    if (evidenceMinute != null && evidenceMinute >= 10) return true;
  }

  return false;
}

/** Limpia suspensión automática cuando el riesgo baja y venció la ventana NOAA. */
export function shouldClearInPlaySuspension(risk, match, now = Date.now()) {
  const ops = normalizeWeatherOps(match.weatherOps);
  if (match?.status !== 'live' || ops.phase !== 'suspended') return false;
  if (ops.source === 'admin') return false;
  if (risk?.riskLevel === 'stop') return false;
  return isWeatherSuspensionExpired(ops, now);
}
