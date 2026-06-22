import { Match } from '../models/Match.js';
import {
  enrichMatchesForPredictionsList,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { sortMatchesBySchedule } from './matchSortService.js';
import {
  findLiveMatchesQueryWithGroup,
  findRecentlyFinishedMatchesQueryWithGroup,
} from './matchDisplayVisibilityService.js';
import {
  partitionLiveMatchesByActivity,
  buildFeaturedRecentFinishedRaw,
  sortLiveMatchesForFeaturedBar,
} from './liveMatchPartitionService.js';

const BAR_MATCH_PROJECTION =
  'externalId homeTeamId awayTeamId homeScore awayScore group matchday localDate stadiumId type status finishedAt kickoffAt kickoffTimezone liveStartedPushSentAt weatherOps raw.finished raw.time_elapsed raw.fifaEvents.timeline';

export async function listPredictionsMatches({ status, group }, userId) {
  const filter = {};
  if (status) filter.status = status;
  if (group) filter.group = group;

  const barGroup = group || undefined;

  const [matches, liveRaw, recentFinishedRaw] = await Promise.all([
    sortMatchesBySchedule(
      await Match.find(filter).select('-raw').lean()
    ),
    Match.find(findLiveMatchesQueryWithGroup(barGroup))
      .select(BAR_MATCH_PROJECTION)
      .sort({ kickoffAt: 1, externalId: 1 })
      .lean(),
    Match.find(findRecentlyFinishedMatchesQueryWithGroup(barGroup))
      .select(BAR_MATCH_PROJECTION)
      .sort({ finishedAt: -1, kickoffAt: -1 })
      .lean(),
  ]);

  const { activeLiveRaw, staleLiveRaw } = partitionLiveMatchesByActivity(liveRaw);
  const recentFeaturedRaw = buildFeaturedRecentFinishedRaw(recentFinishedRaw, staleLiveRaw);

  const barMatches = [...activeLiveRaw, ...recentFeaturedRaw];
  const liveBarMatchIds = new Set(barMatches.map((m) => m._id.toString()));
  const uniqueByMongoId = new Map();
  for (const match of [...matches, ...barMatches]) {
    uniqueByMongoId.set(match._id.toString(), match);
  }
  const uniqueMatches = [...uniqueByMongoId.values()];

  await prepareFifaShirtMapsForMatches(barMatches);
  const enrichedAll = await enrichMatchesForPredictionsList(uniqueMatches, userId, {
    liveBarMatchIds,
  });
  const enrichedById = new Map(enrichedAll.map((m) => [m.id, m]));

  const enriched = matches
    .map((m) => enrichedById.get(m._id.toString()))
    .filter(Boolean);
  const liveMatches = sortLiveMatchesForFeaturedBar(
    activeLiveRaw.map((m) => enrichedById.get(m._id.toString())).filter(Boolean)
  );
  const recentFinishedMatches = recentFeaturedRaw
    .map((m) => enrichedById.get(m._id.toString()))
    .filter(Boolean);

  return {
    matches: enriched,
    total: enriched.length,
    liveMatches,
    recentFinishedMatches,
  };
}
