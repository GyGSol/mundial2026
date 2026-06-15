import { useEffect, useRef, useState } from 'react';

const TRACKED_KEYS = ['rank', 'pa', 'gl', 'gv', 'gt', 'pb', 'totalPoints'];
const INVERT_DELTA_KEYS = new Set(['rank']);
const INDICATOR_TTL_MS = 8000;

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

export function directionForStatChange(key, previous, next) {
  if (previous === next) return null;
  const rawDelta = next - previous;
  const delta = INVERT_DELTA_KEYS.has(key) ? -rawDelta : rawDelta;
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return null;
}

export function computeLeaderboardStatChanges(previousById, leaderboard) {
  if (!previousById || !leaderboard?.length) return {};

  const changes = {};

  for (const row of leaderboard) {
    const previous = previousById[row.id];
    if (!previous) continue;

    const current = snapshotRow(row);
    const rowChanges = {};

    for (const key of TRACKED_KEYS) {
      const direction = directionForStatChange(key, previous[key], current[key]);
      if (direction) rowChanges[key] = direction;
    }

    if (Object.keys(rowChanges).length > 0) {
      changes[row.id] = rowChanges;
    }
  }

  return changes;
}

export function useLeaderboardStatDeltas(leaderboard) {
  const previousByIdRef = useRef(null);
  const timersRef = useRef(new Map());
  const [deltas, setDeltas] = useState({});

  useEffect(() => {
    if (!leaderboard?.length) return undefined;

    const previousById = previousByIdRef.current;
    const nextById = Object.fromEntries(leaderboard.map((row) => [row.id, snapshotRow(row)]));

    if (previousById) {
      const changes = computeLeaderboardStatChanges(previousById, leaderboard);

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
          }, INDICATOR_TTL_MS);

          timersRef.current.set(timerKey, timeoutId);
        }
      }
    }

    previousByIdRef.current = nextById;

    return undefined;
  }, [leaderboard]);

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
