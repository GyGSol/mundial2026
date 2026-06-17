import { describe, it, expect } from 'vitest';
import { buildAuditPromptContext } from '../src/services/aiCompetitorAuditService.js';

describe('aiCompetitorAuditService', () => {
  it('buildAuditPromptContext elimina campos internos', () => {
    const ctx = buildAuditPromptContext({
      homeTeam: { name: 'MEX', code: 'MEX' },
      awayTeam: { name: 'RSA', code: 'RSA' },
      _calibrationStats: { partidosAnalizados: 12 },
      externalIntel: { xg: { homeExpected: 1.2 } },
      mercadoYxG: { xgEsperado: { homeExpected: 1.2 } },
    });

    expect(ctx._calibrationStats).toBeUndefined();
    expect(ctx.externalIntel).toBeUndefined();
    expect(ctx.equipoLocal).toBeTruthy();
    expect(ctx.mercadoYxG).toBeTruthy();
  });
});
