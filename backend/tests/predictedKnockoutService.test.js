import { describe, it, expect } from 'vitest';
import { buildPredictedKnockoutPhases } from '../src/services/predictedKnockoutService.js';
import { GROUP_LETTERS } from '../src/services/simulationTournamentService.js';

function mockTeam(group, slot) {
  return {
    externalId: `${group}${slot}`,
    nameEn: `Team ${group}${slot}`,
    fifaCode: `${group}${slot}`,
    group,
    flag: '',
  };
}

function mockTeams() {
  const teams = [];
  for (const group of GROUP_LETTERS) {
    for (let slot = 1; slot <= 4; slot += 1) {
      teams.push(mockTeam(group, slot));
    }
  }
  return teams;
}

function completeGroupStandings() {
  return GROUP_LETTERS.map((group) => ({
    group,
    standings: [
      {
        teamId: `${group}1`,
        nameEn: `Team ${group}1`,
        points: 9,
        goalDiff: 3,
        goalsFor: 5,
        played: 3,
        rank: 1,
      },
      {
        teamId: `${group}2`,
        nameEn: `Team ${group}2`,
        points: 6,
        goalDiff: 1,
        goalsFor: 4,
        played: 3,
        rank: 2,
      },
      {
        teamId: `${group}3`,
        nameEn: `Team ${group}3`,
        points: 3,
        goalDiff: 0,
        goalsFor: 3,
        played: 3,
        rank: 3,
      },
      {
        teamId: `${group}4`,
        nameEn: `Team ${group}4`,
        points: 0,
        goalDiff: -4,
        goalsFor: 1,
        played: 3,
        rank: 4,
      },
    ],
  }));
}

function knockoutMatch(externalId, homeLabel, awayLabel, type = 'r32') {
  return {
    _id: `m${externalId}`,
    externalId: String(externalId),
    homeTeamId: '0',
    awayTeamId: '0',
    homeScore: 0,
    awayScore: 0,
    type,
    status: 'upcoming',
    raw: {
      home_team_label: homeLabel,
      away_team_label: awayLabel,
    },
  };
}

function findMatch(phases, externalId) {
  for (const phase of phases) {
    const match = phase.matches.find((entry) => entry.externalId === String(externalId));
    if (match) return match;
  }
  return null;
}

describe('predictedKnockoutService', () => {
  it('resuelve dieciseisavos con 1º y 2º de grupo', () => {
    const teams = mockTeams();
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const knockoutMatches = [
      knockoutMatch(73, 'Runner-up Group A', 'Runner-up Group B'),
      knockoutMatch(75, 'Winner Group F', 'Runner-up Group C'),
    ];

    const { phases } = buildPredictedKnockoutPhases({
      groupStandings: completeGroupStandings(),
      knockoutMatches,
      predictionsByMatchId: new Map(),
      teamMap,
    });

    const m73 = findMatch(phases, 73);
    expect(m73.homeTeam?.externalId).toBe('A2');
    expect(m73.awayTeam?.externalId).toBe('B2');

    const m75 = findMatch(phases, 75);
    expect(m75.homeTeam?.externalId).toBe('F1');
    expect(m75.awayTeam?.externalId).toBe('C2');
  });

  it('propaga ganadores predichos a octavos de final', () => {
    const teams = mockTeams();
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const knockoutMatches = [
      knockoutMatch(73, 'Runner-up Group A', 'Runner-up Group B'),
      knockoutMatch(75, 'Winner Group F', 'Runner-up Group C'),
      knockoutMatch(90, 'Winner Match 73', 'Winner Match 75', 'r16'),
    ];

    const predictionsByMatchId = new Map([
      ['m73', { homeGoals: 2, awayGoals: 1, userSubmitted: true }],
      ['m75', { homeGoals: 1, awayGoals: 0, userSubmitted: true }],
    ]);

    const { phases } = buildPredictedKnockoutPhases({
      groupStandings: completeGroupStandings(),
      knockoutMatches,
      predictionsByMatchId,
      teamMap,
    });

    const m90 = findMatch(phases, 90);
    expect(m90.homeTeam?.externalId).toBe('A2');
    expect(m90.awayTeam?.externalId).toBe('F1');
  });

  it('no propaga ganador con empate predicho', () => {
    const teams = mockTeams();
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const knockoutMatches = [
      knockoutMatch(73, 'Runner-up Group A', 'Runner-up Group B'),
      knockoutMatch(75, 'Winner Group F', 'Runner-up Group C'),
      knockoutMatch(90, 'Winner Match 73', 'Winner Match 75', 'r16'),
    ];

    const predictionsByMatchId = new Map([
      ['m73', { homeGoals: 1, awayGoals: 1, userSubmitted: true }],
      ['m75', { homeGoals: 1, awayGoals: 0, userSubmitted: true }],
    ]);

    const { phases } = buildPredictedKnockoutPhases({
      groupStandings: completeGroupStandings(),
      knockoutMatches,
      predictionsByMatchId,
      teamMap,
    });

    const m90 = findMatch(phases, 90);
    expect(m90.homeTeam).toBeNull();
    expect(m90.homeTeamSlotLabel).toBe('Ganador de A2 vs B2');
    expect(m90.homeTeamSlotSourceMatch).toEqual({
      homeTeam: expect.objectContaining({ externalId: 'A2', fifaCode: 'A2' }),
      awayTeam: expect.objectContaining({ externalId: 'B2', fifaCode: 'B2' }),
      homeTeamSlotLabel: null,
      awayTeamSlotLabel: null,
    });
    expect(m90.awayTeam?.externalId).toBe('F1');
  });

  it('prioriza resultado real finalizado sobre predicción', () => {
    const teams = mockTeams();
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const knockoutMatches = [
      {
        ...knockoutMatch(73, 'Runner-up Group A', 'Runner-up Group B'),
        homeTeamId: 'A2',
        awayTeamId: 'B2',
        homeScore: 0,
        awayScore: 2,
        status: 'finished',
      },
      knockoutMatch(90, 'Winner Match 73', 'Winner Match 75', 'r16'),
    ];

    const predictionsByMatchId = new Map([
      ['m73', { homeGoals: 3, awayGoals: 0, userSubmitted: true }],
    ]);

    const { phases } = buildPredictedKnockoutPhases({
      groupStandings: completeGroupStandings(),
      knockoutMatches,
      predictionsByMatchId,
      teamMap,
    });

    const m90 = findMatch(phases, 90);
    expect(m90.homeTeam?.externalId).toBe('B2');
  });

  it('muestra etiquetas cuando faltan datos de grupo', () => {
    const teams = mockTeams();
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const partialStandings = [
      {
        group: 'A',
        standings: [
          {
            teamId: 'A1',
            nameEn: 'Team A1',
            points: 3,
            goalDiff: 1,
            goalsFor: 2,
            played: 1,
            rank: 1,
          },
          {
            teamId: 'A2',
            nameEn: 'Team A2',
            points: 0,
            goalDiff: -1,
            goalsFor: 1,
            played: 1,
            rank: 2,
          },
        ],
      },
    ];

    const { phases } = buildPredictedKnockoutPhases({
      groupStandings: partialStandings,
      knockoutMatches: [knockoutMatch(73, 'Runner-up Group A', 'Runner-up Group B')],
      predictionsByMatchId: new Map(),
      teamMap,
    });

    const m73 = findMatch(phases, 73);
    expect(m73.homeTeam?.externalId).toBe('A2');
    expect(m73.awayTeam).toBeNull();
    expect(m73.awayTeamSlotLabel).toBe('2.º del grupo B');
  });

  it('resuelve terceros puestos con combinación Annex C', () => {
    const teams = mockTeams();
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const standings = completeGroupStandings();
    for (const group of ['A', 'B', 'C', 'D']) {
      const table = standings.find((entry) => entry.group === group);
      table.standings[2].points = 0;
      table.standings[2].goalDiff = -3;
    }

    const { phases, thirdPlaceCombinationKey } = buildPredictedKnockoutPhases({
      groupStandings: standings,
      knockoutMatches: [
        knockoutMatch(74, 'Winner Group E', 'Best 3rd place Group A/B/C/D/F'),
      ],
      predictionsByMatchId: new Map(),
      teamMap,
    });

    expect(thirdPlaceCombinationKey).toBe('EFGHIJKL');
    const m74 = findMatch(phases, 74);
    expect(m74.homeTeam?.externalId).toBe('E1');
    expect(m74.awayTeam?.externalId).toBe('F3');
  });

  it('muestra perdedores de semifinal en tercer puesto con banderas del partido fuente', () => {
    const teams = mockTeams();
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const knockoutMatches = [
      knockoutMatch(101, 'Winner Group A', 'Winner Group B', 'semi_final'),
      knockoutMatch(102, 'Winner Group C', 'Winner Group D', 'semi_final'),
      knockoutMatch(103, 'Loser Match 101', 'Loser Match 102', 'third_place'),
    ];

    const { phases } = buildPredictedKnockoutPhases({
      groupStandings: completeGroupStandings(),
      knockoutMatches,
      predictionsByMatchId: new Map(),
      teamMap,
    });

    const m103 = findMatch(phases, 103);
    expect(m103.homeTeam).toBeNull();
    expect(m103.homeTeamSlotLabel).toBe('Perdedor de A1 vs B1');
    expect(m103.homeTeamSlotSourceMatch.homeTeam?.externalId).toBe('A1');
    expect(m103.homeTeamSlotSourceMatch.awayTeam?.externalId).toBe('B1');
    expect(m103.awayTeamSlotLabel).toBe('Perdedor de C1 vs D1');
  });
});
