import { describe, expect, it } from 'vitest';
import {
  matchPlayerToPhotoFile,
  parsePhotoFilename,
  resolvePlayerPhotoUrl,
  slugifyPlayerName,
} from '../src/services/playerPhotoService.js';

describe('playerPhotoService', () => {
  it('parsea nombres de archivo con guiones en el slug', () => {
    expect(parsePhotoFilename('arg-alexis-mac-allister.png')).toEqual({
      fifaPrefix: 'arg',
      nameSlug: 'alexis-mac-allister',
    });
    expect(parsePhotoFilename('esp-pau-cubarsi.png')).toEqual({
      fifaPrefix: 'esp',
      nameSlug: 'pau-cubarsi',
    });
  });

  it('slugifica nombres con acentos', () => {
    expect(slugifyPlayerName('Pau Cubarsí')).toBe('pau-cubarsi');
    expect(slugifyPlayerName('Lionel Messi')).toBe('lionel-messi');
  });

  it('empareja jugador por fifaCode y slug', () => {
    const parsed = parsePhotoFilename('arg-lionel-messi.png');
    const player = { fifaCode: 'ARG', fullName: 'Lionel Messi' };
    expect(matchPlayerToPhotoFile(player, parsed)).toBe(true);
    expect(matchPlayerToPhotoFile({ ...player, fullName: 'Julian Alvarez' }, parsed)).toBe(false);
  });

  it('resuelve URL de GitHub cuando no hay archivo local', () => {
    const url = resolvePlayerPhotoUrl('argentina/arg-lionel-messi.png');
    expect(url).toMatch(/\/player-photos\/|raw\.githubusercontent\.com/);
  });
});
