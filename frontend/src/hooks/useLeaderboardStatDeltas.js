import { useEffect, useRef, useState } from 'react';

const TRACKED_KEYS = ['rank', 'pa', 'gl', 'gv', 'gt', 'pb', 'totalPoints'];
const INVERT_DELTA_KEYS = new Set(['rank']);
const INDICATOR_TTL_MS = 8000;
const CATCHUP_INDICATOR_TTL_MS = 20000;
const LIVE_POINTS_NEUTRAL_KEYS = ['totalPoints'];

function snapshotRow(row) {
  return {
    rank: row.rank ?? 0,
    pa: row.pa ?? 0,
    gl: row.gl ?? 0,
    gv: row.gv ?? 0,
    gt: row.gt ?? 0,
    pb: row.pb ?? 0,
    totalPoints: row.totalPoints ?? 0,
  };
}

function leaderboardFingerprint(leaderboard) {
  if (!leaderboard?.length) return '';
  return leaderboard
    .map((row) => {
      const stats = snapshotRow(row);
      return `${row.id}:${stats.rank},${stats.pa},${stats.gl},${stats.gv},${stats.gt},${stats.pb},${stats.totalPoints}`;
    })
    .join('|');
}

export function statDeltaForKey(key, previous, next, { includeNeutral = false } = {}) {
  if (previous === next) {
    return includeNeutral ? { direction: 'neutral' } : null;
  }
  const rawDelta = next - previous;
  const delta = INVERT_DELTA_KEYS.has(key) ? -rawDelta : rawDelta;
  if (delta > 0) {
    return {
      direction: 'up',
      ...(key === 'rank' ? { amount: Math.abs(rawDelta) } : {}),
    };
  }
  if (delta < 0) {
    return {
      direction: 'down',
      ...(key === 'rank' ? { amount: Math.abs(rawDelta) } : {}),
    };
  }
  return null;
}

export function directionForStatChange(key, previous, next, options = {}) {
  return statDeltaForKey(key, previous, next, options)?.direction ?? null;
}

export function computeLeaderboardStatChanges(
  previousById,
  leaderboard,
  { neutralKeys = [] } = {}
) {
  if (!previousById || !leaderboard?.length) return {};

  const changes = {};

  for (const row of leaderboard) {
    const previous = previousById[row.id];
    if (!previous) continue;

    const current = snapshotRow(row);
    const rowChanges = {};

    for (const key of TRACKED_KEYS) {
      const change = statDeltaForKey(key, previous[key], current[key], {
        includeNeutral: neutralKeys.includes(key),
      });
      if (change) rowChanges[key] = change;
    }

    if (Object.keys(rowChanges).length > 0) {
      changes[row.id] = rowChanges;
    }
  }

  return changes;
}

function baselineDiffersFromCurrent(leaderboardKickoffBaseline, leaderboard) {
  if (!leaderboardKickoffBaseline?.length || !leaderboard?.length) return false;

  const baselineById = Object.fromEntries(
    leaderboardKickoffBaseline.map((row) => [row.id, snapshotRow(row)])
  );

  return leaderboard.some((row) => {
    const baseline = baselineById[row.id];
    if (!baseline) return false;
    const current = snapshotRow(row);
    return TRACKED_KEYS.some((key) => baseline[key] !== current[key]);
  });
}

export function useLeaderboardStatDeltas(
  leaderboard,
  leaderboardKickoffBaseline,
  refreshStamp = null
) {
  const previousByIdRef = useRef(null);
  const previousLeaderboardKeyRef = useRef('');
  const timersRef = useRef(new Map());
  const [deltas, setDeltas] = useState({});

  const leaderboardKey = leaderboardFingerprint(leaderboard);
  const kickoffBaselineKey = leaderboardFingerprint(leaderboardKickoffBaseline);

  const applyChanges = (changes, ttlMs = INDICATOR_TTL_MS) => {
    for (const [userId, rowChanges] of Object.entries(changes)) {
      setDeltas((current) => ({
        ...current,
        [userId]: { ...(current[userId] ?? {}), ...rowChanges },
      }));

      for (const key of Object.keys(rowChanges)) {
        const timerKey = `${userId}:${key}`;
        const existing = timersRef.current.get(timerKey);
        if (existing) window.clearTimeout(existing);

        const timeoutId = window.setTimeout(() => {
          setDeltas((current) => {
            const row = current[userId];
            if (!row?.[key]) return current;
            const nextRow = { ...row };
            delete nextRow[key];
            const next = { ...current };
            if (Object.keys(nextRow).length === 0) {
              delete next[userId];
            } else {
              next[userId] = nextRow;
            }
            return next;
          });
          timersRef.current.delete(timerKey);
          }, ttlMs);

        timersRef.current.set(timerKey, timeoutId);
      }
    }
  };

  useEffect(() => {
    if (!leaderboard?.length) return undefined;

    const currentById = Object.fromEntries(
      leaderboard.map((row) => [row.id, snapshotRow(row)])
    );

    const hasKickoffBaseline =
      leaderboardKickoffBaseline?.length &&
      baselineDiffersFromCurrent(leaderboardKickoffBaseline, leaderboard);

    if (hasKickoffBaseline) {
      const baselineById = Object.fromEntries(
        leaderboardKickoffBaseline.map((row) => [row.id, snapshotRow(row)])
      );
      applyChanges(
        computeLeaderboardStatChanges(baselineById, leaderboard, {
          neutralKeys: LIVE_POINTS_NEUTRAL_KEYS,
        }),
        CATCHUP_INDICATOR_TTL_MS
      );
    }

    const leaderboardChanged = leaderboardKey !== previousLeaderboardKeyRef.current;
    const previousById = previousByIdRef.current;
    if (previousById && leaderboardChanged) {
      applyChanges(computeLeaderboardStatChanges(previousById, leaderboard));
    }

    previousLeaderboardKeyRef.current = leaderboardKey;
    previousByIdRef.current = currentById;

    return undefined;
  }, [leaderboardKey, kickoffBaselineKey, refreshStamp]);

  useEffect(
    () => () => {
      for (const timeoutId of timersRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timersRef.current.clear();
    },
    []
  );

  return deltas;
}
