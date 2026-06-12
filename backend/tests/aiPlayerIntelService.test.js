import { describe, it, expect } from 'vitest';
import { mergePlayerWithIntel } from '../src/services/aiPlayerIntelService.js';

describe('aiPlayerIntelService', () => {
  describe('mergePlayerWithIntel', () => {
    const basePlayer = {
      id: '1',
      externalId: 'ARG-lionel-messi',
      fullName: 'Lionel Messi',
      healthStatus: 'available',
      healthLabel: 'Disponible',
      isStarter: false,
    };

    it('marca jugador sin intel como sin datos IA', () => {
      const merged = mergePlayerWithIntel(basePlayer, null);
      expect(merged.healthStatus).toBe('unknown');
      expect(merged.healthLabel).toBe('Sin datos IA');
      expect(merged.intelStale).toBe(true);
    });

    it('sobrescribe estado con intel de IA', () => {
      const merged = mergePlayerWithIntel(basePlayer, {
        healthStatus: 'doubt',
        injuryInfo: 'Molestia muscular',
        yellowCards: 1,
        redCards: 0,
        suspended: false,
        suspensionInfo: '',
        isStarter: true,
        source: 'cerebras',
        model: 'gpt-oss-120b',
        fetchedAt: new Date(),
        aiSummary: 'Duda para el debut',
        notes: '',
      });

      expect(merged.healthStatus).toBe('doubt');
      expect(merged.healthLabel).toBe('Duda');
      expect(merged.injuryInfo).toBe('Molestia muscular');
      expect(merged.yellowCards).toBe(1);
      expect(merged.isStarter).toBe(true);
      expect(merged.intelSource).toBe('cerebras');
    });
  });
});
