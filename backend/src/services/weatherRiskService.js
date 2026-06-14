import { resolveStadiumCoordinates } from '../data/stadiumCoordinates.js';
import {
  noaaProtocolCopy,
  resolveStadiumWeatherProfile,
} from '../data/stadiumWeatherProfile.js';
import { NOAA_RESUME_WAIT_MS } from './matchWeatherOpsRules.js';

const NWS_CACHE_TTL_LIVE_MS = 3 * 60 * 1000;
const NWS_CACHE_TTL_DEFAULT_MS = 30 * 60 * 1000;
const nwsCache = new Map();

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

function nwsCacheKey(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function readNwsCache(key, ttlMs) {
  const entry = nwsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    nwsCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeNwsCache(key, value) {
  nwsCache.set(key, { at: Date.now(), value });
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
  const key = nwsCacheKey(latitude, longitude);
  const ttl = urgent ? NWS_CACHE_TTL_LIVE_MS : NWS_CACHE_TTL_DEFAULT_MS;
  const cached = readNwsCache(key, ttl);
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
    writeNwsCache(key, features);
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
  const protocol = noaaProtocolCopy(profile);

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
  let nwsResult = { contribution: 'low', alerts: [], primaryAlert: null };

  if (profile.lightningProtocolRegion === 'usa-noaa') {
    const nwsRaw = await fetchNwsAlertsForPoint(coordinates, { fetchImpl, urgent });
    const features = Array.isArray(nwsRaw) ? nwsRaw : nwsRaw?.features ?? [];
    nwsResult = assessNwsAlerts(features);
    if (nwsRaw?.error) {
      nwsResult.fetchError = nwsRaw.error;
    }
  }

  const riskLevel = mergeRiskLevels(openMeteo.contribution, nwsResult.contribution);
  const now = Date.now();
  const lastAlertAt = nwsResult.primaryAlert?.sent ?? null;
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

  return {
    available: true,
    riskLevel,
    withinWindow,
    profile,
    protocol,
    openMeteo: openMeteo.signals,
    nws: {
      alertCount: nwsResult.alerts.length,
      primaryAlert: nwsResult.primaryAlert,
      alerts: nwsResult.alerts.slice(0, 5),
      fetchError: nwsResult.fetchError ?? null,
    },
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
    nwsAlertId: nwsResult.primaryAlert?.id ?? null,
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
    nws: risk.nws ?? null,
    resumeEarliestAt: risk.resumeEarliestAt ?? null,
    lastAlertAt: risk.lastAlertAt ?? null,
    fetchedAt: risk.fetchedAt ?? null,
  };
}

export function shouldSuggestPreKickoffDelay(risk, match) {
  if (!risk?.available || risk.riskLevel !== 'stop') return false;
  if (match?.status !== 'upcoming') return false;
  const elapsed = match?.raw?.time_elapsed ?? match?.raw?.timeElapsed;
  const notStarted =
    !elapsed || elapsed === 'notstarted' || elapsed === '0' || String(elapsed).toLowerCase() === '0';
  return notStarted;
}
