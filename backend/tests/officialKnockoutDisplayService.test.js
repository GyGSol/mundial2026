import { describe, it, expect } from 'vitest';
import {
  applyOfficialKnockoutDisplay,
  applyOfficialKnockoutDisplayForUnassignedDbSlots,
  buildOfficialKnockoutDisplayPhases,
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

  it('applyOfficialKnockoutDisplayForUnassignedDbSlots muestra ganador real en un lado y slot en el otro', () => {
    const enriched = {
      externalId: '96',
      homeTeamId: '0',
      awayTeamId: '0',
      homeTeam: { externalId: 'COL', fifaCode: 'COL' },
      awayTeam: { externalId: 'GHA', fifaCode: 'GHA' },
      homeTeamSlotLabel: null,
      awayTeamSlotLabel: null,
    };

    const official = {
      homeTeam: { externalId: 'SUI', fifaCode: 'SUI', nameEn: 'Switzerland' },
      awayTeam: null,
      homeTeamSlotLabel: null,
      awayTeamSlotLabel: 'Ganador de COL vs GHA',
      awayTeamSlotSourceMatch: {
        homeTeam: { fifaCode: 'COL' },
        awayTeam: { fifaCode: 'GHA' },
      },
      phaseLabel: 'Octavos de final',
    };

    const result = applyOfficialKnockoutDisplayForUnassignedDbSlots(enriched, official);

    expect(result.homeTeam?.fifaCode).toBe('SUI');
    expect(result.awayTeam).toBeNull();
    expect(result.awayTeamSlotLabel).toBe('Ganador de COL vs GHA');
  });

  it('buildOfficialKnockoutDisplayPhases propaga ganador de feeder finalizado al octavo', () => {
    const teams = [
      { externalId: 'SUI', nameEn: 'Switzerland', fifaCode: 'SUI', flag: '🇨🇭', group: 'B' },
      { externalId: 'ALG', nameEn: 'Algeria', fifaCode: 'ALG', flag: '🇩🇿', group: 'B' },
      { externalId: 'COL', nameEn: 'Colombia', fifaCode: 'COL', flag: '🇨🇴', group: 'K' },
      { externalId: 'GHA', nameEn: 'Ghana', fifaCode: 'GHA', flag: '🇬🇭', group: 'K' },
    ];
    const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));

    const knockoutMatches = [
      {
        externalId: '86',
        homeTeamId: 'SUI',
        awayTeamId: 'ALG',
        homeScore: 2,
        awayScore: 1,
        type: 'round_of_32',
        status: 'finished',
        raw: { home_team_label: 'Winner Group B', away_team_label: '3rd Group E' },
      },
      {
        externalId: '87',
        homeTeamId: 'COL',
        awayTeamId: 'GHA',
        homeScore: 0,
        awayScore: 0,
        type: 'round_of_32',
        status: 'upcoming',
        raw: { home_team_label: 'Winner Group K', away_team_label: '3rd Group L' },
      },
      {
        externalId: '96',
        homeTeamId: '0',
        awayTeamId: '0',
        homeScore: 0,
        awayScore: 0,
        type: 'round_of_16',
        status: 'upcoming',
        raw: { home_team_label: 'Winner Match 86', away_team_label: 'Winner Match 87' },
      },
    ];

    const phases = buildOfficialKnockoutDisplayPhases({
      knockoutMatches,
      groupMatches: [],
      teams,
      groups: [],
      teamMap,
      stadiumMap: {},
    });

    const r16 = phases.find((phase) => phase.label === 'Octavos de final');
    const m96 = r16?.matches.find((match) => match.externalId === '96');

    expect(m96?.homeTeam?.fifaCode).toBe('SUI');
    expect(m96?.homeTeamSlotLabel).toBeNull();
    expect(m96?.awayTeam).toBeNull();
    expect(m96?.awayTeamSlotLabel).toBe('Ganador de COL vs GHA');
  });

  it('applyOfficialKnockoutDisplayForUnassignedDbSlots ignora ganadores simulados del usuario', () => {
    const enriched = {
      externalId: '95',
      homeTeamId: '0',
      awayTeamId: '0',
      homeTeam: { externalId: 'ARG', fifaCode: 'ARG', nameEn: 'Argentina' },
      awayTeam: { externalId: 'EGY', fifaCode: 'EGY', nameEn: 'Egypt' },
      homeTeamSlotLabel: null,
      awayTeamSlotLabel: null,
    };

    const official = {
      homeTeam: null,
      awayTeam: null,
      homeTeamSlotLabel: 'Ganador de ARG vs CPV',
      awayTeamSlotLabel: 'Ganador de AUS vs EGY',
      homeTeamSlotSourceMatch: {
        homeTeam: { fifaCode: 'ARG' },
        awayTeam: { fifaCode: 'CPV' },
      },
      awayTeamSlotSourceMatch: {
        homeTeam: { fifaCode: 'AUS' },
        awayTeam: { fifaCode: 'EGY' },
      },
      phaseLabel: 'Octavos de final',
    };

    const result = applyOfficialKnockoutDisplayForUnassignedDbSlots(enriched, official);

    expect(result.homeTeam).toBeNull();
    expect(result.awayTeam).toBeNull();
    expect(result.homeTeamSlotLabel).toBe('Ganador de ARG vs CPV');
    expect(result.homeTeamSlotSourceMatch?.awayTeam?.fifaCode).toBe('CPV');
    expect(result.knockoutPhase).toBe('Octavos de final');
  });
});
