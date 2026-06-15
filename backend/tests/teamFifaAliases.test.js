import { describe, expect, it } from 'vitest';
import { lookupFifaRankInTable } from '../src/data/teamFifaAliases.js';
import { resolveFifaRank } from '../src/services/groupStandingsUtils.js';

describe('teamFifaAliases ranking lookup', () => {
  it('encuentra ranking con código Mongo KSA vía alias SAU', () => {
    const table = { SAU: 61, URU: 16 };
    expect(lookupFifaRankInTable('KSA', table)).toBe(61);
    expect(lookupFifaRankInTable('SAU', table)).toBe(61);
  });

  it('resolveFifaRank usa alias en standings', () => {
    expect(resolveFifaRank({ fifaCode: 'KSA' })).toBe(61);
  });
});
