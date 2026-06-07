import { describe, it, expect } from 'vitest';
import { mapFootballDataPosition } from '../src/services/footballDataApiClient.js';
import {
  enrichClubFields,
  isLikelyCountryLabel,
  resolveClubMeta,
} from '../src/services/clubMetaService.js';

describe('footballDataApiClient position mapping', () => {
  it('mapea posiciones de Football-Data.org', () => {
    expect(mapFootballDataPosition('Goalkeeper')).toBe('GK');
    expect(mapFootballDataPosition('Defence')).toBe('DEF');
    expect(mapFootballDataPosition('Midfield')).toBe('MID');
    expect(mapFootballDataPosition('Offence')).toBe('FWD');
  });
});

describe('clubMetaService', () => {
  it('no usa nacionalidad como club', () => {
    expect(isLikelyCountryLabel('Austria')).toBe(true);
    expect(isLikelyCountryLabel('Red Bull Salzburg')).toBe(false);
    const club = enrichClubFields({ currentClub: 'Austria', nationality: 'Austria' });
    expect(club.currentClub).toBe('');
  });

  it('resuelve país y escudos para clubes conocidos', () => {
    const salzburg = resolveClubMeta('Red Bull Salzburg');
    expect(salzburg.clubCountry).toBe('Austria');
    expect(salzburg.leagueName).toBe('Bundesliga (Austria)');
    expect(salzburg.clubCrestUrl).toContain('crests.football-data.org');

    const basel = resolveClubMeta('Basel');
    expect(basel.clubCountry).toBe('Suiza');
    expect(basel.leagueEmblemUrl).toContain('SL1');
  });
});

describe('player seed normalization', () => {
  it('genera externalId estable desde nombre y fifaCode', async () => {
    const { readFile } = await import('fs/promises');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const seed = JSON.parse(
      await readFile(join(dir, '../src/data/playersSeed.json'), 'utf8')
    );
    expect(seed.playerCount).toBeGreaterThan(1000);
    expect(seed.players[0].fullName).toBeTruthy();
    expect(seed.players[0].fifaCode).toMatch(/^[A-Z]{3}$/);
  });
});
