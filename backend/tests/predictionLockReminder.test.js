import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getKickoffRangeForLockReminder,
  findMatchesDueForLockReminder,
  findUsersNeedingLockReminder,
  runPredictionLockReminderTick,
} from '../src/services/predictionLockReminderService.js';
import {
  getLockReminderAt,
  isLockReminderDue,
  LOCK_MS,
  LOCK_REMINDER_BEFORE_LOCK_MS,
} from '../src/services/predictionLockService.js';

vi.mock('../src/models/Match.js', () => ({
  Match: {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../src/models/Prediction.js', () => ({
  Prediction: {
    find: vi.fn(),
  },
}));

vi.mock('../src/models/User.js', () => ({
  User: {
    find: vi.fn(),
  },
}));

vi.mock('../src/services/pushNotificationService.js', () => ({
  notifyPredictionLockClosing: vi.fn().mockResolvedValue({ sent: 1, skipped: false }),
}));

import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { User } from '../src/models/User.js';
import { notifyPredictionLockClosing } from '../src/services/pushNotificationService.js';

const kickoff = new Date('2026-06-15T16:00:00Z');

describe('predictionLockReminderService', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('getLockReminderAt es 15 min antes del cierre', () => {
    const reminderAt = getLockReminderAt(kickoff);
    expect(reminderAt.toISOString()).toBe('2026-06-15T14:45:00.000Z');
  });

  it('isLockReminderDue solo en la ventana de 15 min previa al cierre', () => {
    const match = { status: 'upcoming', kickoffAt: kickoff };

    vi.setSystemTime(new Date('2026-06-15T14:44:00Z'));
    expect(isLockReminderDue(match)).toBe(false);

    vi.setSystemTime(new Date('2026-06-15T14:45:00Z'));
    expect(isLockReminderDue(match)).toBe(true);

    vi.setSystemTime(new Date('2026-06-15T14:59:00Z'));
    expect(isLockReminderDue(match)).toBe(true);

    vi.setSystemTime(new Date('2026-06-15T15:00:00Z'));
    expect(isLockReminderDue(match)).toBe(false);
  });

  it('getKickoffRangeForLockReminder acota kickoff entre +60 y +75 min', () => {
    const now = Date.parse('2026-06-15T12:00:00Z');
    const range = getKickoffRangeForLockReminder(now);
    expect(range.$gt.toISOString()).toBe('2026-06-15T13:00:00.000Z');
    expect(range.$lte.toISOString()).toBe('2026-06-15T13:15:00.000Z');
    expect(LOCK_MS + LOCK_REMINDER_BEFORE_LOCK_MS).toBe(75 * 60 * 1000);
  });

  it('findUsersNeedingLockReminder excluye quienes ya cargaron predicción', async () => {
    User.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: 'user-1', pushSubscriptions: [{ endpoint: 'a' }] },
          { _id: 'user-2', pushSubscriptions: [{ endpoint: 'b' }] },
        ]),
      }),
    });
    Prediction.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { userId: 'user-1', homeGoals: 2, awayGoals: 1, userSubmitted: true },
        ]),
      }),
    });

    const users = await findUsersNeedingLockReminder('match-1');
    expect(users).toHaveLength(1);
    expect(String(users[0]._id)).toBe('user-2');
  });

  it('runPredictionLockReminderTick reclama el partido y envía push', async () => {
    const now = Date.parse('2026-06-15T14:50:00Z');
    const dueMatch = {
      _id: 'match-1',
      externalId: '19',
      status: 'upcoming',
      kickoffAt: kickoff,
    };

    Match.find.mockResolvedValue([dueMatch]);
    Match.find.mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue([dueMatch]),
    }));
    Match.findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue(dueMatch),
    });
    User.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ _id: 'user-2', pushSubscriptions: [{ endpoint: 'b' }] }]),
      }),
    });
    Prediction.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await runPredictionLockReminderTick({ now });

    expect(result).toMatchObject({ matches: 1, notifiedUsers: 1, sent: 1, skipped: false });
    expect(notifyPredictionLockClosing).toHaveBeenCalledTimes(1);
    expect(Match.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'match-1', predictionLockReminderSentAt: { $exists: false } },
      { predictionLockReminderSentAt: new Date(now) },
      { new: true }
    );
  });

  it('findMatchesDueForLockReminder consulta partidos en ventana y sin aviso previo', async () => {
    const now = Date.parse('2026-06-15T14:50:00Z');
    Match.find.mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue([]),
    }));

    await findMatchesDueForLockReminder(now);

    expect(Match.find).toHaveBeenCalledWith({
      status: 'upcoming',
      kickoffAt: getKickoffRangeForLockReminder(now),
      predictionLockReminderSentAt: { $exists: false },
    });
  });
});
