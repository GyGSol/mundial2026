import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enqueueBackgroundWork,
  getBackgroundWorkQueueStats,
  resetBackgroundWorkQueueForTests,
  drainBackgroundWorkQueueForTests,
} from '../src/services/backgroundWorkQueue.js';
import * as memoryBudget from '../src/services/memoryBudgetService.js';

describe('backgroundWorkQueue', () => {
  beforeEach(() => {
    resetBackgroundWorkQueueForTests();
    vi.spyOn(memoryBudget, 'isMemoryPressure').mockReturnValue(false);
    vi.spyOn(memoryBudget, 'waitForMemoryHeadroom').mockResolvedValue(true);
  });

  afterEach(() => {
    resetBackgroundWorkQueueForTests();
    vi.restoreAllMocks();
  });

  it('ejecuta tareas en serie', async () => {
    const order = [];

    const first = enqueueBackgroundWork('first', async () => {
      order.push('first');
    });
    const second = enqueueBackgroundWork('second', async () => {
      order.push('second');
    });

    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
  });

  it('prioriza critical sobre low', async () => {
    const order = [];
    let unblockBlocker;
    const blockerGate = new Promise((resolve) => {
      unblockBlocker = resolve;
    });

    void enqueueBackgroundWork(
      'blocker',
      async () => {
        await blockerGate;
      },
      { priority: 'low' }
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    const criticalPromise = enqueueBackgroundWork(
      'critical-task',
      async () => {
        order.push('critical');
      },
      { priority: 'critical' }
    );
    const lowPromise = enqueueBackgroundWork(
      'low-task',
      async () => {
        order.push('low');
      },
      { priority: 'low' }
    );

    unblockBlocker();
    await Promise.all([criticalPromise, lowPromise]);

    expect(order).toEqual(['critical', 'low']);
  });

  it('coalesce evita duplicados pendientes con la misma clave', async () => {
    let runs = 0;
    const gate = new Promise((resolve) => {
      setTimeout(resolve, 30);
    });

    void enqueueBackgroundWork(
      'slow',
      async () => {
        await gate;
        runs += 1;
      },
      { coalesceKey: 'same-key' }
    );

    const second = await enqueueBackgroundWork(
      'slow-duplicate',
      async () => {
        runs += 1;
      },
      { coalesceKey: 'same-key' }
    );

    expect(second).toEqual({ coalesced: true, coalesceKey: 'same-key' });
    await drainBackgroundWorkQueueForTests();
    expect(runs).toBe(1);
  });

  it('salta tareas low tras varios difieres bajo presión hard', async () => {
    vi.useFakeTimers();
    memoryBudget.isMemoryPressure.mockImplementation((level) => level === 'hard');

    const promise = enqueueBackgroundWork(
      'sync:slow',
      async () => ({ done: true }),
      { priority: 'low', memoryHeavy: true }
    );

    await vi.advanceTimersByTimeAsync(25_000);
    const result = await promise;

    expect(result).toEqual({ skipped: true, reason: 'memory_pressure' });
    expect(getBackgroundWorkQueueStats().skipped).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
