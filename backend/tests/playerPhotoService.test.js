import { describe, expect, it } from 'vitest';
import {
  buildCoachPhotoKey,
  loadGeneratorPhotoNameIndex,
  mapCoachToLineupEntry,
  matchPlayerToPhotoFile,
  matchPlayerToPhotoFileWithIndex,
  parsePhotoFilename,
  photoSlugVariants,
  resolveCoachForLineup,
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

  it('empareja variantes de slug (apellido-nombre, apóstrofo, abreviatura)', () => {
    expect(photoSlugVariants("Aiden O'Neill")).toContain('aiden-o-neill');
    expect(photoSlugVariants("Aiden O'Neill")).toContain('aidenoneill');
    expect(photoSlugVariants('Timothy Weah')).toContain('weah-timothy');
    expect(photoSlugVariants('Mathew Ryan')).toContain('mat-ryan');

    expect(
      matchPlayerToPhotoFile(
        { fifaCode: 'AUS', fullName: "Aiden O'Neill" },
        parsePhotoFilename('aus-aiden-oneill.png')
      )
    ).toBe(true);

    expect(photoSlugVariants('Feras Al Brikan')).toContain('firas-al-buraikan');
    expect(
      matchPlayerToPhotoFile(
        { fifaCode: 'KSA', fullName: 'Feras Al Brikan' },
        parsePhotoFilename('ksa-firas-al-buraikan.png')
      )
    ).toBe(true);
    expect(
      matchPlayerToPhotoFile(
        { fifaCode: 'USA', fullName: 'Tyler Adams' },
        parsePhotoFilename('usa-adams-tyler.png')
      )
    ).toBe(true);
    expect(
      matchPlayerToPhotoFile(
        { fifaCode: 'AUS', fullName: 'Mathew Ryan' },
        parsePhotoFilename('aus-mat-ryan.png')
      )
    ).toBe(true);
  });

  it('empareja nombres turcos ASCII vs acentuados y apodo compuesto', async () => {
    const generatorIndex = await loadGeneratorPhotoNameIndex();
    const kenanFile = {
      photoKey: 'turquia/tur-kenan-y-ld-z.png',
      fifaCode: 'TUR',
      parsed: parsePhotoFilename('tur-kenan-y-ld-z.png'),
    };

    expect(
      matchPlayerToPhotoFileWithIndex(
        { fifaCode: 'TUR', fullName: 'Kenan Yıldız' },
        kenanFile,
        generatorIndex
      )
    ).toBe(true);
    expect(
      matchPlayerToPhotoFile(
        { fifaCode: 'TUR', fullName: 'Muhammed Kerem Aktürkoğlu' },
        parsePhotoFilename('tur-kerem-akturkoglu.png')
      )
    ).toBe(true);
    expect(
      matchPlayerToPhotoFile(
        { fifaCode: 'PAR', fullName: 'Kaku Romero' },
        parsePhotoFilename('par-kaku.png')
      )
    ).toBe(true);
  });

  it('resuelve URL de GitHub cuando no hay archivo local', () => {
    const url = resolvePlayerPhotoUrl('argentina/arg-lionel-messi.png');
    expect(url).toMatch(/\/player-photos\/|raw\.githubusercontent\.com/);
  });

  it('construye photoKey del DT con la misma convención que jugadores', () => {
    expect(buildCoachPhotoKey('SCO', 'Steve Clarke')).toBe('escocia/sco-steve-clarke.png');
    expect(buildCoachPhotoKey('MAR', 'Mohamed Ouahbi')).toBe('marruecos/mar-mohamed-ouahbi.png');
  });

  it('mapea DT a entrada de alineación con foto', () => {
    const entry = mapCoachToLineupEntry('SCO', 'Steve Clarke');
    expect(entry).toMatchObject({
      name: 'Steve Clarke',
      photoKey: 'escocia/sco-steve-clarke.png',
    });
    expect(entry.photoUrl).toMatch(/sco-steve-clarke\.png/);
  });

  it('prioriza headCoach oficial para DT cuando FIFA trae otro nombre', () => {
    const entry = resolveCoachForLineup('Guillermo MARINO', {
      fifaCode: 'ECU',
      headCoach: 'Sebastián Beccacece',
      nameEn: 'Ecuador',
    });
    expect(entry).toMatchObject({
      name: 'Sebastián Beccacece',
      photoKey: 'ecuador/ecu-sebastian-beccacece.png',
    });
    expect(entry.photoUrl).toMatch(/ecu-sebastian-beccacece\.png/);
  });

  it('construye photoKey de Beccacece con acentos', () => {
    expect(buildCoachPhotoKey('ECU', 'Sebastián Beccacece')).toBe(
      'ecuador/ecu-sebastian-beccacece.png'
    );
  });
});
