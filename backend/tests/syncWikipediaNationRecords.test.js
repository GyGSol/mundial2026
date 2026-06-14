import { describe, it, expect } from 'vitest';
import {
  parseStandardTournamentTable,
  parseNationTournamentRecords,
} from '../../scripts/sync-wikipedia-nation-records.mjs';

const BRAZIL_TABLE = `{| class="wikitable sortable" style="text-align:center"
|-
!Year
!Round
!Position
!Pld
!W
!D*
!L
!GF
!GA
|-
|{{flagicon|URU}} [[1930 FIFA World Cup|1930]]||Group stage||6th||2||1||0||1||5||2
|-
|-bgcolor=Gold
|{{flagicon|SWE}} [[1958 FIFA World Cup|1958]]||'''Champions'''||'''1st'''||6||5||1||0||16||4
|-
|-bgcolor=Gold
|{{flagicon|BRA}} [[2014 FIFA World Cup|2014]]||'''Champions'''||'''1st'''||7||6||1||0||14||5
|}`;

describe('sync-wikipedia-nation-records parser', () => {
  it('parsea tabla estándar Year/Round/Position', () => {
    const records = parseStandardTournamentTable(BRAZIL_TABLE);
    expect(records.length).toBeGreaterThanOrEqual(3);
    expect(records[0]).toMatchObject({ year: 1930, round: 'Group stage' });
    const champions = records.filter((r) => r.year === 2014);
    expect(champions[0]).toMatchObject({
      year: 2014,
      position: '1st',
      played: 7,
      won: 6,
      goalsFor: 14,
    });
  });

  it('parseNationTournamentRecords usa tabla estándar', () => {
    const records = parseNationTournamentRecords(BRAZIL_TABLE);
    expect(records.some((r) => r.year === 1958)).toBe(true);
  });
});
