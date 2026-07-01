import { describe, it, expect } from 'vitest';
import {
  fifaDateToArtIso,
  fifaLocalDateToMdy,
  parseFifaLocalDateWallClock,
  validateFifaKickoffConsistency,
} from '../src/services/fifaApiClient.js';

describe('fifaKickoffTimezone', () => {
  it('parsea LocalDate como pared del estadio sin tratar Z como UTC', () => {
    expect(parseFifaLocalDateWallClock('2026-06-13T21:00:00Z')).toEqual({
      year: 2026,
      month: 6,
      day: 13,
      hour: 21,
      minute: 0,
    });
  });

  it('convierte FIFA LocalDate a MDY para Match.localDate', () => {
    expect(fifaLocalDateToMdy('2026-06-30T20:00:00Z')).toBe('06/30/2026 20:00');
  });

  it('convierte FIFA Date UTC a ART', () => {
    expect(fifaDateToArtIso('2026-06-14T01:00:00Z')).toBe('2026-06-13T22:00');
    expect(fifaDateToArtIso('2026-06-13T22:00:00Z')).toBe('2026-06-13T19:00');
    expect(fifaDateToArtIso('2026-06-13T19:00:00Z')).toBe('2026-06-13T16:00');
  });

  it('valida consistencia Date vs LocalDate para match 5 Boston', () => {
    const entry = {
      MatchNumber: 5,
      Date: '2026-06-14T01:00:00Z',
      LocalDate: '2026-06-13T21:00:00Z',
      Stadium: { Name: [{ Locale: 'en-GB', Description: 'Boston Stadium' }] },
    };
    const result = validateFifaKickoffConsistency(entry, 'America/New_York');
    expect(result.ok).toBe(true);
  });

  it('valida consistencia Date vs LocalDate para match 8 Pacific', () => {
    const entry = {
      MatchNumber: 8,
      Date: '2026-06-13T19:00:00Z',
      LocalDate: '2026-06-13T12:00:00Z',
      Stadium: { Name: [{ Locale: 'en-GB', Description: 'San Francisco Bay Area Stadium' }] },
    };
    const result = validateFifaKickoffConsistency(entry, 'America/Los_Angeles');
    expect(result.ok).toBe(true);
  });
});
