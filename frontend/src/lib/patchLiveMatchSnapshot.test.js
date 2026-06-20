import { describe, expect, it } from 'vitest';
import { mergeLiveSnapshot } from './patchLiveMatchSnapshot.js';
import {
  isLiveMatchReason,
  REALTIME_EVENTS,
  shouldRefreshSector,
  SECTOR_TAGS,
} from './realtimeSectors.js';

describe('mergeLiveSnapshot', () => {
  it('actualiza marcador en liveMatches y en matches', () => {
    const data = {
      matches: [{ id: 'm1', homeScore: 0, awayScore: 0, status: 'live' }],
      liveMatches: [{ id: 'm1', homeScore: 0, awayScore: 0, status: 'live' }],
      recentFinishedMatches: [],
    };
    const snapshot = {
      liveMatches: [{ id: 'm1', homeScore: 2, awayScore: 1, status: 'live', minute: 67 }],
      recentFinishedMatches: [],
    };

    const next = mergeLiveSnapshot(data, snapshot);
    expect(next.liveMatches[0].homeScore).toBe(2);
    expect(next.matches[0].homeScore).toBe(2);
    expect(next.liveMatches[0].minute).toBe(67);
  });

  it('agrega partidos nuevos al snapshot', () => {
    const data = { liveMatches: [], recentFinishedMatches: [] };
    const snapshot = {
      liveMatches: [{ id: 'live-2', homeScore: 1, awayScore: 0, status: 'live' }],
      recentFinishedMatches: [{ id: 'fin-1', homeScore: 3, awayScore: 2, status: 'finished' }],
    };

    const next = mergeLiveSnapshot(data, snapshot);
    expect(next.liveMatches).toHaveLength(1);
    expect(next.recentFinishedMatches).toHaveLength(1);
  });
});

describe('realtimeSectors', () => {
  it('identifica reasons de partido en vivo', () => {
    expect(isLiveMatchReason('live_scoring_sync')).toBe(true);
    expect(isLiveMatchReason('prediction_saved')).toBe(false);
  });

  it('filtra sectores por tipo de evento', () => {
    expect(
      shouldRefreshSector(SECTOR_TAGS.WORLDCUP_PLAYERS, {
        type: REALTIME_EVENTS.PLAYERS_UPDATED,
      })
    ).toBe(true);
    expect(
      shouldRefreshSector(SECTOR_TAGS.WORLDCUP_PLAYERS, {
        type: REALTIME_EVENTS.MATCHES_UPDATED,
      })
    ).toBe(false);
    expect(
      shouldRefreshSector(SECTOR_TAGS.ADMIN_GROUPS, {
        type: REALTIME_EVENTS.LEADERBOARD_UPDATED,
      })
    ).toBe(false);
  });
});
