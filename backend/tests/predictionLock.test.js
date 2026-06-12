import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  enrichMatchPredictionMeta,
  getLockAt,
  hasUserPrediction,
  isPredictionLocked,
  isPredictionOpen,
} from '../src/services/predictionLockService.js';

const kickoff = new Date('2026-06-15T16:00:00Z');

describe('predictionLockService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('bloquea 1 hora antes del kickoff', () => {
    const lockAt = getLockAt(kickoff);
    expect(lockAt.toISOString()).toBe('2026-06-15T15:00:00.000Z');

    vi.setSystemTime(new Date('2026-06-15T14:59:00Z'));
    expect(isPredictionOpen({ status: 'upcoming', kickoffAt: kickoff })).toBe(true);

    vi.setSystemTime(new Date('2026-06-15T15:01:00Z'));
    expect(isPredictionLocked({ status: 'upcoming', kickoffAt: kickoff })).toBe(true);
  });

  it('partidos live o finished siempre bloqueados', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    expect(isPredictionLocked({ status: 'live', kickoffAt: kickoff })).toBe(true);
    expect(isPredictionLocked({ status: 'finished', kickoffAt: kickoff })).toBe(true);
  });

  it('hasPrediction con userSubmitted o marcador distinto de 0-0', () => {
    const match = { status: 'finished', kickoffAt: kickoff };

    expect(
      enrichMatchPredictionMeta(match, { homeGoals: 2, awayGoals: 1, userSubmitted: true })
        .hasPrediction
    ).toBe(true);
    expect(
      enrichMatchPredictionMeta(match, { homeGoals: 2, awayGoals: 1, userSubmitted: false })
        .hasPrediction
    ).toBe(true);
    expect(
      enrichMatchPredictionMeta(match, { homeGoals: 0, awayGoals: 0, userSubmitted: false })
        .hasPrediction
    ).toBe(false);
    expect(hasUserPrediction({ homeGoals: 0, awayGoals: 0, userSubmitted: true })).toBe(true);
  });
});
