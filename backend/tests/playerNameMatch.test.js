import { describe, expect, it } from 'vitest';
import {
  enrichNameFromRoster,
  matchNameToRosterPlayer,
  nameVariantKeys,
  tokensMatchAnyOrder,
} from '../src/utils/playerNameMatch.js';

describe('playerNameMatch', () => {
  const koreaRoster = [
    {
      mongoId: '507f1f77bcf86cd799439011',
      externalId: 'KOR-son-heung-min',
      fullName: 'Son Heung-min',
      position: 'FWD',
      shirtNumber: 7,
      photoUrl: '/photos/son.png',
      aliasNames: ['Heung-min Son', 'SON Heung-min'],
      nameLookupKeys: nameVariantKeys('Son Heung-min'),
    },
  ];

  it('empareja orden apellido-nombre de Football-Data', () => {
    const matched = matchNameToRosterPlayer('Heung-min Son', koreaRoster);
    expect(matched?.externalId).toBe('KOR-son-heung-min');
    expect(matched?.fullName).toBe('Son Heung-min');
  });

  it('empareja apellido en mayúsculas de FIFA', () => {
    const matched = matchNameToRosterPlayer('SON Heung-min', koreaRoster);
    expect(matched?.fullName).toBe('Son Heung-min');
  });

  it('tokensMatchAnyOrder detecta mismo jugador con tokens invertidos', () => {
    expect(tokensMatchAnyOrder('Son Heung-min', 'Heung-min Son')).toBe(true);
  });

  it('enrichNameFromRoster devuelve nombre canónico y metadatos', () => {
    const enriched = enrichNameFromRoster('HEUNG-MIN SON', koreaRoster);
    expect(enriched.name).toBe('Son Heung-min');
    expect(enriched.position).toBe('FWD');
    expect(enriched.shirtNumber).toBe(7);
    expect(enriched.externalId).toBe('KOR-son-heung-min');
    expect(enriched.photoUrl).toBe('/photos/son.png');
  });
});
