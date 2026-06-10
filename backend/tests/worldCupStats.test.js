import { describe, it, expect } from 'vitest';
import {
  annotateGroupQualification,
  computeGroupStandings,
  buildKnockoutPhases,
  computeTournamentStats,
  formatKnockoutSlotLabelEs,
} from '../src/services/worldCupStatsService.js';

const teams = [
  { externalId: '1', nameEn: 'Mexico', fifaCode: 'MEX', group: 'A', flag: '🇲🇽' },
  { externalId: '2', nameEn: 'South Africa', fifaCode: 'RSA', group: 'A', flag: '🇿🇦' },
  { externalId: '3', nameEn: 'Brazil', fifaCode: 'BRA', group: 'A', flag: '🇧🇷' },
  { externalId: '4', nameEn: 'Morocco', fifaCode: 'MAR', group: 'A', flag: '🇲🇦' },
];

describe('worldCupStatsService', () => {
  it('calcula tabla de posiciones de grupo desde partidos finalizados', () => {
    const matches = [
      {
        externalId: '1',
        homeTeamId: '1',
        awayTeamId: '2',
        homeScore: 2,
        awayScore: 1,
        group: 'A',
        type: 'group',
        status: 'finished',
      },
      {
        externalId: '2',
        homeTeamId: '3',
        awayTeamId: '4',
        homeScore: 0,
        awayScore: 0,
        group: 'A',
        type: 'group',
        status: 'finished',
      },
    ];

    const result = computeGroupStandings(teams, matches);
    expect(result).toHaveLength(1);
    expect(result[0].group).toBe('A');
    expect(result[0].standings[0].teamId).toBe('1');
    expect(result[0].standings[0].points).toBe(3);
    expect(result[0].standings.find((row) => row.teamId === '3')?.points).toBe(1);
  });

  it('prioriza simulación y oculta placeholders oficiales cuando hay sim-*', () => {
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const matches = [
      {
        externalId: '73',
        homeTeamId: '0',
        awayTeamId: '0',
        homeScore: 0,
        awayScore: 0,
        type: 'r32',
        status: 'upcoming',
        kickoffAt: new Date('2026-07-01T00:00:00Z'),
        raw: {
          home_team_label: 'Winner Group A',
          away_team_label: 'Runner-up Group B',
        },
      },
      {
        externalId: 'sim-run-1',
        homeTeamId: '1',
        awayTeamId: '2',
        homeScore: 2,
        awayScore: 1,
        type: 'r32',
        status: 'finished',
        kickoffAt: new Date('2026-07-01T01:00:00Z'),
      },
      {
        externalId: '74',
        homeTeamId: '3',
        awayTeamId: '4',
        homeScore: 1,
        awayScore: 0,
        type: 'r32',
        status: 'finished',
        kickoffAt: new Date('2026-07-01T02:00:00Z'),
      },
    ];

    const phases = buildKnockoutPhases(matches, teamMap);
    expect(phases).toHaveLength(1);
    expect(phases[0].matches).toHaveLength(1);
    expect(phases[0].matches[0].externalId).toBe('sim-run-1');
  });

  it('incluye placeholders oficiales con etiquetas de cruce cuando no hay simulación', () => {
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const matches = [
      {
        externalId: '73',
        homeTeamId: '0',
        awayTeamId: '0',
        homeScore: 0,
        awayScore: 0,
        type: 'r32',
        status: 'upcoming',
        kickoffAt: new Date('2026-07-01T00:00:00Z'),
        raw: {
          home_team_label: 'Winner Group F',
          away_team_label: 'Runner-up Group A',
        },
      },
    ];

    const phases = buildKnockoutPhases(matches, teamMap);
    expect(phases).toHaveLength(1);
    expect(phases[0].matches).toHaveLength(1);
    expect(phases[0].matches[0].homeTeam).toBeNull();
    expect(phases[0].matches[0].awayTeam).toBeNull();
    expect(phases[0].matches[0].homeTeamSlotLabel).toBe('1.º del grupo F');
    expect(phases[0].matches[0].awayTeamSlotLabel).toBe('2.º del grupo A');
  });

  it('traduce etiquetas de cruces eliminatorios al español', () => {
    expect(formatKnockoutSlotLabelEs('Winner Group F')).toBe('1.º del grupo F');
    expect(formatKnockoutSlotLabelEs('Runner-up Group A')).toBe('2.º del grupo A');
    expect(formatKnockoutSlotLabelEs('Winner Match 73')).toBe('Ganador del partido 73');
    expect(formatKnockoutSlotLabelEs('Loser Match 101')).toBe('Perdedor del partido 101');
  });

  it('agrupa partidos de fase final por ronda', () => {
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const matches = [
      {
        externalId: 'k1',
        homeTeamId: '1',
        awayTeamId: '2',
        homeScore: 1,
        awayScore: 0,
        type: 'round_of_16',
        status: 'finished',
        kickoffAt: new Date('2026-07-01T00:00:00Z'),
      },
      {
        externalId: 'k2',
        homeTeamId: '3',
        awayTeamId: '4',
        homeScore: 2,
        awayScore: 2,
        type: 'quarter_final',
        status: 'finished',
        kickoffAt: new Date('2026-07-05T00:00:00Z'),
      },
    ];

    const phases = buildKnockoutPhases(matches, teamMap);
    expect(phases).toHaveLength(2);
    expect(phases[0].label).toBe('Octavos de final');
    expect(phases[1].label).toBe('Cuartos de final');
  });

  it('resume estadísticas generales del torneo', () => {
    const matches = [
      {
        externalId: '1',
        homeTeamId: '1',
        awayTeamId: '2',
        homeScore: 3,
        awayScore: 1,
        group: 'A',
        type: 'group',
        status: 'finished',
      },
      {
        externalId: '2',
        homeTeamId: '3',
        awayTeamId: '4',
        homeScore: 1,
        awayScore: 1,
        group: 'A',
        type: 'group',
        status: 'finished',
      },
      {
        externalId: '3',
        homeTeamId: '1',
        awayTeamId: '3',
        homeScore: 0,
        awayScore: 0,
        group: 'A',
        type: 'group',
        status: 'upcoming',
      },
    ];

    const stats = computeTournamentStats(matches, teams);
    expect(stats.matches.total).toBe(3);
    expect(stats.matches.finished).toBe(2);
    expect(stats.matches.upcoming).toBe(1);
    expect(stats.goals.total).toBe(6);
    expect(stats.goals.averagePerMatch).toBe(3);
    expect(stats.goals.topScoringTeams[0].teamId).toBe('1');
  });

  it('marca zonas de clasificación por puesto en el grupo', () => {
    const letters = 'ABCDEFGHIJKL'.split('');
    const standings = letters.map((group) => ({
      group,
      standings: [
        { teamId: `${group}1`, rank: 1, played: 0, points: 0, goalDiff: 0, goalsFor: 0 },
        { teamId: `${group}2`, rank: 2, played: 0, points: 0, goalDiff: 0, goalsFor: 0 },
        {
          teamId: `${group}3`,
          rank: 3,
          played: 0,
          points: group === 'A' ? 0 : 3,
          goalDiff: 0,
          goalsFor: group === 'A' ? 0 : 3,
        },
        { teamId: `${group}4`, rank: 4, played: 0, points: 0, goalDiff: 0, goalsFor: 0 },
      ],
    }));

    const annotated = annotateGroupQualification(standings);
    const groupA = annotated.find((entry) => entry.group === 'A');
    const groupB = annotated.find((entry) => entry.group === 'B');

    expect(groupA.standings[0].qualificationZone).toBe('direct');
    expect(groupA.standings[1].qualificationZone).toBe('direct');
    expect(groupA.standings[2].qualificationZone).toBe('third_possible');
    expect(groupA.standings[3].qualificationZone).toBeNull();
    expect(groupB.standings[2].qualificationZone).toBe('third_provisional');
  });
});
