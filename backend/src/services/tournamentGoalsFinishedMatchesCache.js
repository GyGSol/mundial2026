import { Match } from '../models/Match.js';
import { buildTournamentGoalCountsBundle } from './matchLiveData.js';
import { createInMemoryCache, CACHE_TTL_UNTIL_INVALIDATE } from './inMemoryCache.js';

const CACHE_KEY = 'finished-for-tournament-goals';
/** Goleadores del torneo: se recalcula solo al invalidar (p. ej. partido finalizado). */
export const TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS = CACHE_TTL_UNTIL_INVALIDATE;

/** Solo campos necesarios para readMatchTimeline (goles). */
const FINISHED_GOALS_PROJECTION =
  'externalId raw.fifaEvents.timeline raw.home_scorers raw.away_scorers raw.homeScorers raw.awayScorers';

const cache = createInMemoryCache({ defaultTtlMs: TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS });

async function loadTournamentGoalCountsBundle() {
  const matches = await Match.find({ status: 'finished' })
    .select(FINISHED_GOALS_PROJECTION)
    .lean();
  return buildTournamentGoalCountsBundle(matches);
}

export function invalidateTournamentGoalsFinishedMatchesCache() {
  cache.invalidate(CACHE_KEY);
}

export async function getCachedTournamentGoalCountsBundle() {
  return cache.getOrCompute(
    CACHE_KEY,
    loadTournamentGoalCountsBundle,
    TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS
  );
}

/** @deprecated Usar getCachedTournamentGoalCountsBundle — conservado para tests legacy. */
export async function getCachedFinishedMatchesForTournamentGoals() {
  const bundle = await getCachedTournamentGoalCountsBundle();
  return Array.from(bundle.goalsByExternalId.keys()).map((externalId) => ({
    externalId,
    raw: {},
  }));
}

/** Test helper */
export function clearTournamentGoalsFinishedMatchesCache() {
  cache.clear();
}
