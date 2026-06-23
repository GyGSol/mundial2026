import { describe, it, expect } from 'vitest';
import {
  applyInPlayWeatherSuspension,
  applyWeatherOpsSuggestion,
} from '../src/services/matchWeatherEnrichmentService.js';

describe('matchWeatherEnrichmentService', () => {
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

  it('applyInPlayWeatherSuspension no suspende con Open-Meteo en estadio con techo retráctil', () => {
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
    const stadium = { externalId: '5', country: 'USA' };

    expect(applyInPlayWeatherSuspension(match, risk, stadium)).toBeNull();
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
