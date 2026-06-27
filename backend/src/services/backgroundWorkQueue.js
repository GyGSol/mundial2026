import {
  compareWorkPriority,
  formatMemoryPressureLog,
  getMemorySnapshot,
  isMemoryPressure,
  waitForMemoryHeadroom,
} from './memoryBudgetService.js';

const DEFER_RETRY_MS = 5000;

/** @type {Array<{ name: string, fn: () => Promise<unknown>, priority: 'critical'|'normal'|'low', memoryHeavy: boolean, coalesceKey: string | null, resolve: (value: unknown) => void, reject: (reason?: unknown) => void, deferCount: number }>} */
const pending = [];

/** @type {Set<string>} */
const activeCoalesceKeys = new Set();

let runningName = null;
let pumpPromise = null;
let deferredCount = 0;
let skippedCount = 0;
let lastCompletedName = null;

function sortPending() {
  pending.sort((a, b) => compareWorkPriority(a.priority, b.priority));
}

function schedulePump() {
  if (pumpPromise) return;
  pumpPromise = pump().finally(() => {
    pumpPromise = null;
    if (pending.length > 0 && !runningName) {
      schedulePump();
    }
  });
}

async function shouldRunTask(task) {
  if (task.priority === 'low' && isMemoryPressure('hard')) {
    return { action: task.deferCount >= 3 ? 'skip' : 'defer' };
  }

  if (task.priority === 'normal' && isMemoryPressure('soft')) {
    const gotHeadroom = await waitForMemoryHeadroom();
    if (!gotHeadroom) {
      return { action: task.deferCount >= 5 ? 'skip' : 'defer' };
    }
  }

  if (task.memoryHeavy && task.priority === 'critical' && isMemoryPressure('soft')) {
    await waitForMemoryHeadroom({ maxWaitMs: 10_000 });
  }

  return { action: 'run' };
}

async function pump() {
  while (pending.length > 0) {
    sortPending();
    const task = pending.shift();
    if (!task) break;

    const decision = await shouldRunTask(task);
    if (decision.action === 'defer') {
      task.deferCount += 1;
      deferredCount += 1;
      const snapshot = getMemorySnapshot();
      console.warn(formatMemoryPressureLog('deferred', task.name, snapshot));
      pending.push(task);
      if (task.coalesceKey) {
        activeCoalesceKeys.add(task.coalesceKey);
      }
      sortPending();
      await new Promise((resolve) => setTimeout(resolve, DEFER_RETRY_MS));
      continue;
    }

    if (decision.action === 'skip') {
      skippedCount += 1;
      const snapshot = getMemorySnapshot();
      console.warn(formatMemoryPressureLog('skipped', task.name, snapshot));
      if (task.coalesceKey) {
        activeCoalesceKeys.delete(task.coalesceKey);
      }
      task.resolve({ skipped: true, reason: 'memory_pressure' });
      continue;
    }

    runningName = task.name;
    try {
      const result = await task.fn();
      lastCompletedName = task.name;
      task.resolve(result);
    } catch (err) {
      task.reject(err);
    } finally {
      runningName = null;
      if (task.coalesceKey) {
        activeCoalesceKeys.delete(task.coalesceKey);
      }
    }
  }
}

/**
 * Encola trabajo serializado con prioridad y control de memoria.
 * @param {string} name
 * @param {() => Promise<unknown>} fn
 * @param {{ priority?: 'critical'|'normal'|'low', memoryHeavy?: boolean, coalesceKey?: string | null }} [options]
 */
export function enqueueBackgroundWork(
  name,
  fn,
  { priority = 'normal', memoryHeavy = false, coalesceKey = null } = {}
) {
  if (coalesceKey && activeCoalesceKeys.has(coalesceKey)) {
    return Promise.resolve({ coalesced: true, coalesceKey });
  }

  return new Promise((resolve, reject) => {
    const task = {
      name,
      fn,
      priority,
      memoryHeavy,
      coalesceKey,
      resolve,
      reject,
      deferCount: 0,
    };

    if (coalesceKey) {
      activeCoalesceKeys.add(coalesceKey);
    }
    pending.push(task);
    sortPending();
    schedulePump();
  });
}

export function getBackgroundWorkQueueStats() {
  return {
    pending: pending.length,
    running: runningName,
    deferred: deferredCount,
    skipped: skippedCount,
    lastCompleted: lastCompletedName,
    pendingNames: pending.slice(0, 10).map((task) => task.name),
    memory: getMemorySnapshot(),
  };
}

/** Solo tests — reinicia estado del módulo. */
export function resetBackgroundWorkQueueForTests() {
  pending.length = 0;
  activeCoalesceKeys.clear();
  runningName = null;
  pumpPromise = null;
  deferredCount = 0;
  skippedCount = 0;
  lastCompletedName = null;
}

/** Solo tests — espera a que la cola quede vacía. */
export async function drainBackgroundWorkQueueForTests({ timeoutMs = 15_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!runningName && pending.length === 0 && !pumpPromise) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('background work queue drain timeout');
}
