import { describe, it, expect } from 'vitest';
import {
  resolveLiveSyncCadence,
  SCHEDULE_PRESSURE_LIVE_THRESHOLD,
} from '../src/services/liveSyncCadenceService.js';
import { env } from '../src/config/env.js';

describe('liveSyncCadenceService', () => {
  it('usa cadencia rápida con un solo partido en vivo', () => {
    const cadence = resolveLiveSyncCadence(1);
    expect(cadence.hasSchedulePressure).toBe(false);
    expect(cadence.liveFifaRefreshMs).toBeLessThan(env.liveFifaRefreshMs);
    expect(cadence.kickoffWatchLiveMs).toBeLessThan(env.kickoffWatchLiveMs);
    expect(cadence.syncIntervalLiveMs).toBeLessThanOrEqual(env.syncIntervalLiveMs);
    expect(cadence.dashboardCacheLiveTtlMs).toBeLessThan(10_000);
  });

  it('mantiene cadencia conservadora con dos o más partidos en vivo', () => {
    const cadence = resolveLiveSyncCadence(SCHEDULE_PRESSURE_LIVE_THRESHOLD);
    expect(cadence.hasSchedulePressure).toBe(true);
    expect(cadence.liveFifaRefreshMs).toBe(env.liveFifaRefreshMs);
    expect(cadence.kickoffWatchLiveMs).toBe(env.kickoffWatchLiveMs);
    expect(cadence.syncIntervalLiveMs).toBe(env.syncIntervalLiveMs);
    expect(cadence.dashboardCacheLiveTtlMs).toBe(10_000);
  });
});
