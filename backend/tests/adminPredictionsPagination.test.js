import { describe, it, expect } from 'vitest';
import {
  ADMIN_PREDICTIONS_DEFAULT_LIMIT,
  ADMIN_PREDICTIONS_MAX_LIMIT,
  ADMIN_PREDICTIONS_SCHEDULE_SORT_MAX,
} from '../src/services/adminService.js';

describe('admin predictions pagination caps', () => {
  it('keeps page size bounded for Heroku memory', () => {
    expect(ADMIN_PREDICTIONS_DEFAULT_LIMIT).toBe(100);
    expect(ADMIN_PREDICTIONS_MAX_LIMIT).toBeLessThanOrEqual(300);
    expect(ADMIN_PREDICTIONS_SCHEDULE_SORT_MAX).toBeLessThanOrEqual(5000);
  });
});
