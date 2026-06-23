import { describe, it, expect } from 'vitest';
import {
  formatWeatherRiskForClient,
} from '../src/services/weatherRiskService.js';
import {
  localizeAuthorityAlert,
  translateWeatherAlertEvent,
} from '../../shared/weatherAlertI18n.js';

describe('weatherAlertI18n', () => {
  it('traduce Flood Watch con detalle en castellano', () => {
    const result = translateWeatherAlertEvent('Flood Watch');
    expect(result.label).toBe('Vigilancia de inundación');
    expect(result.detail).toMatch(/Aún no hay inundación confirmada/);
  });

  it('localizeAuthorityAlert reemplaza event en inglés', () => {
    const localized = localizeAuthorityAlert({
      id: '1',
      event: 'Severe Thunderstorm Warning',
      headline: 'Severe thunderstorm warning issued',
    });
    expect(localized.event).toBe('Alerta de tormenta severa');
    expect(localized.headline).toBeNull();
    expect(localized.detail).toMatch(/inminente/i);
  });

  it('formatWeatherRiskForClient expone alertas localizadas', () => {
    const formatted = formatWeatherRiskForClient({
      available: true,
      riskLevel: 'elevated',
      nws: {
        alertCount: 1,
        primaryAlert: { id: 'x', event: 'Flood Watch' },
        alerts: [{ id: 'x', event: 'Flood Watch' }],
      },
    });
    expect(formatted.nws.primaryAlert.event).toBe('Vigilancia de inundación');
    expect(formatted.nws.primaryAlert.detail).toBeTruthy();
  });
});
