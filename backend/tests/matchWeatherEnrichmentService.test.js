import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyInPlayWeatherSuspension,
  applyWeatherOpsSuggestion,
  enrichMatchWeatherFields,
} from '../src/services/matchWeatherEnrichmentService.js';

vi.mock('../src/services/weatherService.js', () => ({
  getVenueWeatherForStadium: vi.fn(),
  formatWeatherForClient: vi.fn((weather) =>
    weather
      ? {
          available: weather.available,
          current: weather.current ?? null,
          kickoffForecast: weather.kickoffForecast ?? null,
        }
      : null
  ),
}));

vi.mock('../src/services/weatherRiskService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    assessVenueWeatherRisk: vi.fn().mockResolvedValue({
      available: true,
      riskLevel: 'low',
      authorityAlertSource: 'open-meteo',
    }),
  };
});

import { getVenueWeatherForStadium } from '../src/services/weatherService.js';

describe('matchWeatherEnrichmentService', () => {
  beforeEach(() => {
    vi.mocked(getVenueWeatherForStadium).mockReset();
  });

  it('enrichMatchWeatherFields expone weather.current para partidos live', async () => {
    vi.mocked(getVenueWeatherForStadium).mockResolvedValue({
      available: true,
      current: {
        temperatureC: 22,
        humidityPct: 51,
        windKmh: 7,
        description: 'Despejado',
        weatherCode: 0,
      },
    });

    const fields = await enrichMatchWeatherFields(
      {
        status: 'live',
        kickoffAt: new Date('2026-06-25T01:00:00Z'),
        weatherOps: { phase: 'normal' },
      },
      { externalId: '1', country: 'México', latitude: 19.3, longitude: -99.15 }
    );

    expect(fields.weather?.available).toBe(true);
    expect(fields.weather?.current?.description).toBe('Despejado');
    expect(fields.weather?.current?.temperatureC).toBe(22);
    expect(fields.weatherRisk?.riskLevel).toBe('low');
  });

  it('applyInPlayWeatherSuspension devuelve phase suspended para live con riesgo stop', () => {
    const match = {
      status: 'live',
      kickoffAt: new Date('2026-06-20T21:00:00Z'),
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: "34'" },
    };
    const risk = {
      available: true,
      riskLevel: 'stop',
      lastAlertAt: '2026-06-20T21:34:00Z',
      authorityAlertId: 'alert-99',
      authorityAlertSource: 'nws',
    };
    const stadium = { externalId: '5', country: 'USA' };

    const ops = applyInPlayWeatherSuspension(match, risk, stadium);
    expect(ops?.phase).toBe('suspended');
    expect(ops?.reason).toBe('lightning');
    expect(ops?.source).toBe('nws');
    expect(ops?.nwsAlertId).toBe('alert-99');
    expect(ops?.resumeEarliestAt).toBeInstanceOf(Date);
  });

  it('applyInPlayWeatherSuspension no suspende solo con Open-Meteo (pronóstico)', () => {
    const match = {
      status: 'live',
      kickoffAt: new Date('2026-06-20T21:00:00Z'),
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: "34'" },
    };
    const risk = {
      available: true,
      riskLevel: 'stop',
      lastAlertAt: '2026-06-20T21:34:00Z',
      authorityAlertSource: 'open-meteo',
    };
    const stadiumOpen = { externalId: '6', country: 'USA' };
    const stadiumRoof = { externalId: '5', country: 'USA' };
    const stadiumMexico = { externalId: '1', country: 'México' };

    expect(applyInPlayWeatherSuspension(match, risk, stadiumOpen)).toBeNull();
    expect(applyInPlayWeatherSuspension(match, risk, stadiumRoof)).toBeNull();
    expect(applyInPlayWeatherSuspension(match, risk, stadiumMexico)).toBeNull();
  });

  it('applyWeatherOpsSuggestion sigue devolviendo pre_kickoff_delay para upcoming', () => {
    const match = {
      status: 'upcoming',
      kickoffAt: new Date('2026-06-20T21:00:00Z'),
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: 'notstarted' },
    };
    const risk = {
      available: true,
      riskLevel: 'stop',
      lastAlertAt: '2026-06-20T21:00:00Z',
      authorityAlertSource: 'nws',
    };

    const ops = applyWeatherOpsSuggestion(match, risk, { externalId: '5', country: 'USA' });
    expect(ops?.phase).toBe('pre_kickoff_delay');
  });
});
