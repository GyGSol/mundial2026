import { describe, it, expect } from 'vitest';
import {
  buildTimelineGoalKey,
  findNewTimelineGoals,
} from '../src/services/matchLiveData.js';

describe('goal push timeline helpers', () => {
  it('buildTimelineGoalKey es estable por evento', () => {
    const key = buildTimelineGoalKey({
      type: 'goal',
      side: 'home',
      minute: 23,
      extraMinute: null,
      player: 'Messi',
    });
    expect(key).toBe('goal:home:23::Messi');
  });

  it('findNewTimelineGoals detecta solo goles nuevos', () => {
    const oldTimeline = [
      { type: 'goal', side: 'home', minute: 10, player: 'A' },
    ];
    const newTimeline = [
      { type: 'goal', side: 'home', minute: 10, player: 'A' },
      { type: 'goal', side: 'away', minute: 44, player: 'B' },
    ];
    const fresh = findNewTimelineGoals(oldTimeline, newTimeline);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].player).toBe('B');
  });

  it('findNewTimelineGoals no repite si no hay cambios', () => {
    const timeline = [{ type: 'goal', side: 'home', minute: 5, player: 'C' }];
    expect(findNewTimelineGoals(timeline, timeline)).toHaveLength(0);
  });
});
