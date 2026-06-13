import { describe, it, expect } from 'vitest';
import { formatDayKey, TRANSMISSIONS_TIMEZONE } from '../src/services/transmissionService.js';

describe('transmissionService', () => {
  it('formatDayKey usa calendario Argentina', () => {
    const key = formatDayKey('2026-06-13T22:00:00.000Z', TRANSMISSIONS_TIMEZONE);
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
