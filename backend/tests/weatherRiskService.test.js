import { describe, it, expect } from 'vitest';
import {
  assessMscAlerts,
  assessNwsAlerts,
  assessOpenMeteoRisk,
  mergeRiskLevels,
  shouldClearInPlaySuspension,
  shouldSuggestInPlaySuspension,
} from '../src/services/weatherRiskService.js';
import {
  resolveLightningProtocolCopy,
  resolveStadiumWeatherProfile,
} from '../src/data/stadiumWeatherProfile.js';

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

  it('assessMscAlerts eleva riesgo con thunderstorm warning', () => {
    const result = assessMscAlerts([
      {
        id: 'msc-1',
        properties: {
          id: 'msc-1',
          alert_type: 'warning',
          alert_name_en: 'Thunderstorm warning',
          publication_datetime: '2026-06-15T19:00:00+00:00',
        },
      },
    ]);
    expect(result.contribution).toBe('stop');
    expect(result.primaryAlert?.event).toBe('Thunderstorm warning');
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

  it('resolveStadiumWeatherProfile asigna MSC a sedes Canadá', () => {
    const profile = resolveStadiumWeatherProfile({ externalId: '12', country: 'Canadá' });
    expect(profile.lightningProtocolRegion).toBe('canada');
  });

  it('resolveStadiumWeatherProfile asigna protocolo local a sedes México', () => {
    const profile = resolveStadiumWeatherProfile({ externalId: '1', country: 'México' });
    expect(profile.lightningProtocolRegion).toBe('mexico');
    expect(resolveLightningProtocolCopy(profile)?.badgeLabel).toBe('Riesgo climático');
  });

  it('shouldSuggestInPlaySuspension para live en curso con riesgo stop', () => {
    const match = {
      status: 'live',
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: "23'" },
    };
    const risk = { available: true, riskLevel: 'stop' };
    expect(shouldSuggestInPlaySuspension(risk, match)).toBe(true);
    expect(shouldSuggestInPlaySuspension(risk, { ...match, status: 'upcoming' })).toBe(false);
    expect(
      shouldSuggestInPlaySuspension(risk, {
        ...match,
        raw: { time_elapsed: 'notstarted' },
      })
    ).toBe(false);
  });

  it('shouldClearInPlaySuspension cuando el riesgo baja y venció resumeEarliestAt', () => {
    const match = {
      status: 'live',
      weatherOps: {
        phase: 'suspended',
        source: 'nws',
        resumeEarliestAt: new Date(Date.now() - 60_000),
      },
    };
    expect(shouldClearInPlaySuspension({ available: true, riskLevel: 'low' }, match)).toBe(true);
    expect(shouldClearInPlaySuspension({ available: true, riskLevel: 'stop' }, match)).toBe(false);
    expect(
      shouldClearInPlaySuspension(
        { available: true, riskLevel: 'low' },
        {
          ...match,
          weatherOps: { ...match.weatherOps, source: 'admin' },
        }
      )
    ).toBe(false);
  });
});
