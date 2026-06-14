import { describe, it, expect } from 'vitest';
import {
  getNationWorldCupRecords,
  buildNationHistoricalSummary,
} from '../src/services/worldCupHistoryService.js';

describe('worldCupHistoryService nation records', () => {
  it('getNationWorldCupRecords devuelve array (vacío si no hay sync)', async () => {
    const records = await getNationWorldCupRecords('GER');
    expect(Array.isArray(records)).toBe(true);
  });

  it('buildNationHistoricalSummary combina perfil y finales', async () => {
    const summary = await buildNationHistoricalSummary('GER');
    expect(summary.fifaCode).toBe('GER');
    expect(summary.worldCupTitles).toBeGreaterThan(0);
    expect(summary.profileNote).toMatch(/Campeón|2014/i);
    expect(Array.isArray(summary.finalHighlights)).toBe(true);
    expect(Array.isArray(summary.wikiRecords)).toBe(true);
  });

  it('buildNationHistoricalSummary para debutante', async () => {
    const summary = await buildNationHistoricalSummary('CUW');
    expect(summary.fifaCode).toBe('CUW');
    expect(summary.worldCupAppearances).toBe(1);
    expect(summary.profileNote).toMatch(/Primer mundial|2026/i);
  });
});
