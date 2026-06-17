import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Match } from '../src/models/Match.js';
import { Team } from '../src/models/Team.js';
import { Stadium } from '../src/models/Stadium.js';
import { promoteMatchesAtKickoff } from '../src/services/kickoffLiveService.js';

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
  recalculateAllLiveMatches: vi.fn(),
}));

vi.mock('../src/services/websocketService.js', () => ({
  notifyLeaderboardUpdated: vi.fn(),
  notifyMatchesUpdated: vi.fn(),
}));

vi.mock('../src/services/pushNotificationService.js', () => ({
  notifyMatchesLiveStarted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/models/Team.js', () => ({
  Team: {
    find: vi.fn(),
  },
}));

vi.mock('../src/services/fifaApiClient.js', () => ({
  fetchAllCalendarMatches: vi.fn().mockResolvedValue([]),
  resolveFifaMatchEntry: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/services/weatherService.js', () => ({
  getVenueWeatherForStadium: vi.fn().mockResolvedValue({ available: true }),
}));

vi.mock('../src/services/weatherRiskService.js', () => ({
  assessVenueWeatherRisk: vi.fn().mockResolvedValue({ riskLevel: 'low' }),
  shouldSuggestPreKickoffDelay: vi.fn().mockReturnValue(false),
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
});
