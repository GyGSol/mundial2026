import { describe, it, expect } from 'vitest';
import {
  dedupeInjuries,
  filterDbTeamFriendlies,
  filterFixturesByDateRange,
  filterWorldCupFriendlyFixtures,
  resolveFixtureFetchRange,
  shiftDateRangeToSeason,
  getLastMonthDateRange,
  isNationalFriendlyLeagueName,
  mapFixtureStatus,
  normalizeFriendlyFixture,
  pickApiTeamMatch,
  sortFixturesByKickoff,
} from '../src/services/apiFootballStatsService.js';

describe('apiFootballStatsService', () => {
  it('detecta ligas de amistosos de selecciones', () => {
    expect(isNationalFriendlyLeagueName('Friendlies')).toBe(true);
    expect(isNationalFriendlyLeagueName('Friendlies Clubs')).toBe(false);
    expect(isNationalFriendlyLeagueName('Friendlies Women')).toBe(false);
    expect(isNationalFriendlyLeagueName('World Cup')).toBe(false);
  });

  it('filtra amistosos donde ambos equipos son del mundial', () => {
    const wcIds = new Set([10, 20, 30]);
    const fixtures = [
      {
        fixture: { id: 1, date: '2026-03-01T18:00:00+00:00', status: { short: 'FT' } },
        league: { name: 'Friendlies' },
        teams: { home: { id: 10, name: 'A', code: 'AAA' }, away: { id: 20, name: 'B', code: 'BBB' } },
        goals: { home: 2, away: 1 },
      },
      {
        fixture: { id: 2, date: '2026-03-02T18:00:00+00:00', status: { short: 'NS' } },
        league: { name: 'Friendlies' },
        teams: { home: { id: 10, name: 'A', code: 'AAA' }, away: { id: 99, name: 'X', code: 'XXX' } },
        goals: { home: null, away: null },
      },
    ];

    const filtered = filterWorldCupFriendlyFixtures(fixtures, wcIds);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].fixture.id).toBe(1);
  });

  it('normaliza fixture finalizado y programado', () => {
    const finished = normalizeFriendlyFixture({
      fixture: { id: 5, date: '2026-03-10T20:00:00+00:00', status: { short: 'FT', long: 'Match Finished' } },
      league: { name: 'Friendlies' },
      teams: {
        home: { id: 1, name: 'Argentina', code: 'ARG', logo: 'https://x/a.png' },
        away: { id: 2, name: 'Brazil', code: 'BRA', logo: 'https://x/b.png' },
      },
      goals: { home: 1, away: 0 },
    });

    expect(finished.status).toBe('finished');
    expect(finished.homeScore).toBe(1);
    expect(finished.awayScore).toBe(0);

    const scheduled = normalizeFriendlyFixture({
      fixture: { id: 6, date: '2026-04-01T15:00:00+00:00', status: { short: 'NS' } },
      league: { name: 'Friendlies' },
      teams: {
        home: { id: 1, name: 'Argentina', code: 'ARG' },
        away: { id: 2, name: 'Brazil', code: 'BRA' },
      },
      goals: { home: null, away: null },
    });

    expect(scheduled.status).toBe('scheduled');
    expect(scheduled.homeScore).toBeNull();
  });

  it('ordena partidos por fecha descendente', () => {
    const fixtures = [
      { fixture: { date: '2026-03-01T12:00:00Z' } },
      { fixture: { date: '2026-03-15T12:00:00Z' } },
    ];
    const sorted = sortFixturesByKickoff(fixtures, 'desc');
    expect(sorted[0].fixture.date).toContain('03-15');
  });

  it('deduplica lesiones por jugador y equipo', () => {
    const rows = dedupeInjuries([
      { playerId: 1, playerName: 'A', teamId: 10, teamName: 'Argentina' },
      { playerId: 1, playerName: 'A', teamId: 10, teamName: 'Argentina' },
      { playerId: 2, playerName: 'B', teamId: 20, teamName: 'Brazil' },
    ]);
    expect(rows).toHaveLength(2);
  });

  it('calcula rango del último mes', () => {
    const { from, to } = getLastMonthDateRange(new Date('2026-04-05T12:00:00Z'));
    expect(to).toBe('2026-04-05');
    expect(from).toBe('2026-03-06');
  });

  it('mapea estados de partido', () => {
    expect(mapFixtureStatus('FT')).toBe('finished');
    expect(mapFixtureStatus('NS')).toBe('scheduled');
    expect(mapFixtureStatus('LIVE')).toBe('live');
  });

  it('filtra fixtures por rango de fechas', () => {
    const fixtures = [
      { fixture: { date: '2024-05-10T18:00:00+00:00' } },
      { fixture: { date: '2024-03-01T18:00:00+00:00' } },
    ];
    const filtered = filterFixturesByDateRange(fixtures, '2024-05-01', '2024-05-31');
    expect(filtered).toHaveLength(1);
  });

  it('filtra amistosos por código FIFA sin IDs de API', () => {
    const dbTeams = [{ nameEn: 'Argentina', fifaCode: 'ARG' }, { nameEn: 'Brazil', fifaCode: 'BRA' }];
    const fixtures = [
      {
        fixture: { id: 1, date: '2024-05-10T18:00:00+00:00', status: { short: 'FT' } },
        league: { name: 'Friendlies' },
        teams: {
          home: { id: 1, name: 'Argentina', code: 'ARG' },
          away: { id: 2, name: 'Brazil', code: 'BRA' },
        },
        goals: { home: 1, away: 0 },
      },
    ];
    expect(filterDbTeamFriendlies(fixtures, dbTeams)).toHaveLength(1);
  });

  it('corre rango de fechas al año de temporada API', () => {
    expect(shiftDateRangeToSeason('2026-05-05', '2026-06-04', 2024)).toEqual({
      from: '2024-05-05',
      to: '2024-06-04',
    });
  });

  it('amplía ventana de búsqueda en plan free', () => {
    const resolved = resolveFixtureFetchRange('2026-05-05', '2026-06-04', 2024);
    expect(resolved.usedBroadFallback).toBe(true);
    expect(resolved.fetch.from).toBe('2024-02-05');
    expect(resolved.fetch.to).toBe('2024-06-04');
  });

  it('elige selección por código FIFA en búsqueda', () => {
    const rows = [
      { team: { id: 1, name: 'Other', code: 'OTH', national: false } },
      { team: { id: 26, name: 'Argentina', code: 'ARG', national: true } },
    ];
    const team = pickApiTeamMatch(rows, { fifaCode: 'ARG', nameEn: 'Argentina' });
    expect(team.id).toBe(26);
  });
});
