import { describe, it, expect } from 'vitest';
import {
  applyOfficialKnockoutDisplay,
  mergeOfficialKnockoutFallback,
} from '../src/services/officialKnockoutDisplayService.js';

describe('officialKnockoutDisplayService', () => {
  it('mergeOfficialKnockoutFallback solo rellena partidos knockout vacíos', () => {
    const enriched = [
      {
        externalId: '93',
        homeTeam: null,
        awayTeam: null,
        homeTeamSlotLabel: null,
        awayTeamSlotLabel: null,
      },
      {
        externalId: '1',
        homeTeam: { externalId: 'A1' },
        awayTeam: { externalId: 'B1' },
      },
    ];

    const official = {
      93: {
        homeTeamSlotLabel: 'Ganador de POR vs CRO',
        homeTeamSlotSourceMatch: {
          homeTeam: { fifaCode: 'POR' },
          awayTeam: { fifaCode: 'CRO' },
        },
        phaseLabel: 'Octavos de final',
      },
    };

    const [knockoutMatch, groupMatch] = mergeOfficialKnockoutFallback(enriched, official);

    expect(knockoutMatch.homeTeamSlotLabel).toBe('Ganador de POR vs CRO');
    expect(knockoutMatch.knockoutPhase).toBe('Octavos de final');
    expect(groupMatch.homeTeam?.externalId).toBe('A1');
  });

  it('KNOCKOUT_CONTEXT_MATCH_SELECT no mezcla exclusión e inclusión de raw', async () => {
    const { KNOCKOUT_CONTEXT_MATCH_SELECT } = await import(
      '../src/services/officialKnockoutDisplayService.js'
    );
    expect(KNOCKOUT_CONTEXT_MATCH_SELECT).not.toMatch(/-raw/);
    expect(KNOCKOUT_CONTEXT_MATCH_SELECT).toContain('raw.home_team_label');
  });

  it('applyOfficialKnockoutDisplay prioriza equipos asignados oficialmente', () => {
    const result = applyOfficialKnockoutDisplay(
      { homeTeam: null, awayTeam: null, homeTeamSlotLabel: 'placeholder' },
      {
        homeTeam: { externalId: 'POR', nameEn: 'Portugal' },
        awayTeam: { externalId: 'ESP', nameEn: 'Spain' },
        homeTeamSlotLabel: 'ignored',
      }
    );

    expect(result.homeTeam?.externalId).toBe('POR');
    expect(result.awayTeam?.externalId).toBe('ESP');
    expect(result.homeTeamSlotLabel).toBeNull();
  });
});
