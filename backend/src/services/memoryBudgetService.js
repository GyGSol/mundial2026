import { env } from '../config/env.js';

const PRIORITY_ORDER = { critical: 0, normal: 1, low: 2 };

function bytesToMb(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function resolveMemoryLevel(ratio) {
  if (ratio >= env.memoryHardPressureRatio) return 'hard';
  if (ratio >= env.memorySoftPressureRatio) return 'soft';
  return 'ok';
}

/** @param {{ heapUsedBytes?: number }} [overrides] — solo para tests */
export function getMemorySnapshot(overrides = {}) {
  const heapUsedBytes = overrides.heapUsedBytes ?? process.memoryUsage().heapUsed;
  const heapLimitMb = env.memoryHeapLimitMb;
  const heapUsedMb = bytesToMb(heapUsedBytes);
  const ratio = heapUsedMb / heapLimitMb;
  return {
    heapUsedMb,
    heapLimitMb,
    ratio: Math.round(ratio * 1000) / 1000,
    level: resolveMemoryLevel(ratio),
  };
}

/** @param {'soft'|'hard'} [level='soft'] */
export function isMemoryPressure(level = 'soft') {
  const snapshot = getMemorySnapshot();
  if (level === 'hard') {
    return snapshot.level === 'hard';
  }
  return snapshot.level === 'soft' || snapshot.level === 'hard';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Espera hasta que el heap baje del umbral soft o se agote maxWaitMs.
 * @returns {Promise<boolean>} true si hay headroom, false si sigue bajo presión
 */
export async function waitForMemoryHeadroom({
  maxWaitMs = env.memoryHeadroomMaxWaitMs,
  pollMs = 2000,
} = {}) {
  const deadline = Date.now() + Math.max(0, maxWaitMs);
  while (Date.now() < deadline) {
    if (!isMemoryPressure('soft')) {
      return true;
    }
    await sleep(Math.min(pollMs, deadline - Date.now()));
  }
  return !isMemoryPressure('soft');
}

export function compareWorkPriority(a, b) {
  return PRIORITY_ORDER[a] - PRIORITY_ORDER[b];
}

export function formatMemoryPressureLog(action, name, snapshot) {
  return `Memory pressure ${snapshot.level}: ${action} ${name} (heap ${snapshot.heapUsedMb}/${snapshot.heapLimitMb} MB)`;
}
