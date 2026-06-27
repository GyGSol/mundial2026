import { describe, it, expect, vi } from 'vitest';
import {
  getMemorySnapshot,
  isMemoryPressure,
  waitForMemoryHeadroom,
  compareWorkPriority,
} from '../src/services/memoryBudgetService.js';

describe('memoryBudgetService', () => {
  it('clasifica niveles ok, soft y hard según ratio', () => {
    expect(getMemorySnapshot({ heapUsedBytes: 200 * 1024 * 1024 }).level).toBe('ok');
    expect(getMemorySnapshot({ heapUsedBytes: 310 * 1024 * 1024 }).level).toBe('soft');
    expect(getMemorySnapshot({ heapUsedBytes: 350 * 1024 * 1024 }).level).toBe('hard');
  });

  it('isMemoryPressure respeta umbral soft y hard', () => {
    const softSpy = vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 0,
      heapTotal: 0,
      heapUsed: 310 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    });

    expect(isMemoryPressure('soft')).toBe(true);
    expect(isMemoryPressure('hard')).toBe(false);

    softSpy.mockReturnValue({
      rss: 0,
      heapTotal: 0,
      heapUsed: 350 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    });

    expect(isMemoryPressure('hard')).toBe(true);
    softSpy.mockRestore();
  });

  it('waitForMemoryHeadroom resuelve cuando baja la presión', async () => {
    vi.useFakeTimers();
    let heapUsed = 350 * 1024 * 1024;
    vi.spyOn(process, 'memoryUsage').mockImplementation(() => ({
      rss: 0,
      heapTotal: 0,
      heapUsed,
      external: 0,
      arrayBuffers: 0,
    }));

    const waitPromise = waitForMemoryHeadroom({ maxWaitMs: 10_000, pollMs: 1000 });
    heapUsed = 200 * 1024 * 1024;
    await vi.advanceTimersByTimeAsync(1000);
    await expect(waitPromise).resolves.toBe(true);

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ordena prioridades critical < normal < low', () => {
    expect(compareWorkPriority('critical', 'normal')).toBeLessThan(0);
    expect(compareWorkPriority('normal', 'low')).toBeLessThan(0);
  });
});
