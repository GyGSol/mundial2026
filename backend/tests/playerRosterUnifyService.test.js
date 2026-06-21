import { describe, expect, it } from 'vitest';
import {
  areSamePlayer,
  pickCanonicalPlayer,
  unifyRawTeamPlayers,
  unifyTeamPlayerDocuments,
} from '../src/services/playerRosterUnifyService.js';

describe('playerRosterUnifyService', () => {
  const officialSon = {
    _id: '507f1f77bcf86cd799439011',
    externalId: 'KOR-son-heung-min',
    fullName: 'Son Heung-min',
    position: 'FWD',
    shirtNumber: 7,
    photoKey: 'corea/kor-son-heung-min.png',
    teamExternalId: 'team-kor',
    fifaCode: 'KOR',
  };

  const fdSon = {
    _id: '507f1f77bcf86cd799439099',
    externalId: 'fd-12345',
    fullName: 'Heung-min Son',
    position: 'Offence',
    shirtNumber: 7,
    footballDataPersonId: 99,
    teamExternalId: 'team-kor',
    fifaCode: 'KOR',
  };

  it('areSamePlayer detecta duplicados seed vs Football-Data', () => {
    expect(areSamePlayer(officialSon, fdSon)).toBe(true);
  });

  it('areSamePlayer detecta apodo vs nombre compuesto', () => {
    expect(
      areSamePlayer(
        { fullName: 'Kaku Romero', fifaCode: 'PAR' },
        { fullName: 'Kaku', fifaCode: 'PAR' }
      )
    ).toBe(true);
    expect(
      areSamePlayer(
        { fullName: 'Ugurcan Cakir', fifaCode: 'TUR' },
        { fullName: 'Uğurcan Çakır', fifaCode: 'TUR' }
      )
    ).toBe(true);
    expect(
      areSamePlayer(
        { fullName: 'Muhammed Kerem Aktürkoğlu', fifaCode: 'TUR' },
        { fullName: 'Kerem Aktürkoğlu', fifaCode: 'TUR' }
      )
    ).toBe(true);
    expect(
      areSamePlayer(
        { fullName: 'Evren Eren Elmalı', fifaCode: 'TUR' },
        { fullName: 'Eren Elmalı', fifaCode: 'TUR' }
      )
    ).toBe(true);
    expect(
      areSamePlayer(
        { fullName: 'Feras Al Brikan', fifaCode: 'KSA' },
        { fullName: 'Firas Al-Buraikan', fifaCode: 'KSA' }
      )
    ).toBe(true);
    expect(
      areSamePlayer(
        { fullName: 'Mehdi Torabi', fifaCode: 'IRN' },
        { fullName: 'Mahdi Torabi', fifaCode: 'IRN' }
      )
    ).toBe(true);
  });

  it('pickCanonicalPlayer prefiere plantel oficial con foto', () => {
    expect(pickCanonicalPlayer([fdSon, officialSon]).externalId).toBe('KOR-son-heung-min');
  });

  it('unifyRawTeamPlayers deduplica y conserva alias', () => {
    const roster = unifyRawTeamPlayers([fdSon, officialSon]);
    expect(roster).toHaveLength(1);
    expect(roster[0].fullName).toBe('Son Heung-min');
    expect(roster[0].externalId).toBe('KOR-son-heung-min');
    expect(roster[0].aliasExternalIds).toEqual(expect.arrayContaining(['fd-12345', 'KOR-son-heung-min']));
    expect(roster[0].aliasNames).toEqual(
      expect.arrayContaining(['Son Heung-min', 'Heung-min Son'])
    );
  });

  it('unifyTeamPlayerDocuments prioriza Wikipedia y hereda foto del duplicado', () => {
    const wikiRyan = {
      externalId: 'AUS-mathew-ryan',
      fullName: 'Mathew Ryan',
      shirtNumber: 1,
      photoKey: '',
      dataSources: { structural: 'wikipedia-squads' },
      fifaCode: 'AUS',
    };
    const seedRyan = {
      externalId: 'AUS-mat-ryan',
      fullName: 'Mat Ryan',
      shirtNumber: 1,
      photoKey: 'australia/aus-mat-ryan.png',
      dataSources: { structural: 'seed' },
      fifaCode: 'AUS',
    };

    const unified = unifyTeamPlayerDocuments([seedRyan, wikiRyan]);
    expect(unified).toHaveLength(1);
    expect(unified[0].fullName).toBe('Mathew Ryan');
    expect(unified[0].photoKey).toBe('australia/aus-mat-ryan.png');
  });
});
