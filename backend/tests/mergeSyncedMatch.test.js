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

  it('prioriza marcador FIFA ante worldcup26 desactualizado tras gol anulado', () => {
    const merged = mergeSyncedMatch(
      {
        status: 'live',
        homeScore: 2,
        awayScore: 1,
        raw: {
          fifaMeta: {
            homeScore: 2,
            awayScore: 1,
            syncedAt: '2026-06-12T03:00:00.000Z',
          },
        },
      },
      { status: 'live', homeScore: 2, awayScore: 2 }
    );

    expect(merged.homeScore).toBe(2);
    expect(merged.awayScore).toBe(1);
  });

  it('no degrada finished', () => {
    const merged = mergeSyncedMatch(
      { status: 'finished', homeScore: 2, awayScore: 1, kickoffAt: kickoffPast },
      { status: 'live', homeScore: 1, awayScore: 0, kickoffAt: kickoffPast }
    );
    expect(merged.status).toBe('finished');
    expect(merged.homeScore).toBe(2);
  });

  it('corrige finished prematuro si el kickoff aún no llegó', () => {
    const kickoffFuture = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const merged = mergeSyncedMatch(
      { status: 'finished', homeScore: 0, awayScore: 0, kickoffAt: kickoffFuture },
      { status: 'upcoming', homeScore: 0, awayScore: 0, kickoffAt: kickoffFuture }
    );

    expect(merged.status).toBe('upcoming');
    expect(merged.homeScore).toBe(0);
    expect(merged.awayScore).toBe(0);
  });

  it('live→finished usa marcador FIFA si worldcup26 quedó en 2-2 tras gol anulado', () => {
    const merged = mergeSyncedMatch(
      {
        status: 'live',
        homeScore: 2,
        awayScore: 2,
        raw: {
          fifaMeta: {
            homeScore: 2,
            awayScore: 1,
            syncedAt: '2026-06-12T03:00:00.000Z',
          },
        },
      },
      { status: 'finished', homeScore: 2, awayScore: 2 }
    );

    expect(merged.status).toBe('finished');
    expect(merged.homeScore).toBe(2);
    expect(merged.awayScore).toBe(1);
  });

  it('finished con fifaMeta corrige marcador guardado desactualizado', () => {
    const merged = mergeSyncedMatch(
      {
        status: 'finished',
        homeScore: 2,
        awayScore: 2,
        raw: {
          fifaMeta: {
            homeScore: 2,
            awayScore: 1,
            syncedAt: '2026-06-12T04:00:00.000Z',
          },
        },
      },
      { status: 'finished', homeScore: 2, awayScore: 2 }
    );

    expect(merged.homeScore).toBe(2);
    expect(merged.awayScore).toBe(1);
  });

  it('conserva fdEvents y footballDataMatchId al sincronizar raw de worldcup26', () => {
    const merged = mergeSyncedMatch(
      {
        status: 'finished',
        homeScore: 2,
        awayScore: 0,
        raw: {
          home_scorers: '{“J. Quiñones 9’”}',
          footballDataMatchId: 537327,
          fdEvents: {
            homeBookings: [{ minute: 45, player: 'López', card: 'YELLOW' }],
            awayBookings: [],
            homeSubstitutions: [],
            awaySubstitutions: [],
          },
        },
      },
      {
        status: 'finished',
        homeScore: 2,
        awayScore: 0,
        raw: {
          home_scorers: '{“J. Quiñones 9’”,“R. Jiménez 67’”}',
          away_scorers: 'null',
        },
      }
    );

    expect(merged.raw.footballDataMatchId).toBe(537327);
    expect(merged.raw.fdEvents.homeBookings).toHaveLength(1);
    expect(merged.raw.home_scorers).toContain('Jiménez');
  });

  it('conserva fifaEvents y fifaMeta al sincronizar raw de worldcup26', () => {
    const merged = mergeSyncedMatch(
      {
        status: 'finished',
        raw: {
          fifaMeta: { idMatch: '400021443', idStage: '289273' },
          fifaEvents: { timeline: [{ sortKey: 9, type: 'goal', side: 'home', player: 'QUINONES' }] },
        },
      },
      {
        status: 'finished',
        raw: { home_scorers: 'null' },
      }
    );

    expect(merged.raw.fifaMeta.idMatch).toBe('400021443');
    expect(merged.raw.fifaEvents.timeline).toHaveLength(1);
  });
});
