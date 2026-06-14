import { describe, it, expect } from 'vitest';
import {
  canWatchConfiguredStream,
  isStreamWatchEligible,
} from '../src/services/streamWatchEligibility.js';

const kickoffFuture = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const kickoffSoon = new Date(Date.now() + 30 * 60 * 1000).toISOString();

describe('streamWatchEligibility', () => {
  it('permite ver stream en partido live', () => {
    const match = { status: 'live', kickoffAt: kickoffSoon };
    expect(isStreamWatchEligible(match)).toBe(true);
    expect(
      canWatchConfiguredStream(match, { liveStreamEnabled: true, configured: true })
    ).toBe(true);
  });

  it('permite calentamiento cuando predicciones cerradas (upcoming)', () => {
    const match = { status: 'upcoming', kickoffAt: kickoffSoon };
    expect(isStreamWatchEligible(match)).toBe(true);
  });

  it('rechaza upcoming con predicciones abiertas', () => {
    const match = { status: 'upcoming', kickoffAt: kickoffFuture };
    expect(isStreamWatchEligible(match)).toBe(false);
  });

  it('requiere señal configurada y módulo habilitado', () => {
    const match = { status: 'live', kickoffAt: kickoffSoon };
    expect(
      canWatchConfiguredStream(match, { liveStreamEnabled: false, configured: true })
    ).toBe(false);
    expect(
      canWatchConfiguredStream(match, { liveStreamEnabled: true, configured: false })
    ).toBe(false);
  });
});
