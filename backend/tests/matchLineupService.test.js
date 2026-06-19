import { describe, it, expect } from 'vitest';
import {
  parseFootballDataMatchLineups,
  buildLineupSnapshotFromSources,
  formatLineupPayload,
} from '../src/services/matchLineupService.js';
import {
  pickProbableStarters,
  isConfirmedSnapshot,
  starterPriority,
} from '../src/services/probableLineupService.js';
import { mergeGridOntoPlayers } from '../src/services/apiFootballLineupClient.js';

describe('matchLineupService', () => {
  it('parseFootballDataMatchLineups lee homeTeam.lineup v4', () => {
    const data = {
      homeTeam: {
        formation: '4-3-3',
        coach: { name: 'Coach A' },
        lineup: [
          { id: 1, name: 'GK', position: 'Goalkeeper', shirtNumber: 1 },
          { id: 2, name: 'DEF', position: 'Centre-Back', shirtNumber: 4 },
        ],
      },
      awayTeam: {
        formation: '3-5-2',
        lineup: [{ id: 3, name: 'Away GK', position: 'Goalkeeper', shirtNumber: 1 }],
      },
    };

    const sides = parseFootballDataMatchLineups(data, 10, 20);
    expect(sides.home.formation).toBe('4-3-3');
    expect(sides.home.players).toHaveLength(2);
    expect(sides.home.players[0].position).toBe('GK');
    expect(sides.away.formation).toBe('3-5-2');
  });

  it('buildLineupSnapshotFromSources merge API-Football grid', () => {
    const fdSides = {
      home: {
        formation: '4-3-3',
        players: [
          { name: 'Messi', shirtNumber: 10, position: 'FWD', isStarter: true },
        ],
        coach: null,
      },
      away: { formation: '4-4-2', players: [], coach: null },
    };
    const apiSides = {
      home: {
        formation: '4-3-3',
        players: [{ name: 'Messi', shirtNumber: 10, gridRaw: '4:2', isStarter: true }],
        coach: null,
      },
      away: null,
    };

    const snapshot = buildLineupSnapshotFromSources({ fdSides, apiSides, source: 'api-football' });
    expect(snapshot.source).toBe('api-football');
    expect(snapshot.home.players[0].gridX).toBeDefined();
    expect(snapshot.home.players[0].gridY).toBeDefined();
  });

  it('formatLineupPayload marca confirmed con 9+ titulares por equipo', () => {
    const players = Array.from({ length: 11 }, (_, i) => ({
      name: `P${i}`,
      shirtNumber: i + 1,
      gridX: 50,
      gridY: 50,
      position: 'MID',
      isStarter: true,
    }));

    const payload = formatLineupPayload({
      fetchedAt: new Date().toISOString(),
      source: 'football-data',
      home: { formation: '4-3-3', players, coach: null },
      away: { formation: '4-3-3', players, coach: null },
    });

    expect(payload.status).toBe('confirmed');
    expect(payload.home.players).toHaveLength(11);
  });

  it('formatLineupPayload marca probable con menos de 9 titulares', () => {
    const payload = formatLineupPayload({
      fetchedAt: new Date().toISOString(),
      source: 'heuristic',
      home: { formation: '4-3-3', players: [{ name: 'A', gridX: 0, gridY: 50 }], coach: null },
      away: { formation: '4-3-3', players: [], coach: null },
    });

    expect(payload.status).toBe('probable');
  });

  it('formatLineupPayload unavailable sin jugadores', () => {
    const payload = formatLineupPayload(null);
    expect(payload.status).toBe('unavailable');
  });
});

describe('probableLineupService', () => {
  it('starterPriority favorece lineupStatus starter', () => {
    expect(starterPriority({ lineupStatus: 'starter' })).toBeLessThan(
      starterPriority({ shirtNumber: 5 })
    );
  });

  it('pickProbableStarters excluye lesionados', () => {
    const roster = [
      { fullName: 'GK', position: 'GK', shirtNumber: 1, healthStatus: 'available' },
      { fullName: 'Injured', position: 'DEF', shirtNumber: 2, healthStatus: 'injured' },
      { fullName: 'DEF1', position: 'DEF', shirtNumber: 3, healthStatus: 'available' },
      { fullName: 'DEF2', position: 'DEF', shirtNumber: 4, healthStatus: 'available' },
      { fullName: 'DEF3', position: 'DEF', shirtNumber: 5, healthStatus: 'available' },
      { fullName: 'DEF4', position: 'DEF', shirtNumber: 6, healthStatus: 'available' },
      { fullName: 'MID1', position: 'MID', shirtNumber: 8, healthStatus: 'available' },
      { fullName: 'MID2', position: 'MID', shirtNumber: 10, healthStatus: 'available' },
      { fullName: 'MID3', position: 'MID', shirtNumber: 11, healthStatus: 'available' },
      { fullName: 'FWD1', position: 'FWD', shirtNumber: 9, healthStatus: 'available' },
      { fullName: 'FWD2', position: 'FWD', shirtNumber: 7, healthStatus: 'available' },
      { fullName: 'FWD3', position: 'FWD', shirtNumber: 19, healthStatus: 'available' },
    ];

    const starters = pickProbableStarters(roster);
    expect(starters).toHaveLength(11);
    expect(starters.some((p) => p.fullName === 'Injured')).toBe(false);
  });

  it('isConfirmedSnapshot respeta umbral 9', () => {
    const mk = (n) => ({ players: Array.from({ length: n }, () => ({})) });
    expect(isConfirmedSnapshot({ home: mk(9), away: mk(9) })).toBe(true);
    expect(isConfirmedSnapshot({ home: mk(8), away: mk(9) })).toBe(false);
  });
});

describe('apiFootballLineupClient mergeGridOntoPlayers', () => {
  it('empareja por dorsal', () => {
    const base = [{ name: 'Player', shirtNumber: 10 }];
    const api = [{ name: 'Other', shirtNumber: 10, gridRaw: '3:2' }];
    const merged = mergeGridOntoPlayers(base, api);
    expect(merged[0].gridRaw).toBe('3:2');
  });

  it('rellena dorsal desde API cuando falta en base', () => {
    const base = [{ name: 'Messi', shirtNumber: null }];
    const api = [{ name: 'L. Messi', shirtNumber: 10, gridRaw: '4:2' }];
    const merged = mergeGridOntoPlayers(base, api);
    expect(merged[0].shirtNumber).toBe(10);
    expect(merged[0].gridRaw).toBe('4:2');
  });

  it('no pisa dorsal existente en base', () => {
    const base = [{ name: 'Player', shirtNumber: 7 }];
    const api = [{ name: 'Player', shirtNumber: 10, gridRaw: '3:2' }];
    const merged = mergeGridOntoPlayers(base, api);
    expect(merged[0].shirtNumber).toBe(7);
  });
});
