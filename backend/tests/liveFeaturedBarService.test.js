import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/matchEnrichmentService.js', () => ({
  enrichMatchesForRankingDashboard: vi.fn(async (matches) =>
    matches.map((m) => ({
      id: m._id.toString(),
      status: m.status,
      matchTimeline: [{ type: 'goal', minute: 10 }],
      lineup: null,
    }))
  ),
  enrichMatchesForLiveBarSummary: vi.fn(async (matches) =>
    matches.map((m) => ({
      id: m._id.toString(),
      status: m.status,
      matchTimeline: [],
      lineup: null,
    }))
  ),
  prepareFifaShirtMapsForMatches: vi.fn(async () => {}),
}));

vi.mock('../src/services/matchLineupService.js', () => ({
  buildMatchLineupPayload: vi.fn(async () => ({ status: 'ready', home: {}, away: {} })),
}));

import {
  enrichMatchesForRankingDashboard,
  enrichMatchesForLiveBarSummary,
} from '../src/services/matchEnrichmentService.js';
import { buildMatchLineupPayload } from '../src/services/matchLineupService.js';
import { enrichFeaturedBarPayload } from '../src/services/liveFeaturedBarService.js';

describe('enrichFeaturedBarPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enriquece en detalle solo el partido indicado y resume el resto en vivo', async () => {
    const activeLiveRaw = [
      { _id: { toString: () => 'live-a' }, status: 'live' },
      { _id: { toString: () => 'live-b' }, status: 'live' },
    ];

    const result = await enrichFeaturedBarPayload({
      activeLiveRaw,
      recentFeaturedRaw: [],
      userId: undefined,
      detailMatchId: 'live-b',
    });

    expect(enrichMatchesForRankingDashboard).toHaveBeenCalledTimes(1);
    expect(enrichMatchesForRankingDashboard.mock.calls[0][0]).toHaveLength(1);
    expect(enrichMatchesForLiveBarSummary).toHaveBeenCalledTimes(1);
    expect(enrichMatchesForLiveBarSummary.mock.calls[0][0]).toHaveLength(1);
    expect(result.detailMatchId).toBe('live-b');
    expect(result.liveMatches.map((m) => m.id).sort()).toEqual(['live-a', 'live-b']);
    expect(buildMatchLineupPayload).toHaveBeenCalledTimes(1);
  });
});
