import { Match } from '../models/Match.js';
import {
  enrichMatchesForPredictions,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { sortMatchesBySchedule } from './matchSortService.js';

export async function listPredictionsMatches({ status, group }, userId) {
  const filter = {};
  if (status) filter.status = status;
  if (group) filter.group = group;

  const matches = sortMatchesBySchedule(
    await Match.find(filter).select('-raw').lean()
  );
  await prepareFifaShirtMapsForMatches(matches);
  const enriched = await enrichMatchesForPredictions(matches, userId);

  return { matches: enriched, total: enriched.length };
}
