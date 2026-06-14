import { describe, it, expect } from 'vitest';
import {
  assessNwsAlerts,
  assessOpenMeteoRisk,
  mergeRiskLevels,
} from '../src/services/weatherRiskService.js';
import { resolveStadiumWeatherProfile } from '../src/data/stadiumWeatherProfile.js';

describe('weatherRiskService', () => {
  it('assessOpenMeteoRisk detecta tormenta WMO 95', () => {
    const result = assessOpenMeteoRisk({
      available: true,
      kickoffForecast: { weatherCode: 95, description: 'Tormenta', temperatureC: 28 },
    });
    expect(result.contribution).toBe('stop');
    expect(result.signals.some((s) => s.type === 'wmo_storm')).toBe(true);
  });

  it('assessNwsAlerts eleva riesgo con Severe Thunderstorm Warning', () => {
    const result = assessNwsAlerts([
      {
        properties: {
          id: 'alert-1',
          event: 'Severe Thunderstorm Warning',
          headline: 'Tormenta severa',
          sent: '2026-06-15T19:00:00+00:00',
        },
      },
    ]);
    expect(result.contribution).toBe('stop');
    expect(result.primaryAlert?.event).toBe('Severe Thunderstorm Warning');
  });

  it('mergeRiskLevels toma el nivel más alto', () => {
    expect(mergeRiskLevels('low', 'elevated', 'stop')).toBe('stop');
    expect(mergeRiskLevels('low', 'high')).toBe('high');
  });

  it('resolveStadiumWeatherProfile asigna NOAA a sedes USA', () => {
    const profile = resolveStadiumWeatherProfile({ externalId: '5', country: 'USA' });
    expect(profile.lightningProtocolRegion).toBe('usa-noaa');
    expect(profile.thunderstormSeasonRisk).toBe('high');
  });
});
