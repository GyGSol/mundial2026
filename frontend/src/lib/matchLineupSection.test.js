import { describe, expect, it } from 'vitest';
import {
  shouldShowMatchLineup,
  shouldUseInteractivePitch,
} from '@/components/lineup/MatchLineupSection.jsx';

describe('matchLineupSection visibility', () => {
  it('muestra cancha interactiva en partidos finalizados con timeline', () => {
    const match = {
      status: 'finished',
      matchTimeline: [{ type: 'goal', minute: 10 }],
    };
    expect(shouldShowMatchLineup(match)).toBe(true);
    expect(shouldUseInteractivePitch(match)).toBe(true);
  });

  it('muestra cancha interactiva en vivo aunque no haya alineación', () => {
    const match = {
      status: 'live',
      matchTimeline: [{ type: 'shot_attempt', minute: 5 }],
      lineup: { status: 'unavailable' },
    };
    expect(shouldShowMatchLineup(match)).toBe(true);
    expect(shouldUseInteractivePitch(match, 'live')).toBe(true);
  });

  it('no usa modo interactivo en próximos sin timeline', () => {
    const match = {
      status: 'scheduled',
      lineup: { status: 'probable', home: { players: [{ name: 'A' }] } },
    };
    expect(shouldShowMatchLineup(match)).toBe(true);
    expect(shouldUseInteractivePitch(match)).toBe(false);
  });
});
