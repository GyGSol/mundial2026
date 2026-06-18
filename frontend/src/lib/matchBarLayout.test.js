import { describe, it, expect } from 'vitest';
import { matchBarGridClass } from './matchBarLayout.js';

describe('matchBarGridClass', () => {
  it('1 partido: una columna', () => {
    expect(matchBarGridClass(1)).toBe('grid-cols-1');
  });

  it('2 partidos: dos columnas en sm+', () => {
    expect(matchBarGridClass(2)).toBe('grid-cols-1 sm:grid-cols-2');
  });

  it('3 o más: tres columnas en lg+', () => {
    expect(matchBarGridClass(3)).toBe('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
    expect(matchBarGridClass(5)).toBe('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
  });
});
