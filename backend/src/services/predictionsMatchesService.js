import { Match } from '../models/Match.js';
import {
  enrichMatchesForPredictions,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';

export async function listPredictionsMatches({ status, group }, userId) {
  const filter = {};
  if (status) filter.status = status;
  if (group) filter.group = group;

  const matches = await Match.find(filter).select('-raw').sort({ kickoffAt: 1 }).lean();
  await prepareFifaShirtMapsForMatches(matches);
  const enriched = await enrichMatchesForPredictions(matches, userId);

  return { matches: enriched, total: enriched.length };
}
