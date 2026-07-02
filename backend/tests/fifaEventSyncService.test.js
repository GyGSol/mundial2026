import { describe, it, expect } from 'vitest';
import {
  isLiveFifaEventsStale,
  readFifaEventsSyncedAtMs,
  LIVE_FIFA_EVENTS_MAX_AGE_MS,
} from '../src/services/fifaEventSyncService.js';

describe('fifaEventSyncService live refresh', () => {
  it('detecta cronología FIFA vencida en partido live', () => {
    const now = Date.parse('2026-06-20T20:30:00.000Z');
    const match = {
      status: 'live',
      raw: {
        fifaEvents: { syncedAt: '2026-06-20T20:29:00.000Z' },
      },
    };
    expect(isLiveFifaEventsStale(match, LIVE_FIFA_EVENTS_MAX_AGE_MS, now)).toBe(true);
  });

  it('no refresca si syncedAt es reciente', () => {
    const now = Date.parse('2026-06-20T20:30:10.000Z');
    const match = {
      status: 'live',
      raw: {
        fifaEvents: { syncedAt: '2026-06-20T20:30:00.000Z' },
        fifaLiveState: { syncedAt: '2026-06-20T20:30:05.000Z', matchTime: "12'" },
      },
    };
    expect(isLiveFifaEventsStale(match, LIVE_FIFA_EVENTS_MAX_AGE_MS, now)).toBe(false);
  });

  it('readFifaEventsSyncedAtMs usa fifaMeta como respaldo', () => {
    const match = {
      raw: {
        fifaMeta: { syncedAt: '2026-06-20T20:00:00.000Z' },
      },
    };
    expect(readFifaEventsSyncedAtMs(match)).toBe(Date.parse('2026-06-20T20:00:00.000Z'));
  });

  it('sin cronología usa antigüedad de fifaLiveState.syncedAt', () => {
    const now = Date.parse('2026-06-20T20:30:00.000Z');
    const match = {
      status: 'live',
      raw: {
        fifaMeta: { syncedAt: '2026-06-20T20:00:00.000Z' },
        fifaLiveState: { syncedAt: '2026-06-20T20:29:00.000Z', matchTime: "0'" },
      },
    };
    expect(isLiveFifaEventsStale(match, LIVE_FIFA_EVENTS_MAX_AGE_MS, now)).toBe(true);
  });

  it('con cronología ignora fifaLiveState y usa fifaEvents.syncedAt', () => {
    const now = Date.parse('2026-06-20T20:30:10.000Z');
    const match = {
      status: 'live',
      raw: {
        fifaEvents: {
          syncedAt: '2026-06-20T20:30:00.000Z',
          timeline: [{ minute: 10 }],
        },
        fifaLiveState: { syncedAt: '2026-06-20T20:00:00.000Z' },
      },
    };
    expect(isLiveFifaEventsStale(match, LIVE_FIFA_EVENTS_MAX_AGE_MS, now)).toBe(false);
  });
});
