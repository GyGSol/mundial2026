import { describe, expect, it } from 'vitest';
import {
  applyShirtNumbersToTimeline,
  attachTimelinePlayerIds,
  buildShirtByPlayerId,
} from '../src/utils/fifaSquadShirtMap.js';

describe('fifaSquadShirtMap', () => {
  it('buildShirtByPlayerId indexa dorsales por IdPlayer', () => {
    const map = buildShirtByPlayerId({
      HomeTeam: {
        Players: [{ IdPlayer: '429157', ShirtNumber: 16 }],
      },
      AwayTeam: {
        Players: [{ IdPlayer: '395050', ShirtNumber: 6 }],
      },
    });

    expect(map).toEqual({ 429157: 16, 395050: 6 });
  });

  it('attachTimelinePlayerIds copia IdPlayer desde rawEvents', () => {
    const timeline = [
      {
        type: 'goal',
        side: 'home',
        minute: 9,
        extraMinute: null,
        player: 'Julian QUINONES',
        playerIn: null,
        playerOut: null,
      },
    ];
    const rawEvents = [
      {
        Type: 0,
        IdTeam: '43911',
        IdPlayer: '429157',
        MatchMinute: "9'",
        EventDescription: [
          { Locale: 'en-GB', Description: 'Julian QUINONES (Mexico) scores!!' },
        ],
      },
    ];

    const enriched = attachTimelinePlayerIds(timeline, rawEvents, '43911', '43883');
    expect(enriched[0].idPlayer).toBe('429157');
  });

  it('applyShirtNumbersToTimeline asigna dorsales por idPlayer', () => {
    const timeline = applyShirtNumbersToTimeline(
      [
        {
          type: 'foul',
          side: 'away',
          minute: 3,
          player: 'Aubrey Modiba',
          idPlayer: '395050',
        },
      ],
      { shirtByPlayerId: { 395050: 6 } }
    );

    expect(timeline[0].playerShirtNumber).toBe(6);
  });

  it('applyShirtNumbersToTimeline resuelve dorsal por nombre si falta idPlayer', () => {
    const timeline = applyShirtNumbersToTimeline(
      [
        {
          type: 'goal',
          side: 'home',
          minute: 9,
          player: 'Julian Quinones',
        },
      ],
      {
        shirtBySideName: {
          home: { 'julian quinones': 16 },
          away: {},
        },
      }
    );

    expect(timeline[0].playerShirtNumber).toBe(16);
  });
});
