import { invalidateWorldCupOverviewCache } from './worldCupOverviewCache.js';
import { invalidateLeaderboardCache } from './leaderboardCache.js';
import { invalidateRankingDashboardCache } from './rankingDashboardCache.js';
import { invalidateLeaderboardPointsEvolutionCache } from './leaderboardPointsEvolutionCache.js';
import { invalidateRankingFinishedMatchesCache } from './rankingFinishedMatchesCache.js';
import { invalidateTournamentGoalsFinishedMatchesCache } from './tournamentGoalsFinishedMatchesCache.js';
import { invalidatePlayerTournamentActivityCache } from './playerTournamentActivityService.js';
import { invalidateAdminMatchesCache } from './adminMatchesCache.js';
import { invalidateLiveMatchSnapshotCache } from './liveMatchSnapshotService.js';
import { clearLiveFeaturedBarMatchEnrichmentCache } from './liveFeaturedBarService.js';

/** Invalida cachés de ranking, dashboard y admin ligadas a partidos. */
export function invalidateMatchRelatedCaches(groupId) {
  invalidateWorldCupOverviewCache();
  invalidateLeaderboardCache(groupId);
  invalidateRankingDashboardCache(groupId);
  invalidateLeaderboardPointsEvolutionCache(groupId);
  invalidateAdminMatchesCache();
  invalidateLiveMatchSnapshotCache();
  clearLiveFeaturedBarMatchEnrichmentCache();
}

/** Solo cuando cambia el archivo de partidos finalizados (marcador, alta/baja en finished). */
export function invalidateFinishedMatchArchiveCaches(groupId) {
  invalidateRankingFinishedMatchesCache();
  invalidateTournamentGoalsFinishedMatchesCache();
  invalidatePlayerTournamentActivityCache();
  invalidateRankingDashboardCache(groupId);
  invalidateLeaderboardPointsEvolutionCache(groupId);
  invalidateWorldCupOverviewCache();
  invalidateLiveMatchSnapshotCache();
}
