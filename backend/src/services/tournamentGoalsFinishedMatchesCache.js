import { Match } from '../models/Match.js';
import { createInMemoryCache } from './inMemoryCache.js';

const CACHE_KEY = 'finished-for-tournament-goals';
/** Goleadores del timeline: datos estables entre eventos en vivo; invalidar al finalizar partido. */
export const TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS = 60_000;

const cache = createInMemoryCache({ defaultTtlMs: TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS });

async function loadFinishedMatchesForGoals() {
  return Match.find({ status: 'finished' }).select('externalId raw').lean();
}

export function invalidateTournamentGoalsFinishedMatchesCache() {
  cache.invalidate(CACHE_KEY);
}

export async function getCachedFinishedMatchesForTournamentGoals() {
  return cache.getOrCompute(
    CACHE_KEY,
    loadFinishedMatchesForGoals,
    TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS
  );
}

/** Test helper */
export function clearTournamentGoalsFinishedMatchesCache() {
  cache.clear();
}
