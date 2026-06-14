import { describe, expect, it } from 'vitest';
import {
  compareThirdPlaces,
  rankBestThirdPlaceTeams,
} from '../src/services/thirdPlaceRanking.js';

function thirdRow(group, overrides = {}) {
  return {
    teamId: `${group}3`,
    rank: 3,
    fifaCode: overrides.fifaCode,
    played: overrides.played ?? 3,
    points: overrides.points ?? 0,
    goalDiff: overrides.goalDiff ?? 0,
    goalsFor: overrides.goalsFor ?? 0,
    goalsAgainst: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    nameEn: `Team ${group}3`,
    ...overrides,
  };
}

function buildGroupStandings(thirdOverridesByGroup = {}) {
  return 'ABCDEFGHIJKL'.split('').map((group) => ({
    group,
    standings: [
      { teamId: `${group}1`, rank: 1, played: 3, points: 9, goalDiff: 3, goalsFor: 5 },
      { teamId: `${group}2`, rank: 2, played: 3, points: 6, goalDiff: 1, goalsFor: 4 },
      thirdRow(group, thirdOverridesByGroup[group] ?? {}),
      { teamId: `${group}4`, rank: 4, played: 3, points: 0, goalDiff: -4, goalsFor: 1 },
    ],
  }));
}

describe('thirdPlaceRanking', () => {
  it('ordena por puntos, dif. de goles y goles a favor', () => {
    expect(compareThirdPlaces({ points: 3, goalDiff: 0, goalsFor: 2, group: 'A' }, { points: 4, goalDiff: 0, goalsFor: 1, group: 'B' })).toBeGreaterThan(0);
    expect(compareThirdPlaces({ points: 4, goalDiff: 1, goalsFor: 3, group: 'A' }, { points: 4, goalDiff: 2, goalsFor: 3, group: 'B' })).toBeGreaterThan(0);
    expect(compareThirdPlaces({ points: 4, goalDiff: 1, goalsFor: 2, group: 'A' }, { points: 4, goalDiff: 1, goalsFor: 3, group: 'B' })).toBeGreaterThan(0);
  });

  it('marca los 8 mejores terceros y genera combinationKey cuando la fase de grupos está completa', () => {
    const standings = buildGroupStandings({
      A: { points: 6, goalDiff: 2, goalsFor: 5 },
      B: { points: 6, goalDiff: 1, goalsFor: 4 },
      C: { points: 5, goalDiff: 1, goalsFor: 4 },
      D: { points: 5, goalDiff: 0, goalsFor: 3 },
      E: { points: 4, goalDiff: 1, goalsFor: 3 },
      F: { points: 4, goalDiff: 0, goalsFor: 3 },
      G: { points: 3, goalDiff: 0, goalsFor: 3 },
      H: { points: 3, goalDiff: -1, goalsFor: 2 },
      I: { points: 2, goalDiff: 0, goalsFor: 2 },
      J: { points: 2, goalDiff: -1, goalsFor: 1 },
      K: { points: 1, goalDiff: -2, goalsFor: 1 },
      L: { points: 0, goalDiff: -3, goalsFor: 0 },
    });

    const result = rankBestThirdPlaceTeams(standings);

    expect(result.ranked).toHaveLength(12);
    expect(result.qualified).toHaveLength(8);
    expect(result.qualified.every((row) => row.qualifies)).toBe(true);
    expect(result.provisional).toBe(false);
    expect(result.combinationKey).toBe('ABCDEFGH');
    expect(result.ranked[0].group).toBe('A');
    expect(result.ranked[7].group).toBe('H');
    expect(result.ranked[8].qualifies).toBe(false);
  });

  it('es provisional si faltan partidos pero igual calcula Annex C', () => {
    const standings = buildGroupStandings({
      B: { played: 1, points: 3, goalsFor: 3 },
    });
    standings[0].standings[2].played = 0;
    standings[0].standings[2].points = 0;

    const result = rankBestThirdPlaceTeams(standings);

    expect(result.provisional).toBe(true);
    expect(result.combinationKey).toBe('ABCDEFGH');
    expect(result.qualified).toHaveLength(8);
    expect(result.qualified.some((row) => row.group === 'B')).toBe(true);
  });

  it('con todos en cero desempata por ranking FIFA', () => {
    const standings = buildGroupStandings({
      A: { played: 0, points: 0, goalDiff: 0, goalsFor: 0, fifaCode: 'GHA' },
      B: { played: 0, points: 0, goalDiff: 0, goalsFor: 0, fifaCode: 'BRA' },
    });
    for (const entry of standings) {
      if (entry.group === 'A' || entry.group === 'B') continue;
      entry.standings[2].played = 0;
      entry.standings[2].points = 0;
      entry.standings[2].goalDiff = 0;
      entry.standings[2].goalsFor = 0;
    }

    const result = rankBestThirdPlaceTeams(standings);

    expect(result.ranked[0].group).toBe('B');
    expect(result.ranked.find((row) => row.group === 'A')?.thirdRank).toBeGreaterThan(1);
    expect(result.combinationKey).toBeTruthy();
    expect(result.qualified).toHaveLength(8);
  });

  it('desempata empate total con partidos jugados por letra de grupo', () => {
    expect(
      compareThirdPlaces(
        { points: 0, goalDiff: 0, goalsFor: 0, group: 'B' },
        { points: 0, goalDiff: 0, goalsFor: 0, group: 'A' }
      )
    ).toBeGreaterThan(0);
  });
});
