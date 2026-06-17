import { describe, it, expect } from 'vitest';
import { buildAuditPromptContext, buildAiCompetitorStats } from '../src/services/aiCompetitorAuditService.js';
import { briefAiReasoning } from '../src/services/aiPromptHumanizer.js';
import { goalDiffScore } from '../src/services/goalDiffStats.js';

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

  it('buildAiCompetitorStats calcula gdifCombinado con difGl y difGv por separado', () => {
    const scored = [
      { pointsEarned: 3, goalDiffHome: 2, goalDiffAway: 0, pointsBreakdown: { winner: 1 } },
      { pointsEarned: 1, goalDiffHome: 0, goalDiffAway: 4, pointsBreakdown: {} },
    ];
    const stats = buildAiCompetitorStats(scored, { predicha: 2, faltante: 0, pendiente: 0 }, 2);

    expect(stats.partidosPuntuados).toBe(2);
    expect(stats.gdifCombinado).toBe(Number(goalDiffScore(2, 4, 2).toFixed(3)));
    expect(stats.gdifObjetivo).toBe(0);
    expect(stats.promedioPuntos).toBe(2);
    expect(stats.tasaAciertoPa).toBe(50);
  });

  it('briefAiReasoning recorta markdown y texto largo', () => {
    const long = `**Portugal** favorito por ranking.\n\n- xG local alto\n- Congo defensivo`;
    const brief = briefAiReasoning(long, 40);
    expect(brief).toContain('Portugal favorito');
    expect(brief?.endsWith('…')).toBe(true);
    expect(briefAiReasoning('  ')).toBeNull();
  });
});
