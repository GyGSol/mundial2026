import { describe, it, expect } from 'vitest';
import {
  getNationProfile,
  buildTalentPoolIndex,
  isWorldCupDebut,
} from '../src/services/nationFootballProfileService.js';

describe('nationFootballProfileService', () => {
  it('carga perfil de Alemania', async () => {
    const profile = await getNationProfile('GER');
    expect(profile).toMatchObject({
      fifaCode: 'GER',
      name: 'Alemania',
      domesticLeagueName: 'Bundesliga',
      domesticLeagueTier: 1,
    });
    expect(profile.populationMillions).toBeGreaterThan(50);
  });

  it('carga perfil de Curaçao', async () => {
    const profile = await getNationProfile('CUW');
    expect(profile).toMatchObject({
      fifaCode: 'CUW',
      worldCupBestFinish: 'Debut',
      domesticLeagueTier: 5,
    });
  });

  it('buildTalentPoolIndex favorece ligas élite y población', () => {
    const ger = buildTalentPoolIndex({
      populationMillions: 84,
      domesticLeagueTier: 1,
    });
    const cuw = buildTalentPoolIndex({
      populationMillions: 0.15,
      domesticLeagueTier: 5,
    });
    expect(ger).toBeGreaterThan(cuw);
    expect(ger).toBeLessThanOrEqual(1);
    expect(cuw).toBeGreaterThan(0);
  });

  it('detecta debut mundialista', () => {
    expect(
      isWorldCupDebut({ worldCupAppearances: 1, worldCupBestFinish: 'Debut' })
    ).toBe(true);
    expect(
      isWorldCupDebut({ worldCupAppearances: 20, worldCupBestFinish: 'Campeón (4)' })
    ).toBe(false);
  });
});
