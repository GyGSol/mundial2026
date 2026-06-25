import { describe, it, expect } from 'vitest';
import { formatWeatherSnapshot, hasCurrentVenueWeather } from '@/lib/venueWeatherFormat.js';

describe('venueWeatherFormat', () => {
  it('formatWeatherSnapshot formatea métricas como en panel IA', () => {
    const formatted = formatWeatherSnapshot({
      temperatureC: 22.4,
      humidityPct: 51.2,
      windKmh: 7.1,
      description: 'Despejado',
    });
    expect(formatted).toEqual({
      temp: '22°C',
      humidity: '51% hum.',
      wind: '7 km/h',
      rain: null,
      description: 'Despejado',
    });
  });

  it('hasCurrentVenueWeather detecta clima actual disponible', () => {
    expect(
      hasCurrentVenueWeather({
        available: true,
        current: { temperatureC: 18, description: 'Nublado' },
      })
    ).toBe(true);
    expect(hasCurrentVenueWeather({ available: false })).toBe(false);
  });
});
