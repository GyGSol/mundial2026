import { describe, it, expect } from 'vitest';
import {
  GROUP_LETTERS,
  TOTAL_FULL_TOURNAMENT_MATCHES,
  TOTAL_GROUP_MATCHES,
  TOTAL_KNOCKOUT_MATCHES,
  buildGroupStageFixtures,
  buildNextRoundCrossovers,
  buildQualifierField,
  buildRoundOf32Crossovers,
  buildWinnerEntries,
  organizeTeamsByGroup,
  normalizeGroupLetter,
} from '../src/services/simulationTournamentService.js';

function mockTeams() {
  const teams = [];
  for (const group of GROUP_LETTERS) {
    for (let slot = 1; slot <= 4; slot += 1) {
      teams.push({
        externalId: `${group}${slot}`,
        nameEn: `Team ${group}${slot}`,
        group,
      });
    }
  }
  return teams;
}

describe('simulationTournamentService', () => {
  it('genera 72 partidos de fase de grupos', () => {
    const teamsByGroup = organizeTeamsByGroup(mockTeams());
    const fixtures = buildGroupStageFixtures(teamsByGroup);
    expect(fixtures).toHaveLength(TOTAL_GROUP_MATCHES);
    expect(fixtures.every((fixture) => fixture.type === 'group')).toBe(true);
  });

  it('normaliza letra de grupo desde distintos formatos', () => {
    expect(normalizeGroupLetter('J')).toBe('J');
    expect(normalizeGroupLetter('grupo a')).toBe('A');
    expect(normalizeGroupLetter('Group B')).toBe('B');
  });

  it('ordena partidos por fecha global y luego por zona', () => {
    const teamsByGroup = organizeTeamsByGroup(mockTeams());
    const fixtures = buildGroupStageFixtures(teamsByGroup);

    expect(fixtures[0].globalMatchday).toBe(1);
    expect(fixtures[0].group).toBe('A');
    expect(fixtures[1].group).toBe('A');
    expect(fixtures[2].group).toBe('B');
    expect(fixtures[23].group).toBe('L');
    expect(fixtures[24].globalMatchday).toBe(2);
    expect(fixtures[24].group).toBe('A');
    expect(fixtures[71].globalMatchday).toBe(3);
    expect(fixtures[71].group).toBe('L');
  });

  it('arma 32 clasificados y cruces de dieciseisavos', () => {
    const teams = mockTeams();
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
    const standings = GROUP_LETTERS.map((group) => ({
      group,
      standings: [
        { teamId: `${group}1`, points: 9, goalDiff: 3, goalsFor: 5, rank: 1 },
        { teamId: `${group}2`, points: 6, goalDiff: 1, goalsFor: 4, rank: 2 },
        { teamId: `${group}3`, points: 3, goalDiff: 0, goalsFor: 3, rank: 3 },
        { teamId: `${group}4`, points: 0, goalDiff: -4, goalsFor: 1, rank: 4 },
      ],
    }));

    const qualifiers = buildQualifierField(standings, teamMap);
    expect(qualifiers).toHaveLength(32);
    expect(qualifiers[0].seedLabel).toMatch(/^1/);
    expect(qualifiers[31].seedLabel).toMatch(/^3-/);

    const crossovers = buildRoundOf32Crossovers(qualifiers);
    expect(crossovers).toHaveLength(16);
    expect(crossovers[0].crossover).toContain(' vs ');
    expect(crossovers[0].home.seed).toBe(1);
    expect(crossovers[0].away.seed).toBe(32);
  });

  it('avanza rondas del bracket con cruces W1 vs W2', () => {
    const teamMap = {
      t1: { externalId: 't1', nameEn: 'A' },
      t2: { externalId: 't2', nameEn: 'B' },
      t3: { externalId: 't3', nameEn: 'C' },
      t4: { externalId: 't4', nameEn: 'D' },
    };

    const finished = [
      { externalId: 'sim-1', homeTeamId: 't1', awayTeamId: 't2', homeScore: 2, awayScore: 0 },
      { externalId: 'sim-2', homeTeamId: 't3', awayTeamId: 't4', homeScore: 1, awayScore: 3 },
    ];

    const winners = buildWinnerEntries(finished, teamMap);
    const next = buildNextRoundCrossovers(winners);
    expect(next).toHaveLength(1);
    expect(next[0].crossover).toBe('W1 vs W2');
  });

  it('suma 104 partidos en el mundial completo', () => {
    expect(TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES).toBe(TOTAL_FULL_TOURNAMENT_MATCHES);
    expect(TOTAL_FULL_TOURNAMENT_MATCHES).toBe(104);
  });
});
