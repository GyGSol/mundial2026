import { describe, expect, it, vi } from 'vitest';
import {
  FULL_DASHBOARD_MATCH_REASONS,
  handleLiveSnapshotRealtime,
} from './liveRealtimeHandlers.js';
import { REALTIME_EVENTS } from './realtimeSectors.js';

describe('handleLiveSnapshotRealtime', () => {
  it('ignora eventos que no son matches:updated', () => {
    expect(
      handleLiveSnapshotRealtime(
        { type: REALTIME_EVENTS.LEADERBOARD_UPDATED, reason: 'live_scores_updated' },
        { patchData: vi.fn(), fetchSnapshot: vi.fn() }
      )
    ).toBe(false);
  });

  it('pide refetch completo cuando el partido recién finaliza', () => {
    expect(
      handleLiveSnapshotRealtime(
        { type: REALTIME_EVENTS.MATCHES_UPDATED, reason: 'stale_live_finalized' },
        { patchData: vi.fn(), fetchSnapshot: vi.fn() }
      )
    ).toBe(false);
  });

  it('pide refetch completo al kickoff si aún no hay baseline ni indicadores', () => {
    expect(
      handleLiveSnapshotRealtime(
        { type: REALTIME_EVENTS.MATCHES_UPDATED, reason: 'live_scoring_sync' },
        {
          patchData: vi.fn(),
          fetchSnapshot: vi.fn(),
          getData: () => ({
            liveMatches: [{ id: 'm1' }],
            recentFinishedMatches: [],
            leaderboardKickoffBaseline: [],
            leaderboardLiveStatIndicators: { liveMatchIds: [] },
          }),
        }
      )
    ).toBe(false);
  });

  it('parchea snapshot en vivo cuando ya hay baseline', () => {
    const fetchSnapshot = vi.fn().mockResolvedValue({ liveMatches: [], recentFinishedMatches: [] });
    const patchData = vi.fn();

    expect(
      handleLiveSnapshotRealtime(
        { type: REALTIME_EVENTS.MATCHES_UPDATED, reason: 'live_scoring_sync' },
        {
          patchData,
          fetchSnapshot,
          getData: () => ({
            liveMatches: [{ id: 'm1' }],
            leaderboardKickoffBaseline: [{ id: 'u1', rank: 1 }],
            leaderboardLiveStatIndicators: { liveMatchIds: ['m1'] },
          }),
        }
      )
    ).toBe(true);

    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('expone reasons que requieren dashboard completo', () => {
    expect(FULL_DASHBOARD_MATCH_REASONS.has('kickoff_live')).toBe(true);
    expect(FULL_DASHBOARD_MATCH_REASONS.has('stale_live_finalized')).toBe(true);
  });
});
