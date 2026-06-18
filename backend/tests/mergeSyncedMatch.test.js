import { describe, expect, it } from 'vitest';
import {
  incomingIndicatesNotFinished,
  mergeSyncedMatch,
  syncTeamsMatch,
} from '../src/services/syncService.js';

describe('mergeSyncedMatch', () => {
  const kickoffPast = new Date(Date.now() - 60_000);

  it('no degrada live a upcoming aunque worldcup26 siga en notstarted', () => {
    const merged = mergeSyncedMatch(
      { status: 'live', homeScore: 1, awayScore: 0, kickoffAt: kickoffPast },
      {
        status: 'upcoming',
        homeScore: 0,
        awayScore: 0,
        kickoffAt: kickoffPast,
        raw: { finished: 'FALSE', time_elapsed: 'notstarted' },
      }
    );
    expect(merged.status).toBe('live');
    expect(merged.homeScore).toBe(1);
    expect(merged.awayScore).toBe(0);
  });

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

  it('descarta marcador corrupto 1405 y conserva el válido', () => {
    const merged = mergeSyncedMatch(
      { status: 'live', homeScore: 1405, awayScore: 1 },
      { status: 'live', homeScore: 0, awayScore: 1 }
    );
    expect(merged.homeScore).toBe(0);
    expect(merged.awayScore).toBe(1);
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

  it('reabre finished prematuro cuando timeline muestra partido en curso', () => {
    const kickoffRecent = new Date(Date.now() - 10 * 60 * 1000);
    const merged = mergeSyncedMatch(
      {
        status: 'finished',
        homeScore: 0,
        awayScore: 0,
        kickoffAt: kickoffRecent,
        raw: { finished: 'TRUE', time_elapsed: 'finished' },
      },
      {
        status: 'live',
        homeScore: 0,
        awayScore: 0,
        kickoffAt: kickoffRecent,
        raw: {
          finished: 'FALSE',
          time_elapsed: 'final',
          fifaEvents: {
            timeline: [
              { type: 'kickoff', minute: 0, sortKey: 0 },
              { type: 'substitution', minute: 4, sortKey: 4 },
            ],
          },
        },
      }
    );

    expect(merged.status).toBe('live');
    expect(merged.raw.finished).toBe('FALSE');
    expect(merged.raw.time_elapsed).not.toBe('finished');
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

  it('no aplica datos de worldcup26 si el par de equipos no coincide (id FIFA ≠ id worldcup26)', () => {
    const existing = {
      status: 'upcoming',
      homeTeamId: '27',
      awayTeamId: '28',
      homeScore: 0,
      awayScore: 0,
      externalId: '15',
      kickoffAt: new Date('2026-06-16T01:00:00.000Z'),
    };
    const incoming = {
      status: 'finished',
      homeTeamId: '25',
      awayTeamId: '26',
      homeScore: 1,
      awayScore: 1,
      externalId: '15',
      raw: { finished: 'TRUE', time_elapsed: 'finished' },
    };

    expect(syncTeamsMatch(existing, incoming)).toBe(false);
    const merged = mergeSyncedMatch(existing, incoming);
    expect(merged.status).toBe('upcoming');
    expect(merged.homeScore).toBe(0);
    expect(merged.awayScore).toBe(0);
  });

  it('corrige finished erróneo cuando worldcup26 indica que el partido no empezó', () => {
    const kickoffPast = new Date(Date.now() - 60_000);
    const merged = mergeSyncedMatch(
      {
        status: 'finished',
        homeTeamId: '27',
        awayTeamId: '28',
        homeScore: 1,
        awayScore: 1,
        kickoffAt: kickoffPast,
        externalId: '15',
      },
      {
        status: 'upcoming',
        homeTeamId: '27',
        awayTeamId: '28',
        homeScore: 0,
        awayScore: 0,
        raw: { finished: 'FALSE', time_elapsed: 'notstarted' },
      }
    );

    expect(incomingIndicatesNotFinished({
      status: 'upcoming',
      raw: { finished: 'FALSE', time_elapsed: 'notstarted' },
    })).toBe(true);
    expect(merged.status).toBe('upcoming');
    expect(merged.homeScore).toBe(0);
    expect(merged.awayScore).toBe(0);
  });

  it('enruta sync al partido correcto por par IRN-NZL aunque worldcup26 use otro id', () => {
    const kickoffPast = new Date(Date.now() - 60_000);
    const fifaSlot = {
      status: 'finished',
      homeTeamId: '27',
      awayTeamId: '28',
      homeScore: 1,
      awayScore: 1,
      externalId: '15',
      kickoffAt: kickoffPast,
    };
    const worldcup26Payload = {
      status: 'upcoming',
      homeTeamId: '27',
      awayTeamId: '28',
      homeScore: 0,
      awayScore: 0,
      externalId: '13',
      kickoffAt: kickoffPast,
      raw: { finished: 'FALSE', time_elapsed: 'notstarted' },
    };

    const merged = mergeSyncedMatch(fifaSlot, worldcup26Payload);
    expect(merged.status).toBe('upcoming');
    expect(merged.homeScore).toBe(0);
    expect(merged.awayScore).toBe(0);
  });

  describe('colisiones conocidas worldcup26 id vs FIFA externalId', () => {
    const collisions = [
      {
        label: 'worldcup26 id 15 = BEL-EGY no contamina FIFA slot 15 = IRN-NZL',
        existing: {
          status: 'live',
          homeTeamId: '27',
          awayTeamId: '28',
          homeScore: 0,
          awayScore: 1,
          externalId: '15',
        },
        incoming: {
          status: 'finished',
          homeTeamId: '25',
          awayTeamId: '26',
          homeScore: 1,
          awayScore: 1,
          externalId: '15',
          raw: { finished: 'TRUE', time_elapsed: 'finished' },
        },
      },
      {
        label: 'worldcup26 id 13 = IRN-NZL no contamina FIFA slot 13 = KSA-URU',
        existing: {
          status: 'upcoming',
          homeTeamId: '29',
          awayTeamId: '30',
          homeScore: 0,
          awayScore: 0,
          externalId: '13',
        },
        incoming: {
          status: 'finished',
          homeTeamId: '27',
          awayTeamId: '28',
          homeScore: 2,
          awayScore: 0,
          externalId: '13',
          raw: { finished: 'TRUE', time_elapsed: 'finished' },
        },
      },
    ];

    for (const { label, existing, incoming } of collisions) {
      it(label, () => {
        expect(syncTeamsMatch(existing, incoming)).toBe(false);
        const merged = mergeSyncedMatch(existing, incoming);
        expect(merged.status).toBe(existing.status);
        expect(merged.homeScore).toBe(existing.homeScore);
        expect(merged.awayScore).toBe(existing.awayScore);
      });
    }
  });
});
