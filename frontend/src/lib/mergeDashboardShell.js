/**
 * Fusiona respuesta shell (sin barra en vivo) sobre el dashboard existente.
 * Conserva liveMatches / recentFinishedMatches ya parcheados por WS o snapshot.
 */
import { mergeLiveDashboard } from './patchLiveMatchSnapshot.js';

export function mergeDashboardShell(prev, shell) {
  if (!shell) return prev ?? null;
  if (!prev) return shell;

  return {
    ...shell,
    liveMatches: prev.liveMatches ?? shell.liveMatches ?? [],
    recentFinishedMatches: prev.recentFinishedMatches ?? shell.recentFinishedMatches ?? [],
  };
}

/** Estable para useLiveData — evita recrear refresh en cada render. */
export function mergeLeaderboardDashboardRefresh(prev, next) {
  if (next && !('liveMatches' in next)) {
    return mergeDashboardShell(prev, next);
  }
  return mergeLiveDashboard(prev, next);
}

/** Milisegundos tras un parche WS/snapshot durante los cuales se evita poll HTTP. */
export const LIVE_PATCH_SKIP_POLL_MS = 8_000;
