import { describe, expect, it } from 'vitest';
import {
  findMatchInPredictionsPayload,
  patchMatchPrediction,
} from './patchMatchPrediction.js';

describe('patchMatchPrediction', () => {
  const baseMatch = (id, goals) => ({
    id,
    hasPrediction: Boolean(goals),
    prediction: goals
      ? { homeGoals: goals[0], awayGoals: goals[1], userSubmitted: true, updatedAt: '2026-01-01T00:00:00.000Z' }
      : null,
  });

  const payload = {
    matches: [baseMatch('m1', [1, 0]), baseMatch('m2', [2, 2])],
    liveMatches: [baseMatch('live-1', [0, 0])],
    recentFinishedMatches: [baseMatch('fin-1', [3, 1])],
  };

  it('actualiza la predicción en todas las listas del payload', () => {
    const next = patchMatchPrediction(payload, 'm1', {
      homeGoals: 4,
      awayGoals: 2,
      updatedAt: '2026-06-19T12:00:00.000Z',
    });

    expect(next.matches[0].prediction.homeGoals).toBe(4);
    expect(next.matches[0].prediction.awayGoals).toBe(2);
    expect(next.matches[0].hasPrediction).toBe(true);
    expect(next.matches[1].prediction.homeGoals).toBe(2);

    const livePatched = patchMatchPrediction(payload, 'live-1', {
      homeGoals: 1,
      awayGoals: 1,
      updatedAt: '2026-06-19T12:00:00.000Z',
    });
    expect(livePatched.liveMatches[0].prediction.homeGoals).toBe(1);
  });
});

describe('findMatchInPredictionsPayload', () => {
  const payload = {
    matches: [{ id: 'm1' }],
    liveMatches: [{ id: 'live-1' }],
    recentFinishedMatches: [{ id: 'fin-1' }],
  };

  it('encuentra partidos en live, recientes o listado principal', () => {
    expect(findMatchInPredictionsPayload(payload, 'live-1')?.id).toBe('live-1');
    expect(findMatchInPredictionsPayload(payload, 'fin-1')?.id).toBe('fin-1');
    expect(findMatchInPredictionsPayload(payload, 'm1')?.id).toBe('m1');
    expect(findMatchInPredictionsPayload(payload, 'missing')).toBeNull();
  });
});
