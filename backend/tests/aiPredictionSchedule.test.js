import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiAutoPredictionSchedule } from '../src/services/aiPredictionSchedule.js';
import { env } from '../src/config/env.js';

describe('aiPredictionSchedule', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calcula inicio T-1 h y ventana ±2 min para kickoff 20:00 UTC', () => {
    vi.setSystemTime(new Date('2026-06-15T18:00:00.000Z'));
    const schedule = getAiAutoPredictionSchedule(new Date('2026-06-15T20:00:00.000Z'));

    expect(schedule?.targetAt).toBe('2026-06-15T19:00:00.000Z');
    expect(schedule?.windowStartAt).toBe('2026-06-15T18:58:00.000Z');
    expect(schedule?.windowEndAt).toBe('2026-06-15T19:02:00.000Z');
    expect(schedule?.leadMinutes).toBe(Math.round(env.aiPredictLeadMs / 60_000));
    expect(schedule?.phase).toBe('scheduled');
  });

  it('marca phase in_window cuando now cae en la ventana principal', () => {
    vi.setSystemTime(new Date('2026-06-15T19:01:00.000Z'));
    const schedule = getAiAutoPredictionSchedule(new Date('2026-06-15T20:00:00.000Z'));
    expect(schedule?.phase).toBe('in_window');
  });
});
