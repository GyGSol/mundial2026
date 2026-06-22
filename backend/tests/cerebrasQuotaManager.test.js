import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../src/config/env.js';
import {
  acquireCerebrasSlot,
  CEREBRAS_PRIORITIES,
  estimateCerebrasRequestTokens,
  getCerebrasQuotaSnapshot,
  noteCerebrasResponse,
  resetCerebrasQuotaStateForTests,
} from '../src/services/cerebrasQuotaManager.js';

describe('cerebrasQuotaManager', () => {
  let prevKey;
  let prevGap;
  let prevTpm;
  let prevRpm;

  beforeEach(() => {
    prevKey = env.cerebrasApiKey;
    prevGap = env.cerebrasMinGapMs;
    prevTpm = env.cerebrasMaxTpm;
    prevRpm = env.cerebrasMaxRpm;
    env.cerebrasApiKey = 'test-key';
    env.cerebrasMinGapMs = 0;
    env.cerebrasMaxTpm = 10_000;
    env.cerebrasMaxRpm = 10;
    resetCerebrasQuotaStateForTests();
  });

  afterEach(() => {
    env.cerebrasApiKey = prevKey;
    env.cerebrasMinGapMs = prevGap;
    env.cerebrasMaxTpm = prevTpm;
    env.cerebrasMaxRpm = prevRpm;
    resetCerebrasQuotaStateForTests();
    vi.restoreAllMocks();
  });

  describe('estimateCerebrasRequestTokens', () => {
    it('suma input estimado + output budget', () => {
      expect(estimateCerebrasRequestTokens('abcd', { outputBudget: 100 })).toBe(101);
    });

    it('acepta array de mensajes', () => {
      const tokens = estimateCerebrasRequestTokens(
        [{ content: 'hola mundo' }, { content: 'test' }],
        { outputBudget: 50 }
      );
      expect(tokens).toBeGreaterThan(50);
    });
  });

  describe('acquireCerebrasSlot', () => {
    it('incrementa contadores de cuota', async () => {
      await acquireCerebrasSlot({
        estimatedTokens: 500,
        priority: CEREBRAS_PRIORITIES.preMatchOracle,
      });
      const snap = getCerebrasQuotaSnapshot();
      expect(snap.requestsUsed).toBe(1);
      expect(snap.tokensUsed).toBe(500);
    });

    it('no hace nada sin API key', async () => {
      env.cerebrasApiKey = '';
      await acquireCerebrasSlot({ estimatedTokens: 1000 });
      expect(getCerebrasQuotaSnapshot().requestsUsed).toBe(0);
    });
  });

  describe('noteCerebrasResponse', () => {
    it('lee headers de rate limit', () => {
      noteCerebrasResponse({
        headers: {
          get: (name) => {
            if (name === 'x-ratelimit-remaining-tokens-minute') return '12000';
            if (name === 'x-ratelimit-reset-tokens-minute') return '45';
            return null;
          },
        },
      });
      const snap = getCerebrasQuotaSnapshot();
      expect(snap.remainingTokensHeader).toBe(12000);
      expect(snap.resetTokensSec).toBe(45);
    });
  });
});
