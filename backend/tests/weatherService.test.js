import { describe, it, expect, vi } from 'vitest';
import {
  resolveStadiumCoordinates,
  formatVenueLocationLine,
} from '../src/data/stadiumCoordinates.js';
import {
  getVenueWeatherForStadium,
  formatWeatherForPrompt,
  buildMatchWeatherPredictionContext,
} from '../src/services/weatherService.js';

describe('stadiumCoordinates', () => {
  it('resuelve coordenadas por externalId', () => {
    const coords = resolveStadiumCoordinates({ externalId: '5', city: 'Houston' });
    expect(coords?.latitude).toBeCloseTo(29.6847, 2);
    expect(coords?.region).toBe('Texas');
  });

  it('arma línea de ubicación con ciudad y estado', () => {
    const line = formatVenueLocationLine(
      { city: 'Houston', country: 'USA' },
      { region: 'Texas', country: 'Estados Unidos' }
    );
    expect(line).toContain('Houston');
    expect(line).toContain('Texas');
  });
});

describe('weatherService', () => {
  it('formatea clima para prompt cuando hay datos', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 31,
          relative_humidity_2m: 72,
          weather_code: 2,
          wind_speed_10m: 14,
        },
        hourly: {
          time: ['2026-06-15T19:00'],
          temperature_2m: [28],
          relative_humidity_2m: [65],
          precipitation_probability: [20],
          weather_code: [3],
          wind_speed_10m: [10],
        },
      }),
    });

    const weather = await getVenueWeatherForStadium(
      { externalId: '5', city: 'Houston', country: 'USA', timezone: 'America/Chicago' },
      {
        kickoffAt: '2026-06-15T19:00:00.000Z',
        fetchImpl: mockFetch,
      }
    );

    expect(weather.available).toBe(true);
    expect(weather.current.temperatureC).toBe(31);
    expect(formatWeatherForPrompt(weather).status).toBe('ok');
    const matchWeather = buildMatchWeatherPredictionContext(weather);
    expect(matchWeather.status).toBe('ok');
    expect(matchWeather.authoritativeForPrediction).toBe(true);
    expect(matchWeather.kickoffForecast?.temperatureC).toBe(28);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('start_date=2026-06-15');
    expect(calledUrl).not.toContain('forecast_days');
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
