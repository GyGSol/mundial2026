import { describe, expect, it } from 'vitest';
import {
  classifyFinishTier,
  computeNationMetrics,
  computePedigreeIndex,
  isValidWikiRecord,
  sanitizeWikiRecords,
} from '../src/services/worldCupDataCenterService.js';
import { getWorldCupHistory } from '../src/services/worldCupHistoryService.js';

describe('worldCupDataCenterService', () => {
  it('isValidWikiRecord descarta filas con wikitext inválido', () => {
    expect(isValidWikiRecord({ year: 1938, round: "rowspan=3 | Withdrew", played: null })).toBe(false);
    expect(
      isValidWikiRecord({
        year: 2022,
        round: 'Champions',
        played: 7,
        won: 4,
        goalsFor: 12,
        goalsAgainst: 5,
      })
    ).toBe(true);
  });

  it('classifyFinishTier mapea fases', () => {
    expect(classifyFinishTier({ round: 'Champions', position: '1st' })).toBe('champion');
    expect(classifyFinishTier({ round: 'Runners-up', position: '2nd' })).toBe('final');
    expect(classifyFinishTier({ round: 'Quarter-finals' })).toBe('quarter');
    expect(classifyFinishTier({ round: 'Group stage' })).toBe('group');
  });

  it('computePedigreeIndex pondera títulos y ranking', () => {
    const high = computePedigreeIndex({
      worldCupTitles: 3,
      finalsPlayed: 4,
      deepRunRate: 0.8,
      winRate: 0.6,
      fifaRank: 1,
    });
    const low = computePedigreeIndex({
      worldCupTitles: 0,
      finalsPlayed: 0,
      deepRunRate: 0.1,
      winRate: 0.3,
      fifaRank: 40,
    });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });

  it('computeNationMetrics para Argentina incluye apariciones', async () => {
    const history = await getWorldCupHistory();
    const metrics = computeNationMetrics('ARG', history, { fifaRank: 10 });
    expect(metrics.fifaCode).toBe('ARG');
    expect(metrics.appearances).toBeGreaterThan(0);
    expect(metrics.pedigreeIndex).toBeGreaterThan(50);
    expect(metrics.roundCounts.champion).toBeGreaterThan(0);
  });

  it('sanitizeWikiRecords filtra registros basura de ARG', async () => {
    const history = await getWorldCupHistory();
    const raw = history.recordsByNation?.ARG ?? [];
    const clean = sanitizeWikiRecords(raw);
    expect(clean.length).toBeLessThan(raw.length);
    expect(clean.every(isValidWikiRecord)).toBe(true);
  });
});
