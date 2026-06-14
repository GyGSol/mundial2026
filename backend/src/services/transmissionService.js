import { Match } from '../models/Match.js';
import { StreamLinkMapping } from '../models/StreamLinkMapping.js';
import { env } from '../config/env.js';
import {
  enrichMatchesLight,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { canWatchConfiguredStream } from './streamWatchEligibility.js';

export const TRANSMISSIONS_TIMEZONE = 'America/Argentina/Buenos_Aires';

export function formatDayKey(dateInput, timeZone = TRANSMISSIONS_TIMEZONE) {
  if (!dateInput) return null;
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function sortMatchesForDay(matches) {
  const order = { live: 0, upcoming: 1, finished: 2 };
  return [...matches].sort((a, b) => {
    const statusDiff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
  });
}

function attachStreamMeta(match, mappingById) {
  const mapping = mappingById.get(String(match.externalId));
  const configured = Boolean(mapping?.enabled && mapping?.embedUrl);
  return {
    configured,
    canWatch: canWatchConfiguredStream(match, {
      liveStreamEnabled: env.liveStreamEnabled,
      configured,
    }),
    la18EventId: mapping?.la18EventId || null,
    pageUrl: mapping?.la18PageUrl || null,
    updatedAt: mapping?.updatedAt || null,
  };
}

/**
 * Partidos cuyo kickoff cae en el día calendario (Argentina) indicado o hoy.
 */
export async function listTransmissionMatchesForDay(dayKey, userId) {
  const targetDay = dayKey || formatDayKey(new Date(), TRANSMISSIONS_TIMEZONE);
  const probe = new Date();
  const windowStart = new Date(probe.getTime() - 36 * 60 * 60 * 1000);
  const windowEnd = new Date(probe.getTime() + 36 * 60 * 60 * 1000);

  const candidates = await Match.find({
    kickoffAt: { $gte: windowStart, $lte: windowEnd },
  })
    .sort({ kickoffAt: 1 })
    .lean();

  const dayMatches = candidates.filter(
    (match) => formatDayKey(match.kickoffAt, TRANSMISSIONS_TIMEZONE) === targetDay
  );

  if (!dayMatches.length) {
    return {
      date: targetDay,
      timezone: TRANSMISSIONS_TIMEZONE,
      matches: [],
      total: 0,
      liveCount: 0,
      configuredCount: 0,
    };
  }

  const externalIds = dayMatches.map((m) => String(m.externalId));
  const mappings = await StreamLinkMapping.find({
    matchExternalId: { $in: externalIds },
    enabled: true,
  }).lean();

  const mappingById = new Map(mappings.map((row) => [String(row.matchExternalId), row]));

  await prepareFifaShirtMapsForMatches(dayMatches);
  const enriched = await enrichMatchesLight(dayMatches, userId);

  const matches = sortMatchesForDay(enriched).map((match) => ({
    ...match,
    stream: attachStreamMeta(match, mappingById),
  }));

  return {
    date: targetDay,
    timezone: TRANSMISSIONS_TIMEZONE,
    matches,
    total: matches.length,
    liveCount: matches.filter((m) => m.status === 'live').length,
    configuredCount: matches.filter((m) => m.stream?.configured).length,
  };
}

export async function listTodayTransmissions(userId) {
  return listTransmissionMatchesForDay(null, userId);
}
