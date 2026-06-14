import { getVenueWeatherForStadium } from './weatherService.js';
import {
  assessVenueWeatherRisk,
  formatWeatherRiskForClient,
  shouldSuggestPreKickoffDelay,
} from './weatherRiskService.js';
import {
  buildLiveScheduleContext,
  buildSimultaneousGroupPairs,
} from './liveScheduleOverlapService.js';
import {
  computeResumeEarliestAt,
  normalizeWeatherOps,
  serializeWeatherOpsForClient,
} from './matchWeatherOpsRules.js';

const WEATHER_ENRICH_WINDOW_MS = 2 * 60 * 60 * 1000;

function needsWeatherEnrichment(match) {
  const phase = normalizeWeatherOps(match.weatherOps).phase;
  if (phase !== 'normal') return true;
  if (match.status === 'live') return true;
  if (match.status !== 'upcoming' || !match.kickoffAt) return false;
  const kickoffMs = new Date(match.kickoffAt).getTime();
  if (Number.isNaN(kickoffMs)) return false;
  return Math.abs(kickoffMs - Date.now()) <= WEATHER_ENRICH_WINDOW_MS;
}

export async function enrichMatchWeatherFields(match, stadium, { fetchImpl = fetch, urgent = false } = {}) {
  if (!needsWeatherEnrichment(match) || !stadium) {
    return {
      weatherRisk: null,
      weatherOps: serializeWeatherOpsForClient(match.weatherOps),
    };
  }

  const weather = await getVenueWeatherForStadium(stadium, {
    kickoffAt: match.kickoffAt,
    fetchImpl,
  });
  const risk = await assessVenueWeatherRisk(stadium, {
    weather,
    kickoffAt: match.kickoffAt,
    urgent: urgent || match.status === 'live',
    fetchImpl,
  });

  return {
    weatherRisk: formatWeatherRiskForClient(risk),
    weatherOps: serializeWeatherOpsForClient(match.weatherOps),
    weatherRiskSuggestion: shouldSuggestPreKickoffDelay(risk, match)
      ? 'pre_kickoff_delay_recommended'
      : null,
  };
}

export async function attachWeatherAndScheduleToEnrichedMatches(
  rawMatches,
  enrichedMatches,
  stadiumMap,
  { fetchImpl = fetch } = {}
) {
  if (!enrichedMatches.length) return enrichedMatches;

  const pairMap = buildSimultaneousGroupPairs(rawMatches);
  const overlapById = new Map(
    rawMatches.map((m) => [m._id.toString(), buildLiveScheduleContext(m, rawMatches)])
  );

  const weatherById = new Map();
  await Promise.all(
    rawMatches.map(async (m) => {
      const stadium = stadiumMap[m.stadiumId];
      if (!stadium) return;
      const fields = await enrichMatchWeatherFields(m, stadium, {
        fetchImpl,
        urgent: m.status === 'live',
      });
      weatherById.set(m._id.toString(), fields);
    })
  );

  return enrichedMatches.map((enriched) => {
    const id = enriched.id;
    const weatherFields = weatherById.get(id) ?? {
      weatherRisk: null,
      weatherOps: serializeWeatherOpsForClient(null),
    };
    const liveScheduleContext = overlapById.get(id) ?? null;
    const pair = pairMap.get(id);

    return {
      ...enriched,
      ...weatherFields,
      liveScheduleContext,
      overlapGroupKey: pair?.overlapGroupKey ?? enriched.overlapGroupKey ?? null,
    };
  });
}

export function applyNwsWeatherOpsSuggestion(match, risk) {
  if (!shouldSuggestPreKickoffDelay(risk, match)) return null;

  const ops = normalizeWeatherOps(match.weatherOps);
  if (ops.phase !== 'normal') return null;

  const lastAlertAt = risk.lastAlertAt ? new Date(risk.lastAlertAt) : new Date();
  return {
    phase: 'pre_kickoff_delay',
    reason: 'lightning',
    protocol: 'noaa-8mi-30min',
    since: new Date(),
    resumeEarliestAt: computeResumeEarliestAt(lastAlertAt),
    originalKickoffAt: ops.originalKickoffAt ?? match.kickoffAt ?? null,
    delayedKickoffAt: null,
    lastAlertAt,
    nwsAlertId: risk.nwsAlertId ?? null,
    source: 'nws',
    overlapGroupKey: ops.overlapGroupKey ?? null,
  };
}
