import { describe, expect, it } from 'vitest';
import { namesLikelyMatch } from './substitutionPhotos.js';
import {
  applyExpulsionsToLineup,
  applyLiveLineupState,
  applyLiveSubstitutions,
  applySubstitutionsToLineup,
  buildPlayerEventSummary,
  extractExpulsionsFromTimeline,
  matchPlayerToTimeline,
  normalizeLineupForPitch,
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
    const sane = next.players.find((p) => p.name === 'Sané');
    expect(sane).toMatchObject({ shirtNumber: 19, subbedIn: true });
    expect(sane.gridX).toBeGreaterThanOrEqual(38);
    expect(sane.gridX).toBeLessThanOrEqual(45);
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
    expect(next.home.players.find((p) => p.shirtNumber === 13)).toBeDefined();
    expect(next.home.players.find((p) => p.shirtNumber === 16)).toBeDefined();
    const uniqueGrids = new Set(
      next.home.players.map((p) => `${p.gridX},${p.gridY}`)
    );
    expect(uniqueGrids.size).toBe(11);
    expect(next.away.players.find((p) => p.name === 'Juninho Bacuna')).toBeUndefined();
    expect(next.away.players.find((p) => p.name === 'Leandro Bacuna')).toBeDefined();
  });

  it('extractExpulsionsFromTimeline deduplica rojas del mismo jugador', () => {
    const timeline = [
      { type: 'red_card', side: 'home', minute: 55, player: 'De Bruyne', playerShirtNumber: 7 },
      { type: 'red_card', side: 'home', minute: 55, player: 'De Bruyne', playerShirtNumber: 7 },
      { type: 'red_card', side: 'away', minute: 80, player: 'Taremi', playerShirtNumber: 9 },
    ];
    expect(extractExpulsionsFromTimeline(timeline, 'home')).toHaveLength(1);
    expect(extractExpulsionsFromTimeline(timeline, 'away')).toHaveLength(1);
  });

  it('applyExpulsionsToLineup saca expulsado de la cancha y lo lista en expelledPlayers', () => {
    const side = {
      formation: '4-2-3-1',
      players: Array.from({ length: 11 }, (_, index) => ({
        playerId: `p${index}`,
        name: index === 5 ? 'Kevin De Bruyne' : `Player ${index}`,
        shirtNumber: index === 5 ? 7 : index === 0 ? 1 : index + 10,
        gridX: 20 + index * 6,
        gridY: 20 + (index % 3) * 25,
        position: index === 0 ? 'GK' : index < 5 ? 'DEF' : index < 8 ? 'MID' : 'FWD',
      })),
    };

    const timeline = [
      { type: 'red_card', side: 'home', minute: 62, player: 'De Bruyne', playerShirtNumber: 7 },
    ];

    const next = applyExpulsionsToLineup(side, timeline, 'home');

    expect(next.players).toHaveLength(10);
    expect(next.players.find((p) => p.shirtNumber === 7)).toBeUndefined();
    expect(next.expelledPlayers).toHaveLength(1);
    expect(next.expelledPlayers[0]).toMatchObject({
      name: 'Kevin De Bruyne',
      shirtNumber: 7,
      expelled: true,
      expelledMinute: 62,
    });
    const uniqueGrids = new Set(next.players.map((p) => `${p.gridX},${p.gridY}`));
    expect(uniqueGrids.size).toBe(10);
  });

  it('applyLiveLineupState soporta dos expulsiones en el mismo equipo', () => {
    const lineup = {
      home: {
        formation: '4-3-3',
        players: Array.from({ length: 11 }, (_, index) => ({
          playerId: `h${index}`,
          name: `Home ${index}`,
          shirtNumber: index + 1,
          gridX: 20 + index * 6,
          gridY: 15 + (index % 4) * 20,
          position: index === 0 ? 'GK' : index < 5 ? 'DEF' : index < 8 ? 'MID' : 'FWD',
        })),
      },
      away: {
        formation: '4-3-3',
        players: Array.from({ length: 11 }, (_, index) => ({
          playerId: `a${index}`,
          name: `Away ${index}`,
          shirtNumber: index + 1,
          gridX: 20 + index * 6,
          gridY: 15 + (index % 4) * 20,
          position: index === 0 ? 'GK' : index < 5 ? 'DEF' : index < 8 ? 'MID' : 'FWD',
        })),
      },
    };

    const timeline = [
      { type: 'red_card', side: 'home', minute: 40, player: 'Home 3', playerShirtNumber: 3 },
      { type: 'red_card', side: 'home', minute: 78, player: 'Home 8', playerShirtNumber: 8 },
      { type: 'red_card', side: 'away', minute: 90, player: 'Away 11', playerShirtNumber: 11 },
    ];

    const next = applyLiveLineupState(lineup, [], [], timeline);

    expect(next.home.players).toHaveLength(9);
    expect(next.home.expelledPlayers).toHaveLength(2);
    expect(next.away.players).toHaveLength(10);
    expect(next.away.expelledPlayers).toHaveLength(1);
  });

  it('applyExpulsionsToLineup separa dos delanteros centro tras expulsión', () => {
    const side = {
      formation: '4-2-3-1',
      players: [
        { playerId: 'gk', name: 'Courtois', shirtNumber: 1, gridX: 6, gridY: 50, position: 'GK' },
        ...Array.from({ length: 4 }, (_, i) => ({
          playerId: `d${i}`,
          name: i === 3 ? 'Ngoy' : `Def ${i}`,
          shirtNumber: i === 3 ? 25 : i + 2,
          gridX: 28,
          gridY: 15 + i * 20,
          position: 'DEF',
        })),
        { playerId: 'm1', name: 'Mid A', shirtNumber: 7, gridX: 52, gridY: 35, position: 'MID' },
        { playerId: 'm2', name: 'Mid B', shirtNumber: 8, gridX: 52, gridY: 65, position: 'MID' },
        { playerId: 'am1', name: 'Vanaken', shirtNumber: 20, gridX: 64, gridY: 25, position: 'MCO' },
        { playerId: 'am3', name: 'Wide', shirtNumber: 11, gridX: 64, gridY: 75, position: 'MD' },
        { playerId: 'st1', name: 'Trossard', shirtNumber: 10, gridX: 85, gridY: 50, position: 'DC' },
        { playerId: 'st2', name: 'Fernandes', shirtNumber: 26, gridX: 85, gridY: 50, position: 'DC' },
      ],
    };

    const timeline = [
      { type: 'red_card', side: 'home', minute: 66, player: 'Ngoy', playerShirtNumber: 25 },
    ];

    const next = applyExpulsionsToLineup(side, timeline, 'home');
    const forwards = next.players.filter(
      (p) => p.name === 'Trossard' || p.name === 'Fernandes'
    );
    expect(forwards).toHaveLength(2);
    expect(Math.abs(forwards[0].gridY - forwards[1].gridY)).toBeGreaterThanOrEqual(6);
  });

  it('normalizeLineupForPitch separa MD y MCO superpuestos en 4-2-3-1', () => {
    const lineup = {
      home: {
        formation: '4-2-3-1',
        players: [
          { playerId: 'gk', name: 'Muslera', shirtNumber: 23, position: 'POR', gridX: 6, gridY: 50 },
          { playerId: 'lb', name: 'Cáceres', shirtNumber: 3, position: 'LI', gridX: 26, gridY: 50 },
          { playerId: 'cb1', name: 'Varela', shirtNumber: 13, position: 'DFC', gridX: 26, gridY: 50 },
          { playerId: 'cb2', name: 'Gutiérrez', shirtNumber: 4, position: 'DFC', gridX: 26, gridY: 50 },
          { playerId: 'rb', name: 'Olivera', shirtNumber: 16, position: 'LD', gridX: 26, gridY: 50 },
          { playerId: 'dm1', name: 'Ugarte', shirtNumber: 5, position: 'MCD', gridX: 44, gridY: 50 },
          { playerId: 'dm2', name: 'Bentancur', shirtNumber: 6, position: 'MC', gridX: 44, gridY: 50 },
          { playerId: 'lm', name: 'Valverde', shirtNumber: 8, position: 'MI', gridX: 64, gridY: 50 },
          { playerId: 'am', name: 'Sanabria', shirtNumber: 25, position: 'MCO', gridX: 64, gridY: 50 },
          { playerId: 'rm', name: 'Araujo', shirtNumber: 20, position: 'MD', gridX: 64, gridY: 50 },
          { playerId: 'st', name: 'Viñas', shirtNumber: 21, position: 'DC', gridX: 85, gridY: 50 },
        ],
      },
      away: { formation: '4-3-3', players: [] },
    };

    const next = normalizeLineupForPitch(lineup);
    const sanabria = next.home.players.find((p) => p.shirtNumber === 25);
    const araujo = next.home.players.find((p) => p.shirtNumber === 20);
    expect(sanabria).toBeTruthy();
    expect(araujo).toBeTruthy();
    expect(Math.abs(sanabria.gridY - araujo.gridY)).toBeGreaterThanOrEqual(16);

    const defenders = next.home.players.filter((p) =>
      ['LI', 'LD', 'DFC'].includes(p.pitchGridRole)
    );
    expect(defenders).toHaveLength(4);
    expect(new Set(defenders.map((p) => p.pitchGridCellId)).size).toBe(4);
  });
});
