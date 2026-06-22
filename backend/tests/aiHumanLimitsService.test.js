import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from '../src/config/env.js';

vi.mock('../src/models/AiHumanUsage.js', () => ({
  AiHumanUsage: {
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../src/models/User.js', () => ({
  User: {
    findById: vi.fn(),
  },
}));

import { AiHumanUsage } from '../src/models/AiHumanUsage.js';
import { User } from '../src/models/User.js';
import {
  consumeHumanAiSlot,
  createHumanAiLimitError,
} from '../src/services/aiHumanLimitsService.js';

describe('aiHumanLimitsService', () => {
  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    env.aiHumanLimitsEnabled = true;
    env.aiHumanInsightDailyLimit = 2;
    env.aiHumanHourlyLimit = 10;
    User.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isAiUser: false }),
      }),
    });
    AiHumanUsage.updateOne.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('permite consumir cuando está bajo el límite', async () => {
    AiHumanUsage.findOneAndUpdate
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({ insight: 1, total: 1 }),
      })
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({ total: 1 }),
      });

    const result = await consumeHumanAiSlot(userId, 'insight');
    expect(result.allowed).toBe(true);
    expect(result.remaining.daily).toBe(1);
  });

  it('rechaza cuando supera límite diario', async () => {
    AiHumanUsage.findOneAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ insight: 3, total: 3 }),
    });

    await expect(consumeHumanAiSlot(userId, 'insight')).rejects.toMatchObject({
      status: 429,
      code: 'ai_rate_limit',
    });
    expect(AiHumanUsage.updateOne).toHaveBeenCalled();
  });

  it('exenta al usuario bot IA', async () => {
    User.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isAiUser: true }),
      }),
    });
    const result = await consumeHumanAiSlot(userId, 'insight');
    expect(result.exempt).toBe(true);
    expect(AiHumanUsage.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('createHumanAiLimitError incluye retryAfterSec', () => {
    const err = createHumanAiLimitError('test', { retryAfterSec: 120 });
    expect(err.status).toBe(429);
    expect(err.retryAfterSec).toBe(120);
  });
});
