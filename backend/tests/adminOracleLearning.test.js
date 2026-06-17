import { describe, it, expect } from 'vitest';
import { computeScoreMse, serializeTrainingBufferRow } from '../src/services/trainingBufferService.js';

describe('trainingBufferService export helpers', () => {
  it('computeScoreMse calcula error cuadrático', () => {
    expect(computeScoreMse({ home: 2, away: 1 }, { home: 1, away: 0 })).toBe(2);
  });

  it('serializeTrainingBufferRow incluye adminFeedback en metadata', () => {
    const row = {
      matchId: 'abc',
      predictedScore: { home: 2, away: 1 },
      actualScore: { home: 1, away: 0 },
      mseError: 2,
      promptContext: { match: { homeTeamId: 'ARG', awayTeamId: 'BRA', group: 'A' } },
      microEvents: [{ type: 'goal', minute: 12, playerName: 'Messi' }],
    };
    const serialized = serializeTrainingBufferRow(row, { adminFeedback: 'Corregir sesgo local' });
    expect(serialized.metadata.adminFeedback).toBe('Corregir sesgo local');
    expect(serialized.metadata.goal_timings).toEqual([{ minute: 12, player: 'Messi' }]);
    expect(serialized.sample_weight).toBe(3);
  });
});
