import { describe, expect, it } from 'vitest';
import { findNextLockedMatch } from '../../frontend/src/lib/nextLockedMatch.js';

describe('findNextLockedMatch', () => {
  it('devuelve el primer upcoming con predicción cerrada', () => {
    const matches = [
      { id: '1', status: 'upcoming', predictionOpen: true },
      { id: '2', status: 'upcoming', predictionOpen: false },
      { id: '3', status: 'upcoming', predictionOpen: false },
    ];
    expect(findNextLockedMatch(matches)?.id).toBe('2');
  });

  it('ignora upcoming con predictionOpen true', () => {
    const matches = [
      { id: '1', status: 'upcoming', predictionOpen: true },
      { id: '2', status: 'upcoming', predictionOpen: true },
    ];
    expect(findNextLockedMatch(matches)).toBeNull();
  });

  it('devuelve null si no hay candidatos', () => {
    expect(findNextLockedMatch([])).toBeNull();
    expect(findNextLockedMatch(null)).toBeNull();
    expect(
      findNextLockedMatch([{ id: '1', status: 'live', predictionOpen: false }])
    ).toBeNull();
  });
});
