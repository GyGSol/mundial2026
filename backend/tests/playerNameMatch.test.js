import { describe, expect, it } from 'vitest';
import {
  compactNameKey,
  enrichNameFromRoster,
  matchNameToRosterPlayer,
  nameVariantKeys,
  tokensMatchAnyOrder,
} from '../src/utils/playerNameMatch.js';

describe('playerNameMatch', () => {
  const koreaRoster = [
    {
      mongoId: '507f1f77bcf86cd799439011',
      externalId: 'KOR-seol-young-woo',
      fullName: 'Seol Young-woo',
      position: 'DEF',
      shirtNumber: 22,
      photoUrl: '/photos/kor-seol-young-woo.png',
      aliasNames: ['Young-woo Seol', 'SEOL Youngwoo'],
      nameLookupKeys: ['seol young-woo', 'seol young woo', 'seolyoungwoo'],
    },
    {
      mongoId: '507f1f77bcf86cd799439012',
      externalId: 'KOR-yang-hyun-jun',
      fullName: 'Yang Hyun-jun',
      position: 'MID',
      shirtNumber: 20,
      photoUrl: '/photos/kor-yang-hyun-jun.png',
    },
  ];

  it('empareja formato FIFA sin guion: SEOL Youngwoo', () => {
    const matched = matchNameToRosterPlayer('SEOL Youngwoo', koreaRoster);
    expect(matched?.externalId).toBe('KOR-seol-young-woo');
    expect(matched?.fullName).toBe('Seol Young-woo');
  });

  it('empareja iniciales FIFA: H J YANG', () => {
    const matched = matchNameToRosterPlayer('H J YANG', koreaRoster);
    expect(matched?.externalId).toBe('KOR-yang-hyun-jun');
  });

  it('empareja orden apellido-nombre de Football-Data', () => {
    const sonRoster = [
      {
        externalId: 'KOR-son-heung-min',
        fullName: 'Son Heung-min',
        position: 'FWD',
        shirtNumber: 7,
        photoUrl: '/photos/son.png',
        aliasNames: ['Heung-min Son', 'SON Heung-min'],
        nameLookupKeys: nameVariantKeys('Son Heung-min'),
      },
    ];
    const matched = matchNameToRosterPlayer('Heung-min Son', sonRoster);
    expect(matched?.externalId).toBe('KOR-son-heung-min');
    expect(matched?.fullName).toBe('Son Heung-min');
  });

  it('tokensMatchAnyOrder detecta mismo jugador con tokens invertidos', () => {
    expect(tokensMatchAnyOrder('Son Heung-min', 'Heung-min Son')).toBe(true);
  });

  it('enrichNameFromRoster adjunta foto para SEOL Youngwoo', () => {
    const enriched = enrichNameFromRoster('SEOL Youngwoo', koreaRoster);
    expect(enriched.name).toBe('Seol Young-woo');
    expect(enriched.photoUrl).toBe('/photos/kor-seol-young-woo.png');
    expect(enriched.externalId).toBe('KOR-seol-young-woo');
  });

  it('compactNameKey une guiones y espacios', () => {
    expect(compactNameKey('Seol Young-woo')).toBe('seolyoungwoo');
    expect(compactNameKey('SEOL Youngwoo')).toBe('seolyoungwoo');
  });

  it('normaliza letras nórdicas para matching (ø/æ/å)', () => {
    expect(tokensMatchAnyOrder('Orjan Nyland', 'Ørjan Nyland')).toBe(true);
    expect(tokensMatchAnyOrder('Martin Odegaard', 'Martin Ødegaard')).toBe(true);
    expect(tokensMatchAnyOrder('Alexander Sorloth', 'Alexander Sørloth')).toBe(true);
  });

  it('enrichNameFromRoster prefiere jugador con foto entre duplicados nórdicos', () => {
    const norRoster = [
      {
        mongoId: 'a',
        externalId: 'NOR-orjan-nyland',
        fullName: 'Orjan Nyland',
        position: 'GK',
        shirtNumber: 1,
        photoUrl: null,
        photoKey: null,
        aliasNames: ['Ørjan Nyland'],
        nameLookupKeys: nameVariantKeys('Orjan Nyland'),
      },
      {
        mongoId: 'b',
        externalId: 'fd-6843',
        fullName: 'Ørjan Nyland',
        position: 'GK',
        shirtNumber: 1,
        photoUrl: 'https://example.com/nor-rjan-nyland.png',
        photoKey: 'noruega/nor-rjan-nyland.png',
        aliasNames: ['Orjan Nyland'],
        nameLookupKeys: nameVariantKeys('Ørjan Nyland'),
      },
    ];
    const enriched = enrichNameFromRoster('Nyland', norRoster, { shirtNumber: 1 });
    expect(enriched.photoUrl).toContain('nor-rjan-nyland');
  });
});
