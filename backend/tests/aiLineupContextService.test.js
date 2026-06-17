import { describe, it, expect } from 'vitest';
import {
  MIN_CONFIRMED_STARTERS_PER_TEAM,
  hasConfirmedLineupsForMatch,
} from '../src/services/aiLineupContextService.js';

describe('aiLineupContextService', () => {
  it('MIN_CONFIRMED_STARTERS_PER_TEAM es 9', () => {
    expect(MIN_CONFIRMED_STARTERS_PER_TEAM).toBe(9);
  });

  it('hasConfirmedLineupsForMatch requiere ids de equipo', async () => {
    await expect(hasConfirmedLineupsForMatch({})).resolves.toBe(false);
  });
});
