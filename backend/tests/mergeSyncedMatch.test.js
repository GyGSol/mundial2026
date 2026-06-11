import { describe, expect, it } from 'vitest';
import { mergeSyncedMatch } from '../src/services/syncService.js';

describe('mergeSyncedMatch', () => {
  const kickoffPast = new Date(Date.now() - 60_000);

  it('no degrada live a upcoming si el kickoff ya pasó', () => {
    const merged = mergeSyncedMatch(
      { status: 'live', homeScore: 1, awayScore: 0, kickoffAt: kickoffPast },
      { status: 'upcoming', homeScore: 0, awayScore: 0, kickoffAt: kickoffPast }
    );
    expect(merged.status).toBe('live');
    expect(merged.homeScore).toBe(1);
    expect(merged.awayScore).toBe(0);
  });

  it('conserva el marcador más alto en partidos live', () => {
    const merged = mergeSyncedMatch(
      { status: 'live', homeScore: 1, awayScore: 0 },
      { status: 'live', homeScore: 0, awayScore: 0 }
    );
    expect(merged.homeScore).toBe(1);
    expect(merged.awayScore).toBe(0);
  });

  it('no degrada finished', () => {
    const merged = mergeSyncedMatch(
      { status: 'finished', homeScore: 2, awayScore: 1 },
      { status: 'live', homeScore: 1, awayScore: 0 }
    );
    expect(merged.status).toBe('finished');
    expect(merged.homeScore).toBe(2);
  });
});
