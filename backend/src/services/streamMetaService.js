import { StreamLinkMapping } from '../models/StreamLinkMapping.js';
import { Team } from '../models/Team.js';
import { env } from '../config/env.js';
import {
  fetchLa18AgendaEvents,
  mergeStreamSources,
  rankLa18EventsForMatch,
} from './la18hdScraper.js';
import { resolveAutoLa18Mapping } from './la18ChannelResolver.js';
import { canWatchConfiguredStream } from './streamWatchEligibility.js';

function buildTeamMap(teams) {
  return Object.fromEntries(teams.map((team) => [team.externalId, team]));
}

function resolveStreamsForMatch(match, teamById, agendaEvents) {
  const homeTeam = teamById[match.homeTeamId] || null;
  const awayTeam = teamById[match.awayTeamId] || null;
  const homeTeamName = homeTeam?.nameEn || homeTeam?.name || '';
  const awayTeamName = awayTeam?.nameEn || awayTeam?.name || '';

  const ranked = rankLa18EventsForMatch(
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
 * Admin → agenda La18HD → canal auto por televisor (broadcastSchedule).
 */
export function resolveEffectiveStreamSources(
  match,
  explicitMapping,
  la18Streams,
  { homeTeam = null, awayTeam = null } = {}
) {
  const sources = mergeStreamSources(explicitMapping, la18Streams);
  if (sources.length) return sources;

  const auto = resolveAutoLa18Mapping(match.externalId, { homeTeam, awayTeam });
  if (!auto) return [];

  return mergeStreamSources(auto, []);
}

export function inferStreamSourceKind(explicitMapping, selectedSource) {
  if (explicitMapping?.enabled !== false && explicitMapping?.embedUrl) return 'admin';
  if (selectedSource?.source === 'auto') return 'auto';
  return 'la18hd';
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
    source: source || (sources.length ? 'la18hd' : null),
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
    agendaEvents = await fetchLa18AgendaEvents();
  } catch {
    agendaEvents = [];
  }

  return matches.map((match) => {
    const explicit = mappingById.get(String(match.externalId)) || null;
    const homeTeam = teamById[match.homeTeamId] || null;
    const awayTeam = teamById[match.awayTeamId] || null;
    const la18Streams = resolveStreamsForMatch(match, teamById, agendaEvents);
    const sources = resolveEffectiveStreamSources(match, explicit, la18Streams, {
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
