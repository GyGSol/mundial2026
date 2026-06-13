import { describe, it, expect } from 'vitest';
import { normalizeBriefingPayload } from '../src/services/aiWorldCupStatsService.js';

describe('aiWorldCupStatsService', () => {
  describe('normalizeBriefingPayload', () => {
    it('filtra filas vacias y limita cantidad', () => {
      const normalized = normalizeBriefingPayload({
        overview: 'Resumen del torneo',
        newsDigest: 'Clima informativo',
        keyNumbers: [{ label: 'Equipos', value: '48', note: '' }, { label: '', value: '' }],
        records: [{ title: 'Mas goles', description: 'Pendiente' }],
        trivia: ['  Dato  ', ''],
        phaseSummaries: [{ phase: 'Grupos', summary: 'En curso' }],
        hostFacts: ['Tres paises anfitriones'],
      });

      expect(normalized.overview).toBe('Resumen del torneo');
      expect(normalized.keyNumbers).toHaveLength(1);
      expect(normalized.trivia).toEqual(['Dato']);
      expect(normalized.hostFacts).toHaveLength(1);
    });
  });
});
