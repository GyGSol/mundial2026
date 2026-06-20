import { describe, expect, it } from 'vitest';
import {
  applySubstitutionsToLineup,
  buildPlayerEventSummary,
  matchPlayerToTimeline,
  playerKeyFromLineupPlayer,
} from './lineupLiveState.js';

describe('lineupLiveState', () => {
  it('buildPlayerEventSummary acumula goles y tarjetas por jugador', () => {
    const timeline = [
      {
        type: 'goal',
        side: 'home',
        minute: 12,
        idPlayer: '99',
        player: 'Musiala',
      },
      {
        type: 'yellow_card',
        side: 'home',
        minute: 34,
        idPlayer: '99',
        player: 'Musiala',
      },
    ];

    const summary = buildPlayerEventSummary(timeline, 'home');
    const key = playerKeyFromLineupPlayer({ idPlayer: '99', name: 'Musiala' }, 'home');
    expect(summary.get(key)).toMatchObject({ goals: 1, yellow: 1 });
  });

  it('matchPlayerToTimeline prioriza idPlayer', () => {
    const player = { idPlayer: '448123', name: 'Yasin Ayari', shirtNumber: 8 };
    const event = {
      type: 'shot_attempt',
      side: 'home',
      idPlayer: '448123',
      player: 'Yasin AYARI',
    };

    expect(matchPlayerToTimeline(player, event, 'home')).toBe(true);
  });

  it('applySubstitutionsToLineup reemplaza titular por suplente', () => {
    const side = {
      formation: '4-2-3-1',
      players: [
        {
          playerId: 'p1',
          name: 'Neuer',
          shirtNumber: 1,
          gridX: 5,
          gridY: 50,
          position: 'GK',
        },
        {
          playerId: 'p2',
          name: 'Kimmich',
          shirtNumber: 6,
          gridX: 40,
          gridY: 50,
          position: 'MID',
        },
      ],
    };

    const next = applySubstitutionsToLineup(
      side,
      [
        {
          minute: 70,
          playerOut: 'Kimmich',
          playerOutShirtNumber: 6,
          playerIn: 'Sané',
          playerInShirtNumber: 19,
        },
      ],
      'home'
    );

    expect(next.players).toHaveLength(2);
    expect(next.players.find((p) => p.name === 'Kimmich')).toBeUndefined();
    expect(next.players.find((p) => p.name === 'Sané')).toMatchObject({
      shirtNumber: 19,
      gridX: 40,
      subbedIn: true,
    });
  });
});
