import { StreamLinkMapping } from '../models/StreamLinkMapping.js';
import { Team } from '../models/Team.js';
import { env } from '../config/env.js';
import {
  fetchFptAgendaEvents,
  mergeStreamSources,
} from './fptScraper.js';
import { resolveAutoFptMapping } from './fptChannelResolver.js';
import { rankEventsForMatch } from './streamTeamMatching.js';
import { canWatchConfiguredStream } from './streamWatchEligibility.js';

function buildTeamMap(teams) {
  return Object.fromEntries(teams.map((team) => [team.externalId, team]));
}

function resolveStreamsForMatch(match, teamById, agendaEvents) {
  const homeTeam = teamById[match.homeTeamId] || null;
  const awayTeam = teamById[match.awayTeamId] || null;
  const homeTeamName = homeTeam?.nameEn || homeTeam?.name || '';
  const awayTeamName = awayTeam?.nameEn || awayTeam?.name || '';

  const ranked = rankEventsForMatch(
    match,
    agendaEvents,
    homeTeamName,
    awayTeamName,
    homeTeam,
    awayTeam
  );

  return ranked[0]?.streams ?? [];
}

/**
 * Admin → agenda FPT → canal auto por televisor (broadcastSchedule).
 */
export function resolveEffectiveStreamSources(
  match,
  explicitMapping,
  fptStreams,
  { homeTeam = null, awayTeam = null } = {}
) {
  const sources = mergeStreamSources(explicitMapping, fptStreams);
  if (sources.length) return sources;

  const auto = resolveAutoFptMapping(match.externalId, { homeTeam, awayTeam });
  if (!auto) return [];

  return mergeStreamSources(auto, []);
}

export function inferStreamSourceKind(explicitMapping, selectedSource) {
  if (explicitMapping?.enabled !== false && explicitMapping?.embedUrl) return 'admin';
  if (selectedSource?.source === 'auto') return 'auto';
  return 'fpt';
}

export function buildStreamMeta(match, sources, source) {
  const configured = sources.length > 0;
  return {
    configured,
    canWatch: canWatchConfiguredStream(match, {
      liveStreamEnabled: env.liveStreamEnabled,
      configured,
    }),
    streamCount: sources.length,
    la18EventId: sources[0]?.eventId || sources[0]?.id || null,
    pageUrl: sources[0]?.url || null,
    source: source || (sources.length ? 'fpt' : null),
    updatedAt: null,
  };
}

/**
 * @param {import('../models/Match.js').Match[]} matches
 */
export async function attachStreamMetaToMatches(matches) {
  if (!matches?.length) {
    return [];
  }

  const externalIds = matches.map((match) => String(match.externalId));
  const dbMappings = await StreamLinkMapping.find({
    matchExternalId: { $in: externalIds },
    enabled: true,
  }).lean();
  const mappingById = new Map(dbMappings.map((row) => [String(row.matchExternalId), row]));

  const teamIds = new Set();
  for (const match of matches) {
    if (match.homeTeamId) teamIds.add(match.homeTeamId);
    if (match.awayTeamId) teamIds.add(match.awayTeamId);
  }

  const teams = teamIds.size
    ? await Team.find({ externalId: { $in: [...teamIds] } }).lean()
    : [];
  const teamById = buildTeamMap(teams);

  let agendaEvents = [];
  try {
    agendaEvents = await fetchFptAgendaEvents();
  } catch {
    agendaEvents = [];
  }

  return matches.map((match) => {
    const explicit = mappingById.get(String(match.externalId)) || null;
    const homeTeam = teamById[match.homeTeamId] || null;
    const awayTeam = teamById[match.awayTeamId] || null;
    const fptStreams = resolveStreamsForMatch(match, teamById, agendaEvents);
    const sources = resolveEffectiveStreamSources(match, explicit, fptStreams, {
      homeTeam,
      awayTeam,
    });
    const source = sources.length
      ? inferStreamSourceKind(explicit, sources[0])
      : null;

    return {
      ...match,
      stream: buildStreamMeta(match, sources, source),
    };
  });
}
