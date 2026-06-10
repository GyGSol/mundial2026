import { describe, expect, it } from 'vitest';
import {
  applyResolvedKnockoutToMatch,
  indexResolvedKnockoutPhases,
} from '../src/services/predictedMatchContextService.js';

describe('predictedMatchContextService', () => {
  it('indexa partidos de fase final por externalId', () => {
    const map = indexResolvedKnockoutPhases([
      {
        key: 'round_of_32',
        label: 'Dieciseisavos de final',
        matches: [
          {
            externalId: '73',
            homeTeam: { externalId: 'A2', nameEn: 'Team A2' },
            awayTeam: null,
            homeTeamSlotLabel: null,
            awayTeamSlotLabel: '2.º del grupo B',
          },
        ],
      },
    ]);

    expect(map.get('73')?.homeTeam?.externalId).toBe('A2');
    expect(map.get('73')?.awayTeamSlotLabel).toBe('2.º del grupo B');
    expect(map.get('73')?.knockoutPhase).toBe('Dieciseisavos de final');
  });

  it('aplica equipos resueltos al partido enriquecido', () => {
    const base = {
      id: 'mongo1',
      externalId: '90',
      homeTeam: null,
      awayTeam: null,
      group: null,
    };
    const resolved = {
      homeTeam: { externalId: 'A2', nameEn: 'Team A2' },
      awayTeam: { externalId: 'F1', nameEn: 'Team F1' },
      homeTeamSlotLabel: null,
      awayTeamSlotLabel: null,
      knockoutPhase: 'Octavos de final',
    };

    const enriched = applyResolvedKnockoutToMatch(base, resolved);

    expect(enriched.isKnockout).toBe(true);
    expect(enriched.knockoutPhase).toBe('Octavos de final');
    expect(enriched.homeTeam.externalId).toBe('A2');
    expect(enriched.awayTeam.externalId).toBe('F1');
  });
});
