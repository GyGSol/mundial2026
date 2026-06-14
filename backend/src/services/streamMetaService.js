import { StreamLinkMapping } from '../models/StreamLinkMapping.js';
import { Team } from '../models/Team.js';
import { env } from '../config/env.js';
import { resolveAutoLa18Mapping } from './la18ChannelResolver.js';
import { canWatchConfiguredStream } from './streamWatchEligibility.js';

function buildTeamMap(teams) {
  return Object.fromEntries(teams.map((team) => [team.externalId, team]));
}

export async function resolveEffectiveLa18Mapping(match, explicitMapping = null) {
  if (explicitMapping?.enabled !== false && explicitMapping?.embedUrl) {
    return { mapping: explicitMapping, source: 'admin' };
  }

  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);

  const auto = resolveAutoLa18Mapping(match.externalId, { homeTeam, awayTeam });
  if (!auto) {
    return { mapping: null, source: null };
  }

  return { mapping: auto, source: 'auto' };
}

export function buildStreamMeta(match, mapping, source) {
  const configured = Boolean(mapping?.embedUrl || mapping?.la18PageUrl);
  return {
    configured,
    canWatch: canWatchConfiguredStream(match, {
      liveStreamEnabled: env.liveStreamEnabled,
      configured,
    }),
    la18EventId: mapping?.la18EventId || null,
    pageUrl: mapping?.la18PageUrl || null,
    source: source || null,
    updatedAt: mapping?.updatedAt || null,
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

  return matches.map((match) => {
    const explicit = mappingById.get(String(match.externalId)) || null;
    let mapping = explicit;
    let source = explicit ? 'admin' : null;

    if (!mapping) {
      const auto = resolveAutoLa18Mapping(match.externalId, {
        homeTeam: teamById[match.homeTeamId],
        awayTeam: teamById[match.awayTeamId],
      });
      if (auto) {
        mapping = auto;
        source = 'auto';
      }
    }

    return {
      ...match,
      stream: buildStreamMeta(match, mapping, source),
    };
  });
}
