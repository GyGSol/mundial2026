import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  enrichMatchPredictionMeta,
  ensureDefaultPredictionsForUser,
  getLockAt,
  hasUserPrediction,
  isLockReminderDue,
  isPredictionLocked,
  isPredictionOpen,
} from '../src/services/predictionLockService.js';

vi.mock('../src/models/Match.js', () => ({
  Match: { find: vi.fn() },
}));

vi.mock('../src/models/Prediction.js', () => ({
  Prediction: { bulkWrite: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock('../src/models/User.js', () => ({
  User: { findById: vi.fn() },
}));

import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { User } from '../src/models/User.js';

const kickoff = new Date('2026-06-15T16:00:00Z');

describe('predictionLockService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('bloquea 1 hora antes del kickoff', () => {
    const lockAt = getLockAt(kickoff);
    expect(lockAt.toISOString()).toBe('2026-06-15T15:00:00.000Z');

    vi.setSystemTime(new Date('2026-06-15T14:59:00Z'));
    expect(isPredictionOpen({ status: 'upcoming', kickoffAt: kickoff })).toBe(true);

    vi.setSystemTime(new Date('2026-06-15T15:01:00Z'));
    expect(isPredictionLocked({ status: 'upcoming', kickoffAt: kickoff })).toBe(true);
  });

  it('no reenvía recordatorio si ya fue enviado', () => {
    vi.setSystemTime(new Date('2026-06-15T14:50:00Z'));
    expect(
      isLockReminderDue({
        status: 'upcoming',
        kickoffAt: kickoff,
        predictionLockReminderSentAt: new Date('2026-06-15T14:45:00Z'),
      })
    ).toBe(false);
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

  it('ensureDefaultPredictionsForUser usa bulkWrite para partidos cerrados', async () => {
    vi.setSystemTime(new Date('2026-06-15T17:30:00Z'));
    User.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isAiUser: false }),
      }),
    });
    const lockedMatch = {
      _id: 'match-1',
      status: 'upcoming',
      kickoffAt: new Date('2026-06-15T18:00:00Z'),
    };
    Match.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([lockedMatch]),
    });
    Prediction.bulkWrite.mockResolvedValue({ ok: 1 });

    await ensureDefaultPredictionsForUser('user-1');

    expect(Prediction.bulkWrite).toHaveBeenCalledTimes(1);
    expect(Prediction.bulkWrite.mock.calls[0][0]).toHaveLength(1);
    expect(Prediction.bulkWrite.mock.calls[0][1]).toEqual({ ordered: false });
  });

  it('ensureDefaultPredictionsForUser no aplica 0-0 al bot IA', async () => {
    vi.setSystemTime(new Date('2026-06-15T17:30:00Z'));
    User.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isAiUser: true }),
      }),
    });

    await ensureDefaultPredictionsForUser('ai-user');

    expect(Match.find).not.toHaveBeenCalled();
    expect(Prediction.bulkWrite).not.toHaveBeenCalled();
  });
});
