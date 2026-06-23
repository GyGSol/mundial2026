import { useMemo } from 'react';

const RANK_KEY = 'rank';
const LIVE_STAT_KEYS = ['pa', 'gl', 'gv', 'gt', 'pb'];
const INVERT_DELTA_KEYS = new Set([RANK_KEY]);

function snapshotRow(row) {
  return {
    rank: row.rank ?? 0,
    pa: row.pa ?? 0,
    gl: row.gl ?? 0,
    gv: row.gv ?? 0,
    gt: row.gt ?? 0,
    pb: row.pb ?? 0,
  };
}

function leaderboardFingerprint(leaderboard) {
  if (!leaderboard?.length) return '';
  return leaderboard
    .map((row) => {
      const stats = snapshotRow(row);
      return `${row.id}:${stats.rank},${stats.pa},${stats.gl},${stats.gv},${stats.gt},${stats.pb}`;
    })
    .join('|');
}

export function statDeltaForKey(key, previous, next, { upOnly = false } = {}) {
  if (previous === next) return null;

  const rawDelta = next - previous;
  const delta = INVERT_DELTA_KEYS.has(key) ? -rawDelta : rawDelta;

  if (upOnly) {
    return delta > 0 ? { direction: 'up', count: delta } : null;
  }

  if (delta > 0) {
    return {
      direction: 'up',
      ...(key === RANK_KEY ? { amount: Math.abs(rawDelta) } : { count: delta }),
    };
  }
  if (delta < 0) {
    return {
      direction: 'down',
      ...(key === RANK_KEY ? { amount: Math.abs(rawDelta) } : {}),
    };
  }
  return null;
}

function liveStatDeltaFromPerMatchFlags(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return null;
  const count = flags.filter(Boolean).length;
  return count > 0 ? { direction: 'up', count } : null;
}

/** Indicadores vs baseline: rank ↑↓ junto al nombre; PA/GL/GV/GT/PB solo subidas verdes en vivo. */
export function computeLeaderboardBaselineIndicators(
  leaderboard,
  leaderboardKickoffBaseline,
  { hasLiveMatches = false, leaderboardLiveStatIndicators = null } = {}
) {
  if (!leaderboard?.length || !leaderboardKickoffBaseline?.length) return {};

  const baselineById = Object.fromEntries(
    leaderboardKickoffBaseline.map((row) => [row.id, snapshotRow(row)])
  );
  const perMatchByUser = leaderboardLiveStatIndicators?.byUser ?? {};
  const indicators = {};

  for (const row of leaderboard) {
    const baseline = baselineById[row.id];
    if (!baseline) continue;

    const current = snapshotRow(row);
    const rowIndicators = {};

    const rankChange = statDeltaForKey(RANK_KEY, baseline.rank, current.rank);
    if (rankChange) rowIndicators.rank = rankChange;

    if (hasLiveMatches) {
      const perMatch = perMatchByUser[row.id];
      if (perMatch) {
        for (const key of LIVE_STAT_KEYS) {
          const change = liveStatDeltaFromPerMatchFlags(perMatch[key]);
          if (change) rowIndicators[key] = change;
        }
      } else {
        for (const key of LIVE_STAT_KEYS) {
          const change = statDeltaForKey(key, baseline[key], current[key], { upOnly: true });
          if (change) rowIndicators[key] = change;
        }
      }
    }

    if (Object.keys(rowIndicators).length > 0) {
      indicators[row.id] = rowIndicators;
    }
  }

  return indicators;
}

export function useLeaderboardStatDeltas(
  leaderboard,
  leaderboardKickoffBaseline,
  { hasLiveMatches = false, leaderboardLiveStatIndicators = null } = {}
) {
  const liveIndicatorsFingerprint = leaderboardLiveStatIndicators?.liveMatchIds?.join(',') ?? '';
  const liveIndicatorsUserFingerprint = leaderboardLiveStatIndicators?.byUser
    ? Object.entries(leaderboardLiveStatIndicators.byUser)
        .map(([userId, stats]) =>
          LIVE_STAT_KEYS.map((key) => `${userId}:${key}:${(stats[key] ?? []).map(Number).join('')}`).join(',')
        )
        .join('|')
    : '';

  return useMemo(
    () =>
      computeLeaderboardBaselineIndicators(leaderboard, leaderboardKickoffBaseline, {
        hasLiveMatches,
        leaderboardLiveStatIndicators,
      }),
    [
      leaderboardFingerprint(leaderboard),
      leaderboardFingerprint(leaderboardKickoffBaseline),
      hasLiveMatches,
      liveIndicatorsFingerprint,
      liveIndicatorsUserFingerprint,
    ]
  );
}
