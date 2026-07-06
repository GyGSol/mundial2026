import { describe, expect, it } from 'vitest';
import {
  applyShuffledMatchAssignmentsToRounds,
  areConsecutiveExternalIds,
  buildEmptyBracketRounds,
  getDuelWorldCupExternalIds,
  reconcileWorldCupMatchAssignments,
  shuffleNonConsecutiveDuelPairs,
  shuffleWorldCupMatchAssignmentsForRound,
} from '../../shared/fubolsCupBracket.js';

function sortExternalIds(ids) {
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

describe('fubolsCupBracket shuffle', () => {
  it('mezcla partidos de forma determinística con la misma semilla', () => {
    const a = shuffleWorldCupMatchAssignmentsForRound('quarter_final', 'seed-abc');
    const b = shuffleWorldCupMatchAssignmentsForRound('quarter_final', 'seed-abc');
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    expect(a.flat().sort()).toEqual(['89', '90', '91', '92', '93', '94', '95', '96']);
  });

  it('no asigna IDs consecutivos en el mismo cruce de cuartos', () => {
    const assignments = shuffleWorldCupMatchAssignmentsForRound('quarter_final', 'seed-non-consecutive');
    for (const pair of assignments) {
      expect(pair).toHaveLength(2);
      expect(areConsecutiveExternalIds(pair[0], pair[1])).toBe(false);
    }
  });

  it('shuffleNonConsecutiveDuelPairs evita pares 91+92', () => {
    const pairs = shuffleNonConsecutiveDuelPairs(
      ['89', '90', '91', '92', '93', '94', '95', '96'],
      4,
      'test'
    );
    expect(pairs).toHaveLength(4);
    for (const pair of pairs) {
      expect(areConsecutiveExternalIds(pair[0], pair[1])).toBe(false);
    }
  });

  it('asigna worldCupExternalIds por duelo al aplicar shuffle', () => {
    const rounds = buildEmptyBracketRounds();
    applyShuffledMatchAssignmentsToRounds(rounds, 'preview:group-1');
    const cuartos = rounds[0];
    expect(cuartos.roundKey).toBe('quarter_final');
    expect(cuartos.duels.every((d) => d.worldCupExternalIds?.length === 2)).toBe(true);
    expect(
      cuartos.duels
        .flatMap((d) => d.worldCupExternalIds)
        .sort()
    ).toEqual(['89', '90', '91', '92', '93', '94', '95', '96']);
    for (const duel of cuartos.duels) {
      const [a, b] = duel.worldCupExternalIds;
      expect(areConsecutiveExternalIds(a, b)).toBe(false);
    }
    expect(getDuelWorldCupExternalIds(cuartos, 0)).toEqual(cuartos.duels[0].worldCupExternalIds);
  });

  it('define cuartos, semis, cuadro perdedores y final', () => {
    const rounds = buildEmptyBracketRounds();
    expect(rounds.map((r) => r.roundKey)).toEqual([
      'quarter_final',
      'semi_final',
      'losers_semifinal',
      'losers_final',
      'final',
    ]);
    expect(rounds[0].duels).toHaveLength(4);
    expect(rounds[0].worldCupExternalIds).toEqual([
      '89', '90', '91', '92', '93', '94', '95', '96',
    ]);
    expect(rounds[1].duels).toHaveLength(2);
    expect(rounds[1].worldCupExternalIds).toEqual(['97', '98', '99', '100']);
    expect(rounds[2].duels).toHaveLength(2);
    expect(rounds[2].worldCupExternalIds).toEqual(['97', '98', '99', '100']);
    expect(rounds[3].duels).toHaveLength(2);
    expect(rounds[3].worldCupExternalIds).toEqual(['103']);
    expect(rounds[3].duels.every((d) => d.worldCupExternalIds === null)).toBe(true);
    expect(rounds[4].duels).toHaveLength(1);
    expect(rounds[4].worldCupExternalIds).toEqual(['101', '102', '104']);
  });

  it('semifinales usan cuartos WC 97-100 con 2 partidos por duelo', () => {
    const assignments = shuffleWorldCupMatchAssignmentsForRound('semi_final', 'seed-semis');
    expect(assignments).toHaveLength(2);
    expect(sortExternalIds(assignments.flat())).toEqual(['97', '98', '99', '100']);
    for (const pair of assignments) {
      expect(pair).toHaveLength(2);
      expect(areConsecutiveExternalIds(pair[0], pair[1])).toBe(false);
    }
  });

  it('final asigna los 3 partidos WC en orden cronológico (101, 102, 104)', () => {
    const a = shuffleWorldCupMatchAssignmentsForRound('final', 'seed-final');
    const b = shuffleWorldCupMatchAssignmentsForRound('final', 'other-seed');
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
    expect(a[0]).toEqual(['101', '102', '104']);
  });

  it('losers_final asigna partido 103 a ambos cruces', () => {
    const assignments = shuffleWorldCupMatchAssignmentsForRound('losers_final', 'seed-lf');
    expect(assignments).toEqual([['103'], ['103']]);
  });

  it('sincroniza partidos de semifinal de perdedores con semifinales ganadoras', () => {
    const rounds = buildEmptyBracketRounds();
    reconcileWorldCupMatchAssignments(rounds, 'sync-test', { onlyUnresolved: false });
    const semis = rounds.find((r) => r.roundKey === 'semi_final');
    const losersSemis = rounds.find((r) => r.roundKey === 'losers_semifinal');
    const losersFinal = rounds.find((r) => r.roundKey === 'losers_final');
    expect(losersSemis.duels[0].worldCupExternalIds).toEqual(semis.duels[0].worldCupExternalIds);
    expect(losersSemis.duels[1].worldCupExternalIds).toEqual(semis.duels[1].worldCupExternalIds);
    expect(losersFinal.duels.every((d) => d.worldCupExternalIds?.join() === '103')).toBe(true);
  });
});
