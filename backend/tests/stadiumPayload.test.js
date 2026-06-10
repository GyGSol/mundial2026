import { describe, expect, it } from 'vitest';
import { formatStadiumForClient } from '../src/services/stadiumPayload.js';

describe('formatStadiumForClient', () => {
  it('expone campos útiles sin enviar raw completo', () => {
    const payload = formatStadiumForClient({
      externalId: '11',
      nameEn: 'MetLife Stadium',
      nameFa: '',
      city: 'East Rutherford',
      country: 'USA',
      timezone: 'America/New_York',
      capacity: 82500,
      raw: { fifa_name: 'New York/New Jersey Stadium' },
    });

    expect(payload).toEqual({
      externalId: '11',
      nameEn: 'MetLife Stadium',
      nameFa: null,
      fifaName: 'New York/New Jersey Stadium',
      city: 'East Rutherford',
      country: 'USA',
      timezone: 'America/New_York',
      capacity: 82500,
    });
  });

  it('devuelve null si no hay estadio', () => {
    expect(formatStadiumForClient(null)).toBeNull();
  });
});
