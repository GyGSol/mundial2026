import { describe, it, expect } from 'vitest';
import {
  assessMscAlerts,
  assessNwsAlerts,
  assessOpenMeteoRisk,
  fifaLiveContradictsWeatherSuspension,
  mergeRiskLevels,
  shouldAllowOpenMeteoInPlaySuspension,
  shouldClearContradictedInPlaySuspension,
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
    expect(result.inPlayContribution).toBe('stop');
    expect(result.primaryAlert?.event).toBe('Severe Thunderstorm Warning');
  });

  it('assessNwsAlerts Watch eleva pre-kickoff pero no in-play stop', () => {
    const result = assessNwsAlerts([
      {
        properties: {
          id: 'watch-1',
          event: 'Severe Thunderstorm Watch',
          headline: 'Vigilancia de tormenta',
          sent: '2026-07-04T21:00:00+00:00',
        },
      },
    ]);
    expect(result.contribution).toBe('stop');
    expect(result.inPlayContribution).toBe('elevated');
  });

  it('shouldSuggestInPlaySuspension no suspende in-play solo por NWS Watch', () => {
    const match = {
      status: 'live',
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: "32'" },
    };
    const watchRisk = {
      available: true,
      riskLevel: 'stop',
      inPlayRiskLevel: 'elevated',
      authorityAlertSource: 'nws',
    };
    expect(shouldSuggestInPlaySuspension(watchRisk, match, { externalId: '6', country: 'USA' })).toBe(
      false
    );
  });

  it('fifaLiveContradictsWeatherSuspension detecta juego al min 35 sin token suspend', () => {
    const match = {
      status: 'live',
      raw: {
        time_elapsed: "35'",
        fifaLiveState: { matchTime: "35'", period: '3', matchStatus: '3' },
      },
    };
    expect(fifaLiveContradictsWeatherSuspension(match)).toBe(true);
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
    const risk = { available: true, riskLevel: 'stop', authorityAlertSource: 'nws' };
    const openMeteoRisk = { available: true, riskLevel: 'stop', authorityAlertSource: 'open-meteo' };
    const stadiumOpen = { externalId: '6', country: 'USA' };
    const stadiumRoof = { externalId: '5', country: 'USA' };

    expect(shouldSuggestInPlaySuspension(risk, match, stadiumOpen)).toBe(true);
    expect(shouldSuggestInPlaySuspension(openMeteoRisk, match, stadiumOpen)).toBe(false);
    expect(shouldSuggestInPlaySuspension(openMeteoRisk, match, stadiumRoof)).toBe(false);
    expect(shouldSuggestInPlaySuspension(risk, { ...match, status: 'upcoming' }, stadiumOpen)).toBe(
      false
    );
    expect(
      shouldSuggestInPlaySuspension(risk, {
        ...match,
        raw: { time_elapsed: 'notstarted' },
      }, stadiumOpen)
    ).toBe(false);
  });

  it('shouldAllowOpenMeteoInPlaySuspension respeta techo retráctil', () => {
    const risk = { authorityAlertSource: 'open-meteo' };
    expect(shouldAllowOpenMeteoInPlaySuspension(risk, { externalId: '5', country: 'USA' })).toBe(
      false
    );
    expect(shouldAllowOpenMeteoInPlaySuspension(risk, { externalId: '6', country: 'USA' })).toBe(
      true
    );
  });

  it('shouldClearContradictedInPlaySuspension limpia Open-Meteo en techo retráctil o con juego avanzado', () => {
    const stadiumRoof = { externalId: '5', country: 'USA' };
    const openMeteoRisk = { authorityAlertSource: 'open-meteo', riskLevel: 'stop' };
    const suspended = {
      status: 'live',
      homeScore: 2,
      awayScore: 0,
      weatherOps: { phase: 'suspended', source: 'open-meteo' },
      raw: { time_elapsed: "22'" },
    };

    expect(shouldClearContradictedInPlaySuspension(suspended, openMeteoRisk, stadiumRoof)).toBe(
      true
    );
    expect(
      shouldClearContradictedInPlaySuspension(
        { ...suspended, homeScore: 0, awayScore: 0 },
        openMeteoRisk,
        { externalId: '6', country: 'USA' }
      )
    ).toBe(false);
    expect(
      shouldClearContradictedInPlaySuspension(
        {
          status: 'live',
          homeScore: 0,
          awayScore: 0,
          weatherOps: { phase: 'suspended', source: 'open-meteo' },
          raw: {
            time_elapsed: "46'",
            fifaEvents: {
              timeline: [{ type: 'shot_attempt', minute: 44, sortKey: 44 }],
            },
          },
        },
        openMeteoRisk,
        { externalId: '1', country: 'México' }
      )
    ).toBe(true);
    expect(
      shouldClearContradictedInPlaySuspension(suspended, openMeteoRisk, {
        externalId: '6',
        country: 'USA',
      })
    ).toBe(true);
    expect(
      shouldClearContradictedInPlaySuspension(
        {
          ...suspended,
          weatherOps: { phase: 'suspended', source: 'nws' },
          raw: {
            time_elapsed: "15'",
            fifaLiveState: { matchTime: "35'", period: '3', matchStatus: '3' },
          },
        },
        { authorityAlertSource: 'nws', riskLevel: 'stop', inPlayRiskLevel: 'elevated' },
        stadiumRoof
      )
    ).toBe(true);
    expect(
      shouldClearContradictedInPlaySuspension(
        {
          ...suspended,
          weatherOps: { phase: 'suspended', source: 'nws' },
        },
        { authorityAlertSource: 'nws', riskLevel: 'stop', inPlayRiskLevel: 'stop' },
        stadiumRoof
      )
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
