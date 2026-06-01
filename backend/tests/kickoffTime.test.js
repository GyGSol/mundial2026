import { describe, it, expect } from 'vitest';
import {
  localWallClockToUtc,
  resolveKickoffAt,
  parseLocalDateParts,
} from '../src/services/kickoffTimeService.js';
import { resolveStadiumTimezone } from '../src/services/stadiumTimezones.js';
import { getLockAt } from '../src/services/predictionLockService.js';

describe('kickoffTimeService', () => {
  it('parsea local_date MM/DD/YYYY HH:mm', () => {
    expect(parseLocalDateParts('06/11/2026 13:00')).toEqual({
      month: 6,
      day: 11,
      year: 2026,
      hour: 13,
      minute: 0,
    });
  });

  it('convierte hora de estadio México a UTC correcto', () => {
    const kickoff = localWallClockToUtc('06/11/2026 13:00', 'America/Mexico_City');
    expect(kickoff?.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });

  it('convierte hora de estadio Este de EE.UU. a UTC', () => {
    const kickoff = localWallClockToUtc('06/15/2026 12:00', 'America/New_York');
    expect(kickoff?.toISOString()).toBe('2026-06-15T16:00:00.000Z');
  });

  it('prioriza utc_date de la API', () => {
    const kickoff = resolveKickoffAt(
      {
        local_date: '06/11/2026 13:00',
        utc_date: '2026-06-11T19:00:00.000Z',
      },
      { stadiumTimezone: 'America/Mexico_City' }
    );
    expect(kickoff.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });

  it('usa local_date + zona del estadio si no hay utc_date', () => {
    const kickoff = resolveKickoffAt(
      { local_date: '06/11/2026 13:00', stadium_id: '1' },
      { stadiumTimezone: 'America/Mexico_City' }
    );
    expect(kickoff.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });

  it('resuelve zona por ciudad del estadio', () => {
    expect(resolveStadiumTimezone({ city: 'Mexico City', country: 'Mexico' })).toBe(
      'America/Mexico_City'
    );
    expect(resolveStadiumTimezone({ city: 'Los Angeles', country: 'USA' })).toBe(
      'America/Los_Angeles'
    );
  });

  it('bloqueo de predicción 1h antes del kickoff canónico', () => {
    const kickoff = localWallClockToUtc('06/11/2026 13:00', 'America/Mexico_City');
    const lockAt = getLockAt(kickoff);
    expect(lockAt.toISOString()).toBe('2026-06-11T18:00:00.000Z');
  });
});
