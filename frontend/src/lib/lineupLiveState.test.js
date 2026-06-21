import { describe, expect, it } from 'vitest';
import { namesLikelyMatch } from './substitutionPhotos.js';
import {
  applyLiveSubstitutions,
  applySubstitutionsToLineup,
  buildPlayerEventSummary,
  matchPlayerToTimeline,
  playerKeyFromLineupPlayer,
} from './lineupLiveState.js';
import ecuadorCuracaoLive34 from './__fixtures__/ecuador-curacao-live34.json';

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

  it('applySubstitutionsToLineup recalcula formación si entra otra línea táctica', () => {
    const side = {
      formation: '4-3-3',
      players: [
        {
          playerId: 'gk',
          name: 'Neuer',
          shirtNumber: 1,
          gridX: 6,
          gridY: 50,
          position: 'GK',
        },
        {
          playerId: 'mid',
          name: 'Kimmich',
          shirtNumber: 6,
          gridX: 58,
          gridY: 50,
          position: 'MID',
        },
        {
          playerId: 'fwd',
          name: 'Musiala',
          shirtNumber: 10,
          gridX: 85,
          gridY: 50,
          position: 'FWD',
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
          playerIn: 'Schlotterbeck',
          playerInShirtNumber: 15,
          playerInPosition: 'DEF',
        },
      ],
      'home'
    );

    const defender = next.players.find((p) => p.name === 'Schlotterbeck');
    expect(defender).toMatchObject({ subbedIn: true, position: 'DEF' });
    expect(defender.gridX).toBeLessThan(40);
    expect(next.players.find((p) => p.name === 'Kimmich')).toBeUndefined();
  });

  it('applySubstitutionsToLineup no duplica suplentes si el titular no matchea por id', () => {
    const side = {
      formation: '4-3-3',
      players: [
        { playerId: 'p1', name: 'Nicolas Pépé', shirtNumber: 19, gridX: 85, gridY: 50, position: 'FWD' },
        { playerId: 'p2', name: 'Other', shirtNumber: 9, gridX: 85, gridY: 20, position: 'FWD' },
      ],
    };

    const next = applySubstitutionsToLineup(
      side,
      [
        {
          minute: 85,
          playerOut: 'Pepe',
          playerOutShirtNumber: 19,
          playerIn: 'New Striker',
          playerInShirtNumber: 7,
        },
        {
          minute: 85,
          playerOut: 'Pepe',
          playerOutShirtNumber: 19,
          playerIn: 'New Striker',
          playerInShirtNumber: 7,
        },
      ],
      'away'
    );

    expect(next.players).toHaveLength(2);
    expect(next.players.filter((p) => namesLikelyMatch(p.name, 'Pepe'))).toHaveLength(0);
    expect(next.players.filter((p) => p.name === 'New Striker')).toHaveLength(1);
  });

  it('applyLiveSubstitutions mantiene 11 jugadores tras cambios tácticos (Ecuador vs Curaçao #34)', () => {
    const { lineup, homeSubstitutions, awaySubstitutions } = ecuadorCuracaoLive34;
    const next = applyLiveSubstitutions(lineup, homeSubstitutions, awaySubstitutions);

    expect(next.home.players).toHaveLength(11);
    expect(next.away.players).toHaveLength(11);
    expect(next.home.players.find((p) => p.name === 'Pervis Estupiñán')).toBeUndefined();
    expect(next.home.players.find((p) => p.name === 'Nilson Angulo')).toMatchObject({
      subbedIn: true,
    });
    expect(next.away.players.find((p) => p.name === 'Juninho Bacuna')).toBeUndefined();
    expect(next.away.players.find((p) => p.name === 'Leandro Bacuna')).toBeDefined();
  });
});
