import { describe, it, expect } from 'vitest';
import {
  shouldKeepLiveViewerOpen,
  matchHasCreibleFinishEvidence,
  isLiveCardFinalizing,
  liveCardBadgeLabel,
} from './matchStatus.js';

const kickoff = '2026-06-17T20:00:00.000Z';
const now = new Date('2026-06-17T22:30:00.000Z').getTime();

describe('matchStatus viewer policy', () => {
  it('mantiene abierto live con timeElapsed Final pero timeline temprana', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      timeElapsed: 'Final',
      matchTimeline: [{ type: 'goal', minute: 4, sortKey: 4 }],
      raw: { time_elapsed: 'final', finished: 'FALSE' },
    };
    expect(shouldKeepLiveViewerOpen(match, new Date('2026-06-17T20:10:00.000Z').getTime())).toBe(true);
    expect(isLiveCardFinalizing(match)).toBe(true);
    expect(liveCardBadgeLabel(match)).toBe('Finalizando…');
  });

  it('cierra cuando finished con match_end creíble', () => {
    const match = {
      status: 'finished',
      kickoffAt: kickoff,
      matchTimeline: [{ type: 'match_end', minute: 99, sortKey: 99 }],
      raw: { time_elapsed: 'finished', finished: 'TRUE' },
    };
    expect(shouldKeepLiveViewerOpen(match, now)).toBe(false);
    expect(matchHasCreibleFinishEvidence(match, now)).toBe(true);
  });

  it('mantiene abierto live en minuto 31', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      timeElapsed: "31'",
      matchTimeline: [{ type: 'goal', minute: 7, sortKey: 7 }],
      raw: { time_elapsed: '31', finished: 'FALSE' },
    };
    expect(shouldKeepLiveViewerOpen(match, now)).toBe(true);
  });

  it('muestra entretiempo en badge cuando la cronología cerró el 1.er tiempo', () => {
    const match = {
      status: 'live',
      timeElapsed: "45+4'",
      matchTimeline: [{ type: 'period_end', minute: 45, phase: 'first', sortKey: 45 }],
      weatherOps: { phase: 'normal' },
    };
    expect(liveCardBadgeLabel(match)).toBe('Entretiempo');
  });

  it('muestra suspendido oficial cuando matchPlayState lo indica', () => {
    const match = {
      status: 'live',
      matchPlayState: {
        phase: 'suspended',
        label: 'Suspendido',
        frozenClock: "45+4'",
        reason: 'official',
      },
      timeElapsed: "45+4'",
    };
    expect(liveCardBadgeLabel(match)).toBe("Suspendido · 45+4'");
  });
});
