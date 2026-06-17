import { describe, it, expect } from 'vitest';
import { timelineToMicroEvents } from '../src/services/matchMicroEventService.js';

describe('matchMicroEventService', () => {
  it('mapea goles del timeline a micro-eventos', () => {
    const match = {
      _id: '507f1f77bcf86cd799439011',
      homeTeamId: 'ARG',
      awayTeamId: 'FRA',
    };
    const timeline = [
      { type: 'goal', side: 'home', minute: 23, player: 'Messi' },
      { type: 'goal', side: 'away', minute: 45, extraMinute: 1, player: 'Mbappé' },
      { type: 'yellow_card', side: 'home', minute: 50, player: 'X' },
    ];

    const events = timelineToMicroEvents(match, timeline);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'goal',
      minute: 23,
      playerName: 'Messi',
      teamId: 'ARG',
    });
    expect(events[1].extraMinute).toBe(1);
  });
});
