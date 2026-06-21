import { describe, expect, it } from 'vitest';
import {
  pinMatchesHighlight,
  pitchHighlightKeyForTimeline,
} from '@/components/lineup/PitchEventLayer.jsx';
import { timelineEventIdentity } from '@/lib/matchTimelineDisplay.js';
import { playerKeyFromTimelineEvent } from '@/lib/lineupLiveState.js';

describe('pitch timeline sync keys', () => {
  const goal = {
    type: 'goal',
    side: 'home',
    minute: 52,
    player: 'Woltemade',
    playerShirtNumber: 9,
    positionX: 88,
    positionY: 46,
  };

  it('usa identidad del evento cuando hay coords', () => {
    const highlightKey = pitchHighlightKeyForTimeline(goal);
    expect(highlightKey).toBe(timelineEventIdentity(goal));
    expect(pinMatchesHighlight(goal, highlightKey)).toBe(true);
  });

  it('acepta clave de jugador como fallback', () => {
    const playerKey = playerKeyFromTimelineEvent(goal);
    expect(pinMatchesHighlight(goal, playerKey)).toBe(true);
  });
});
