import { describe, it, expect, vi } from 'vitest';
import {
  resolveStadiumCoordinates,
  formatVenueLocationLine,
} from '../src/data/stadiumCoordinates.js';
import {
  getVenueWeatherForStadium,
  formatWeatherForPrompt,
  buildMatchWeatherPredictionContext,
  formatWeatherSnapshotLine,
  buildVenueWeatherContextForPrediction,
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

  it('formatea línea de clima para razonamiento IA', () => {
    const line = formatWeatherSnapshotLine({
      description: 'Lluvia moderada',
      temperatureC: 14.6,
      humidityPct: 98,
      windKmh: 14,
      precipitationPct: 35,
    });
    expect(line).toContain('lluvia moderada');
    expect(line).toContain('14.6°C');
    expect(line).toContain('humedad 98%');
    expect(line).toContain('viento 14 km/h');
    expect(line).toContain('35% lluvia');
  });

  it('arma bloque sedeYClima con prioridad kickoff para próximo partido', () => {
    const weather = {
      available: true,
      locationLine: 'Toronto, Ontario',
      current: {
        description: 'Llovizna ligera',
        temperatureC: 20,
        humidityPct: 66,
        windKmh: 4,
      },
      kickoffForecast: {
        atLocal: 'jue 19 jun, 19:00',
        description: 'Lluvia moderada',
        temperatureC: 14.6,
        humidityPct: 98,
        windKmh: 14,
        precipitationPct: 35,
      },
    };
    const venue = {
      stadium: { name: 'BMO Field', city: 'Toronto', country: 'Canadá' },
      kickoffLocal: '19:00h local',
    };
    const block = buildVenueWeatherContextForPrediction(venue, weather, {
      matchStatus: 'upcoming',
    });
    expect(block.disponible).toBe(true);
    expect(block.prioridadClima).toBe('kickoff');
    expect(block.resumenLinea).toMatch(/^Estadio: BMO Field/);
    expect(block.resumenLinea).toContain('Clima:');
    expect(block.resumenLinea).toContain('lluvia moderada');
    expect(block.climaActualEnSede?.linea).toContain('llovizna ligera');
    expect(block.pronosticoAlKickoff?.linea).toContain('14.6°C');
  });

  it('prioriza clima actual en partido en vivo', () => {
    const weather = {
      available: true,
      locationLine: 'Ciudad de México',
      current: {
        description: 'Llovizna ligera',
        temperatureC: 20,
        humidityPct: 66,
        windKmh: 4,
      },
      kickoffForecast: {
        description: 'Nublado',
        temperatureC: 16,
        humidityPct: 88,
        windKmh: 3,
      },
    };
    const venue = {
      stadium: { name: 'Estadio Azteca', city: 'Ciudad de México' },
    };
    const block = buildVenueWeatherContextForPrediction(venue, weather, {
      matchStatus: 'live',
    });
    expect(block.prioridadClima).toBe('actual_en_sede');
    expect(block.resumenLinea).toContain('llovizna ligera');
  });
});
