import { describe, expect, it } from 'vitest';
import {
  findNextLockedMatch,
  findNextLockedMatches,
} from '../../frontend/src/lib/nextLockedMatch.js';

describe('findNextLockedMatches', () => {
  it('devuelve todos los upcoming con predicción cerrada en el mismo kickoff', () => {
    const matches = [
      { id: '1', status: 'upcoming', predictionOpen: true },
      {
        id: '2',
        status: 'upcoming',
        predictionOpen: false,
        kickoffAt: '2026-06-11T19:00:00.000Z',
      },
      {
        id: '3',
        status: 'upcoming',
        predictionOpen: false,
        kickoffAt: '2026-06-11T19:00:00.000Z',
      },
      {
        id: '4',
        status: 'upcoming',
        predictionOpen: false,
        kickoffAt: '2026-06-11T22:00:00.000Z',
      },
    ];
    expect(findNextLockedMatches(matches).map((m) => m.id)).toEqual(['2', '3']);
  });

  it('devuelve solo el primero si el resto es en otro horario', () => {
    const matches = [
      {
        id: '2',
        status: 'upcoming',
        predictionOpen: false,
        kickoffAt: '2026-06-11T19:00:00.000Z',
      },
      {
        id: '4',
        status: 'upcoming',
        predictionOpen: false,
        kickoffAt: '2026-06-11T22:00:00.000Z',
      },
    ];
    expect(findNextLockedMatches(matches).map((m) => m.id)).toEqual(['2']);
  });

  it('ignora upcoming con predictionOpen true', () => {
    const matches = [
      { id: '1', status: 'upcoming', predictionOpen: true },
      { id: '2', status: 'upcoming', predictionOpen: true },
    ];
    expect(findNextLockedMatches(matches)).toEqual([]);
  });

  it('devuelve array vacío si no hay candidatos', () => {
    expect(findNextLockedMatches([])).toEqual([]);
    expect(findNextLockedMatches(null)).toEqual([]);
    expect(
      findNextLockedMatches([{ id: '1', status: 'live', predictionOpen: false }])
    ).toEqual([]);
  });
});

describe('findNextLockedMatch', () => {
  it('devuelve el primer match del slot', () => {
    const matches = [
      {
        id: '2',
        status: 'upcoming',
        predictionOpen: false,
        kickoffAt: '2026-06-11T19:00:00.000Z',
      },
      {
        id: '3',
        status: 'upcoming',
        predictionOpen: false,
        kickoffAt: '2026-06-11T19:00:00.000Z',
      },
    ];
    expect(findNextLockedMatch(matches)?.id).toBe('2');
  });
});
