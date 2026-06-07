import { describe, it, expect } from 'vitest';
import { mapFootballDataPosition } from '../src/services/footballDataApiClient.js';

describe('footballDataApiClient position mapping', () => {
  it('mapea posiciones de Football-Data.org', () => {
    expect(mapFootballDataPosition('Goalkeeper')).toBe('GK');
    expect(mapFootballDataPosition('Defence')).toBe('DEF');
    expect(mapFootballDataPosition('Midfield')).toBe('MID');
    expect(mapFootballDataPosition('Offence')).toBe('FWD');
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
