import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Match } from '../src/models/Match.js';
import { Team } from '../src/models/Team.js';
import { Stadium } from '../src/models/Stadium.js';
import { promoteMatchesAtKickoff, finalizeStaleLiveMatches, syncLiveWeatherOps } from '../src/services/kickoffLiveService.js';
import { recalculateMatchScores } from '../src/services/matchScoringService.js';
import { applyInPlayWeatherSuspension } from '../src/services/matchWeatherEnrichmentService.js';
import { notifyMatchesUpdated } from '../src/services/websocketService.js';
import { notifyLiveStartForMatchIds } from '../src/services/liveStartPushService.js';

vi.mock('../src/models/Match.js', () => ({
  Match: {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../src/models/Stadium.js', () => ({
  Stadium: {
    find: vi.fn(),
  },
}));

vi.mock('../src/services/matchScoringService.js', () => ({
  recalculateMatchScores: vi.fn().mockResolvedValue({ predictions: 0, users: 0 }),
  ensureLiveScoringBaselines: vi.fn().mockResolvedValue({ matches: 0, users: 0 }),
}));

vi.mock('../src/services/websocketService.js', () => ({
  notifyLeaderboardUpdated: vi.fn(),
  notifyMatchesUpdated: vi.fn(),
}));

vi.mock('../src/services/matchRelatedCaches.js', () => ({
  invalidateMatchRelatedCaches: vi.fn(),
}));

vi.mock('../src/services/liveStartPushService.js', () => ({
  notifyLiveStartForMatchIds: vi.fn().mockResolvedValue({ sent: 0, claimed: 0 }),
}));

vi.mock('../src/models/Team.js', () => ({
  Team: {
    find: vi.fn(),
  },
}));

vi.mock('../src/services/fifaApiClient.js', () => ({
  fetchAllCalendarMatches: vi.fn().mockResolvedValue([]),
  getCachedAllCalendarMatches: vi.fn().mockResolvedValue([]),
  resolveFifaMatchEntry: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/services/weatherService.js', () => ({
  getVenueWeatherForStadium: vi.fn().mockResolvedValue({ available: true }),
}));

vi.mock('../src/services/weatherRiskService.js', () => ({
  assessVenueWeatherRisk: vi.fn().mockResolvedValue({ riskLevel: 'low', available: true }),
  shouldSuggestPreKickoffDelay: vi.fn().mockReturnValue(false),
  shouldClearInPlaySuspension: vi.fn().mockReturnValue(false),
  shouldClearContradictedInPlaySuspension: vi.fn().mockReturnValue(false),
}));

vi.mock('../src/services/matchWeatherEnrichmentService.js', () => ({
  applyWeatherOpsSuggestion: vi.fn().mockReturnValue(null),
  applyInPlayWeatherSuspension: vi.fn().mockReturnValue(null),
  refreshInPlayWeatherSuspension: vi.fn().mockReturnValue(null),
}));

vi.mock('../src/services/fifaEventSyncService.js', () => ({
  syncFifaMatchEvents: vi.fn().mockResolvedValue({ events: 0, scoringIds: [] }),
}));

describe('kickoffLiveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Match.findOneAndUpdate.mockImplementation(async (filter, update) => {
      if (filter.status === 'upcoming') {
        return {
          _id: filter._id,
          externalId: '16',
          homeTeamId: '10',
          awayTeamId: '11',
          ...update.$set,
        };
      }
      if (filter.liveStartedPushSentAt?.$exists === false) {
        return {
          _id: filter._id,
          externalId: '16',
          homeTeamId: '10',
          awayTeamId: '11',
          liveStartedPushSentAt: update.liveStartedPushSentAt,
        };
      }
      if (filter.status === 'live') {
        return {
          _id: filter._id,
          externalId: '26',
          homeTeamId: '10',
          awayTeamId: '11',
          ...update.$set,
        };
      }
      return null;
    });
    Team.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('promueve partidos con pre_kickoff_delay vencido', async () => {
    const dueMatch = {
      _id: 'id3',
      externalId: '16',
      homeTeamId: '10',
      awayTeamId: '11',
      stadiumId: '5',
      status: 'upcoming',
      kickoffAt: new Date(Date.now() - 60_000),
      homeScore: null,
      awayScore: null,
      weatherOps: {
        phase: 'pre_kickoff_delay',
        resumeEarliestAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      raw: { time_elapsed: 'notstarted' },
    };
    Match.find.mockResolvedValue([dueMatch]);
    Team.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { externalId: '10', fifaCode: 'BEL', nameEn: 'Belgium' },
          { externalId: '11', fifaCode: 'EGY', nameEn: 'Egypt' },
        ]),
      }),
    });
    Stadium.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ externalId: '5', city: 'Seattle' }]),
    });

    const promoted = await promoteMatchesAtKickoff();
    expect(promoted).toHaveLength(1);
    expect(notifyLiveStartForMatchIds).toHaveBeenCalledWith(['id3']);
    expect(Match.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'id3', status: 'upcoming' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'live' }) }),
      { new: true }
    );
  });

  it('no promueve partidos con pre_kickoff_delay activo', async () => {
    const dueMatch = {
      _id: 'id1',
      stadiumId: '5',
      status: 'upcoming',
      kickoffAt: new Date(Date.now() - 60_000),
      weatherOps: {
        phase: 'pre_kickoff_delay',
        resumeEarliestAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    };
    Match.find.mockResolvedValue([dueMatch]);
    Team.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { externalId: '10', fifaCode: 'BEL', nameEn: 'Belgium' },
          { externalId: '11', fifaCode: 'EGY', nameEn: 'Egypt' },
        ]),
      }),
    });
    Stadium.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ externalId: '5', city: 'Houston' }]),
    });

    const promoted = await promoteMatchesAtKickoff();
    expect(promoted).toEqual([]);
    expect(Match.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('promueve partidos upcoming sin bloqueo climático', async () => {
    const dueMatch = {
      _id: 'id2',
      stadiumId: '5',
      status: 'upcoming',
      kickoffAt: new Date(Date.now() - 60_000),
      homeScore: null,
      awayScore: null,
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: 'notstarted' },
    };
    Match.find.mockResolvedValue([dueMatch]);
    Team.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { externalId: '10', fifaCode: 'BEL', nameEn: 'Belgium' },
          { externalId: '11', fifaCode: 'EGY', nameEn: 'Egypt' },
        ]),
      }),
    });
    Stadium.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ externalId: '5', city: 'Houston' }]),
    });

    const promoted = await promoteMatchesAtKickoff();
    expect(promoted).toHaveLength(1);
    expect(Match.findOneAndUpdate).toHaveBeenCalled();
  });

  it('finalizeStaleLiveMatches persiste marcador desde timeline cuando no hay Score FIFA', async () => {
    const staleLive = {
      _id: 'live-final',
      externalId: '26',
      homeTeamId: '10',
      awayTeamId: '11',
      status: 'live',
      homeScore: 3,
      awayScore: 1,
      kickoffAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      raw: {
        finished: 'TRUE',
        time_elapsed: 'finished',
        fifaEvents: {
          timeline: [
            { type: 'goal', side: 'home', minute: 74 },
            { type: 'goal', side: 'home', minute: 84 },
            { type: 'goal', side: 'home', minute: 90 },
            { type: 'goal', side: 'home', minute: 92, extraMinute: 1 },
            { type: 'goal', side: 'away', minute: 55 },
            { type: 'match_end', minute: 98, extraMinute: 0 },
          ],
        },
      },
    };

    Match.find.mockImplementation((query) => ({
      lean: vi.fn().mockResolvedValue(query?.status === 'live' ? [staleLive] : []),
    }));

    const finalized = await finalizeStaleLiveMatches();
    expect(Match.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'live-final', status: 'live' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'finished',
          homeScore: 4,
          awayScore: 1,
        }),
      }),
      { new: true }
    );
    expect(recalculateMatchScores).toHaveBeenCalledWith('live-final');
  });

  it('syncLiveWeatherOps persiste suspensión climática en partidos live', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const liveMatch = {
      _id: 'live-storm',
      stadiumId: '5',
      kickoffAt: new Date(Date.now() - 60 * 60 * 1000),
      status: 'live',
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: "34'" },
      save,
    };

    Match.find.mockResolvedValue([liveMatch]);
    Stadium.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ externalId: '5', country: 'USA' }]),
    });

    applyInPlayWeatherSuspension.mockReturnValue({
      phase: 'suspended',
      reason: 'lightning',
      source: 'nws',
      since: new Date(),
      resumeEarliestAt: new Date(Date.now() + 30 * 60 * 1000),
      lastAlertAt: new Date(),
    });

    const result = await syncLiveWeatherOps();

    expect(result.suspended).toEqual(['live-storm']);
    expect(save).toHaveBeenCalled();
    expect(liveMatch.weatherOps.phase).toBe('suspended');
    expect(notifyMatchesUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'weather_in_play_suspended' })
    );
  });
});
