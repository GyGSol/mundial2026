import { describe, it, expect } from 'vitest';
import {
  blocksKickoffPromotion,
  computeResumeEarliestAt,
  isWeatherSuspendedLive,
  isWeatherSuspensionExpired,
  normalizeWeatherOps,
} from '../src/services/matchWeatherOpsRules.js';

describe('matchWeatherOpsRules', () => {
  it('blocksKickoffPromotion para pre_kickoff_delay y postponed', () => {
    expect(blocksKickoffPromotion({ phase: 'pre_kickoff_delay' })).toBe(true);
    expect(blocksKickoffPromotion({ phase: 'postponed' })).toBe(true);
    expect(blocksKickoffPromotion({ phase: 'normal' })).toBe(false);
    expect(blocksKickoffPromotion({ phase: 'suspended' })).toBe(false);
  });

  it('isWeatherSuspendedLive requiere status live y phase suspended', () => {
    expect(isWeatherSuspendedLive({ status: 'live', weatherOps: { phase: 'suspended' } })).toBe(
      true
    );
    expect(isWeatherSuspendedLive({ status: 'upcoming', weatherOps: { phase: 'suspended' } })).toBe(
      false
    );
  });

  it('computeResumeEarliestAt suma 30 min desde última alerta', () => {
    const last = new Date('2026-06-15T20:00:00.000Z');
    const resume = computeResumeEarliestAt(last, last.getTime());
    expect(resume.getTime() - last.getTime()).toBe(30 * 60 * 1000);
  });

  it('isWeatherSuspensionExpired cuando resumeEarliestAt venció', () => {
    const ops = {
      phase: 'suspended',
      resumeEarliestAt: new Date(Date.now() - 60_000),
    };
    expect(isWeatherSuspensionExpired(ops)).toBe(true);
    expect(
      isWeatherSuspensionExpired({
        phase: 'suspended',
        resumeEarliestAt: new Date(Date.now() + 30 * 60 * 1000),
      })
    ).toBe(false);
  });

  it('normalizeWeatherOps devuelve defaults seguros', () => {
    const ops = normalizeWeatherOps(null);
    expect(ops.phase).toBe('normal');
    expect(ops.protocol).toBeNull();
  });
});
