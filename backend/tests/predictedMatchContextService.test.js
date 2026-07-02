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

  it('indexa slotSourceMatch para Ganador de con banderas', () => {
    const source = {
      homeTeam: { externalId: 'ARG', fifaCode: 'ARG' },
      awayTeam: { externalId: 'FRA', fifaCode: 'FRA' },
      homeTeamSlotLabel: null,
      awayTeamSlotLabel: null,
    };
    const map = indexResolvedKnockoutPhases([
      {
        key: 'quarter_final',
        label: 'Cuartos de final',
        matches: [
          {
            externalId: '97',
            homeTeam: null,
            awayTeam: null,
            homeTeamSlotLabel: 'Ganador de ARG vs FRA',
            awayTeamSlotLabel: null,
            homeTeamSlotSourceMatch: source,
            awayTeamSlotSourceMatch: null,
          },
        ],
      },
    ]);

    expect(map.get('97')?.homeTeamSlotSourceMatch).toEqual(source);
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

  it('propaga slotSourceMatch cuando el equipo aún no está definido', () => {
    const source = {
      homeTeam: { externalId: 'ARG', fifaCode: 'ARG' },
      awayTeam: { externalId: 'FRA', fifaCode: 'FRA' },
      homeTeamSlotLabel: null,
      awayTeamSlotLabel: null,
    };
    const enriched = applyResolvedKnockoutToMatch(
      { id: 'mongo97', externalId: '97', homeTeam: null, awayTeam: null },
      {
        homeTeam: null,
        awayTeam: null,
        homeTeamSlotLabel: 'Ganador de ARG vs FRA',
        awayTeamSlotLabel: null,
        homeTeamSlotSourceMatch: source,
        awayTeamSlotSourceMatch: null,
        knockoutPhase: 'Cuartos de final',
        knockoutPhaseKey: 'quarter_final',
      }
    );

    expect(enriched.homeTeamSlotSourceMatch).toEqual(source);
    expect(enriched.homeTeamSlotLabel).toBe('Ganador de ARG vs FRA');
  });
});
