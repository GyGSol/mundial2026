import { invalidateWorldCupOverviewCache } from './worldCupOverviewCache.js';
import { invalidateLeaderboardCache } from './leaderboardCache.js';
import { invalidateRankingDashboardCache } from './rankingDashboardCache.js';
import { invalidateRankingFinishedMatchesCache } from './rankingFinishedMatchesCache.js';
import { invalidateAdminMatchesCache } from './adminMatchesCache.js';

/** Invalida cachés de ranking, dashboard y admin ligadas a partidos. */
export function invalidateMatchRelatedCaches(groupId) {
  invalidateWorldCupOverviewCache();
  invalidateLeaderboardCache(groupId);
  invalidateRankingDashboardCache(groupId);
  invalidateAdminMatchesCache();
}

/** Solo cuando cambia el archivo de partidos finalizados (marcador, alta/baja en finished). */
export function invalidateFinishedMatchArchiveCaches(groupId) {
  invalidateRankingFinishedMatchesCache();
  invalidateRankingDashboardCache(groupId);
  invalidateWorldCupOverviewCache();
}
