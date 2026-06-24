import { describe, it, expect } from 'vitest';
import { matchBarGridClass, liveMatchesBarGridClass } from './matchBarLayout.js';

describe('matchBarGridClass', () => {
  it('siempre una columna (en vivo y recién finalizados apilados)', () => {
    expect(matchBarGridClass()).toBe('grid-cols-1');
  });
});

describe('liveMatchesBarGridClass', () => {
  it('alias de matchBarGridClass', () => {
    expect(liveMatchesBarGridClass()).toBe('grid-cols-1');
    expect(liveMatchesBarGridClass()).toBe(matchBarGridClass());
  });
});
