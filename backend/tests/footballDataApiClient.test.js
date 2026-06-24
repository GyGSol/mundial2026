import { afterEach, describe, expect, it } from 'vitest';
import {
  buildPersonMatchesQueryParams,
  isFootballDataCircuitOpen,
  isFootballDataRequestAllowed,
  isFootballDataUnavailableError,
  resetFootballDataClientStateForTests,
  tripFootballDataCircuitForTests,
} from '../src/services/footballDataApiClient.js';

describe('footballDataApiClient circuit breaker', () => {
  afterEach(() => {
    resetFootballDataClientStateForTests();
  });

  it('detecta errores de cuenta deshabilitada como no reintentables', () => {
    const err = new Error(
      'Football-Data 403: {"message":"Your account has been disabled.","errorCode":403}'
    );
    expect(isFootballDataUnavailableError(err)).toBe(true);
    expect(isFootballDataUnavailableError(new Error('Football-Data unavailable: account disabled'))).toBe(
      true
    );
  });

  it('incluye dateTo junto con dateFrom en query de partidos por persona', () => {
    const query = buildPersonMatchesQueryParams({ dateFrom: '2026-01-01', dateTo: '2026-06-24' });
    expect(query.get('dateFrom')).toBe('2026-01-01');
    expect(query.get('dateTo')).toBe('2026-06-24');
    expect(query.get('status')).toBe('FINISHED');
  });

  it('abre circuit y bloquea requests hasta expirar', () => {
    expect(isFootballDataCircuitOpen()).toBe(false);

    tripFootballDataCircuitForTests(
      403,
      '{"message":"Your account has been disabled.","errorCode":403}'
    );

    expect(isFootballDataCircuitOpen()).toBe(true);
    expect(isFootballDataRequestAllowed()).toBe(false);
  });
});
