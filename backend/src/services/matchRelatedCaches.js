import { invalidateWorldCupOverviewCache } from './worldCupOverviewCache.js';
import { invalidateLeaderboardCache } from './leaderboardCache.js';
import { invalidateRankingDashboardCache } from './rankingDashboardCache.js';
import { invalidateAdminMatchesCache } from './adminMatchesCache.js';

/** Invalida cachés de ranking, dashboard y admin ligadas a partidos. */
export function invalidateMatchRelatedCaches(groupId) {
  invalidateWorldCupOverviewCache();
  invalidateLeaderboardCache(groupId);
  invalidateRankingDashboardCache(groupId);
  invalidateAdminMatchesCache();
}
