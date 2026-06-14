import { describe, it, expect } from 'vitest';
import {
  aggregationsToTotals,
  inferMatchScope,
  parsePersonMatchEntry,
} from '../src/services/footballDataApiClient.js';
import { buildCompactPerformanceContext } from '../src/services/playerPerformanceContextService.js';

describe('footballDataApiClient performance parsing', () => {
  it('detecta partidos de selección por competición', () => {
    expect(inferMatchScope('World Cup Qualification UEFA', 'WCQ')).toBe('national');
    expect(inferMatchScope('Premier League', 'PL')).toBe('club');
  });

  it('parsea goles, minutos y tarjetas de un partido', () => {
    const parsed = parsePersonMatchEntry({
      utcDate: '2026-03-10T20:00:00Z',
      homeTeam: { shortName: 'ARG' },
      awayTeam: { shortName: 'BRA' },
      score: { fullTime: { home: 2, away: 1 } },
      competition: { name: 'World Cup Qualification', code: 'WCQ' },
      goals: 1,
      assists: 1,
      minutes: 87,
      yellowCards: 1,
      lineup: 'STARTING',
    });

    expect(parsed.scope).toBe('national');
    expect(parsed.goals).toBe(1);
    expect(parsed.minutes).toBe(87);
    expect(parsed.yellowCards).toBe(1);
    expect(parsed.started).toBe(true);
  });

  it('convierte agregaciones de la API', () => {
    expect(
      aggregationsToTotals({
        matchesOnPitch: 10,
        startingXI: 8,
        minutesPlayed: 720,
        goals: 3,
        assists: 2,
        yellowCards: 2,
        redCards: 0,
        yellowRedCards: 1,
      })
    ).toMatchObject({
      matches: 10,
      starts: 8,
      minutes: 720,
      goals: 3,
      assists: 2,
      yellowCards: 2,
      redCards: 1,
    });
  });
});

describe('playerPerformanceContextService', () => {
  it('arma contexto compacto con club, selección y últimos partidos', () => {
    const context = buildCompactPerformanceContext({
      performanceSnapshot: {
        seasonYear: 2026,
        fetchedAt: new Date('2026-06-01'),
        source: 'football-data.org',
        club: {
          matches: 30,
          starts: 28,
          minutes: 2500,
          goals: 5,
          assists: 4,
          yellowCards: 6,
          redCards: 0,
        },
        nationalTeam: {
          matches: 4,
          starts: 4,
          minutes: 360,
          goals: 1,
          assists: 0,
          yellowCards: 1,
          redCards: 0,
        },
        recentMatches: [
          {
            date: '2026-05-20',
            opponent: 'ARG vs CHI',
            result: '2:0',
            minutes: 90,
            goals: 1,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
            scope: 'national',
            competition: 'World Cup Qualification',
          },
        ],
      },
    });

    expect(context.club.PJ).toBe(30);
    expect(context.club.minutos).toBe(2500);
    expect(context.seleccion.goles).toBe(1);
    expect(context.acumuladoTemporada.minutos).toBe(2860);
    expect(context.ultimosPartidos).toHaveLength(1);
    expect(context.club.kmPromedioPartido).toBeGreaterThan(0);
  });
});
