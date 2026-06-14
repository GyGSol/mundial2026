import { describe, it, expect } from 'vitest';
import {
  buildPositionMatchups,
  buildMoraleFactors,
} from '../src/services/aiMatchEnrichedContextService.js';
import { buildTalentPoolIndex } from '../src/services/nationFootballProfileService.js';

describe('aiMatchEnrichedContextService', () => {
  const homeSquad = {
    probableStarters: [
      {
        name: 'Manuel Neuer',
        position: 'GK',
        club: 'Bayern',
        league: 'Bundesliga',
        healthStatus: 'available',
      },
      {
        name: 'Joshua Kimmich',
        position: 'DEF',
        club: 'Bayern',
        league: 'Bundesliga',
        healthStatus: 'available',
      },
      {
        name: 'Jamal Musiala',
        position: 'MID',
        club: 'Bayern',
        league: 'Bundesliga',
        healthStatus: 'available',
      },
      {
        name: 'Kai Havertz',
        position: 'FWD',
        club: 'Arsenal',
        league: 'Premier League',
        healthStatus: 'available',
      },
    ],
    injuredCount: 1,
    doubtfulCount: 0,
    suspendedCount: 0,
  };

  const awaySquad = {
    probableStarters: [
      {
        name: 'Eloy Room',
        position: 'GK',
        club: 'Pafos',
        league: 'Prome Divishon',
        healthStatus: 'available',
      },
      {
        name: 'Cuca Martina',
        position: 'DEF',
        club: 'Sparta Rotterdam',
        league: 'Eredivisie',
        healthStatus: 'available',
      },
      {
        name: 'Leandro Bacuna',
        position: 'MID',
        club: 'Wigan',
        league: 'Championship',
        healthStatus: 'doubt',
      },
      {
        name: 'Rangelo Janga',
        position: 'FWD',
        club: 'Hartberg',
        league: 'Bundesliga (Austria)',
        healthStatus: 'available',
      },
    ],
    injuredCount: 0,
    doubtfulCount: 1,
    suspendedCount: 0,
  };

  it('buildPositionMatchups marca ventaja local en líneas con ligas superiores', () => {
    const matchups = buildPositionMatchups(homeSquad, awaySquad);
    expect(matchups).toHaveLength(4);
    const mid = matchups.find((m) => m.position === 'FWD');
    expect(mid.edge).toBe('home');
    expect(mid.fieldImpactNote).toMatch(/Ventaja FWD local/i);
  });

  it('buildMoraleFactors detecta favorito y debut', () => {
    const gerProfile = {
      climateHome: 'templado',
      worldCupAppearances: 20,
      worldCupBestFinish: 'Campeón (4)',
    };
    const cuwProfile = {
      climateHome: 'tropical',
      worldCupAppearances: 1,
      worldCupBestFinish: 'Debut',
    };

    const gerMorale = buildMoraleFactors({
      teamAnalysis: { fifaRanking: { rank: 10 } },
      profile: gerProfile,
      squad: homeSquad,
      venue: { stadium: { city: 'Houston', country: 'USA' } },
      opponentRanking: { rank: 82 },
      ownRanking: { rank: 10 },
    });

    const cuwMorale = buildMoraleFactors({
      teamAnalysis: { fifaRanking: { rank: 82 } },
      profile: cuwProfile,
      squad: awaySquad,
      venue: { stadium: { city: 'Houston', country: 'USA' } },
      opponentRanking: { rank: 10 },
      ownRanking: { rank: 82 },
    });

    expect(gerMorale.favoriteOrUnderdog).toBe('favorite');
    expect(gerMorale.climateAdaptation).toBe('desafiante');
    expect(cuwMorale.isWorldCupDebut).toBe(true);
    expect(cuwMorale.climateAdaptation).toBe('familiar');
    expect(cuwMorale.favoriteOrUnderdog).toBe('underdog');
  });

  it('buildMoraleFactors usa kickoff real de matchWeather para venueClimate', () => {
    const morale = buildMoraleFactors({
      teamAnalysis: { fifaRanking: { rank: 10 } },
      profile: { climateHome: 'templado', worldCupAppearances: 20 },
      squad: homeSquad,
      venue: {
        stadium: { city: 'Seattle', country: 'USA' },
        matchWeather: {
          status: 'ok',
          kickoffForecast: {
            temperatureC: 32,
            humidityPct: 75,
            precipitationPct: 10,
            windKmh: 8,
            description: 'Parcialmente nublado',
          },
        },
      },
      opponentRanking: { rank: 50 },
      ownRanking: { rank: 10 },
    });

    expect(morale.venueClimate).toBe('tropical_caluroso');
    expect(morale.venueClimateSource).toBe('open-meteo-kickoff');
    expect(morale.kickoffWeather?.temperatureC).toBe(32);
  });

  it('talentPoolIndex GER >> CUW', () => {
    const ger = buildTalentPoolIndex({
      populationMillions: 84,
      domesticLeagueTier: 1,
    });
    const cuw = buildTalentPoolIndex({
      populationMillions: 0.15,
      domesticLeagueTier: 5,
    });
    expect(ger).toBeGreaterThan(cuw);
    expect(cuw).toBeLessThan(0.4);
  });
});
