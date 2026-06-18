import { Match } from '../models/Match.js';
import {
  enrichMatchesForPredictions,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { sortMatchesBySchedule } from './matchSortService.js';
import {
  findLiveMatchesQueryWithGroup,
  findRecentlyFinishedMatchesQueryWithGroup,
  pickFeaturedRecentFinishedMatches,
} from './matchDisplayVisibilityService.js';

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

  const barMatches = [...liveRaw, ...recentFinishedRaw];
  await prepareFifaShirtMapsForMatches([...matches, ...barMatches]);
  const enriched = await enrichMatchesForPredictions(matches, userId);
  const enrichedBar = await enrichMatchesForPredictions(barMatches, userId);
  const barById = new Map(enrichedBar.map((m) => [m.id, m]));

  const liveMatches = liveRaw.map((m) => barById.get(m._id.toString())).filter(Boolean);
  const recentFinishedMatches = pickFeaturedRecentFinishedMatches(recentFinishedRaw)
    .map((m) => barById.get(m._id.toString()))
    .filter(Boolean);

  return {
    matches: enriched,
    total: enriched.length,
    liveMatches,
    recentFinishedMatches,
  };
}
