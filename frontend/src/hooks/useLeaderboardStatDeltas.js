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

export function statDeltaForKey(key, previous, next, { upOnly = false } = {}) {
  if (previous === next) return null;

  const rawDelta = next - previous;
  const delta = INVERT_DELTA_KEYS.has(key) ? -rawDelta : rawDelta;

  if (upOnly) {
    return delta > 0 ? { direction: 'up' } : null;
  }

  if (delta > 0) {
    return {
      direction: 'up',
      ...(key === RANK_KEY ? { amount: Math.abs(rawDelta) } : {}),
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

/** Indicadores fijos vs baseline de kickoff: rank siempre; stats solo con partido en vivo (↑ verde). */
export function computeLeaderboardBaselineIndicators(
  leaderboard,
  leaderboardKickoffBaseline,
  { hasLiveMatches = false } = {}
) {
  if (!leaderboard?.length || !leaderboardKickoffBaseline?.length) return {};

  const baselineById = Object.fromEntries(
    leaderboardKickoffBaseline.map((row) => [row.id, snapshotRow(row)])
  );
  const indicators = {};

  for (const row of leaderboard) {
    const baseline = baselineById[row.id];
    if (!baseline) continue;

    const current = snapshotRow(row);
    const rowIndicators = {};

    const rankChange = statDeltaForKey(RANK_KEY, baseline.rank, current.rank);
    if (rankChange) rowIndicators.rank = rankChange;

    if (hasLiveMatches) {
      for (const key of LIVE_STAT_KEYS) {
        const change = statDeltaForKey(key, baseline[key], current[key], { upOnly: true });
        if (change) rowIndicators[key] = change;
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
  { hasLiveMatches = false } = {}
) {
  return useMemo(
    () =>
      computeLeaderboardBaselineIndicators(leaderboard, leaderboardKickoffBaseline, {
        hasLiveMatches,
      }),
    [leaderboard, leaderboardKickoffBaseline, hasLiveMatches]
  );
}
