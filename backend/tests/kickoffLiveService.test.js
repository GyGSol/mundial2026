import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Match } from '../src/models/Match.js';
import { Team } from '../src/models/Team.js';
import { Stadium } from '../src/models/Stadium.js';
import { promoteMatchesAtKickoff } from '../src/services/kickoffLiveService.js';

vi.mock('../src/models/Match.js', () => ({
  Match: {
    find: vi.fn(),
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
    Team.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('promueve partidos con pre_kickoff_delay vencido', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
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
      save,
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
    expect(dueMatch.status).toBe('live');
    expect(dueMatch.weatherOps.phase).toBe('normal');
    expect(save).toHaveBeenCalled();
  });

  it('no promueve partidos con pre_kickoff_delay activo', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const dueMatch = {
      _id: 'id1',
      stadiumId: '5',
      status: 'upcoming',
      kickoffAt: new Date(Date.now() - 60_000),
      weatherOps: {
        phase: 'pre_kickoff_delay',
        resumeEarliestAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      save,
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
    expect(save).not.toHaveBeenCalled();
  });

  it('promueve partidos upcoming sin bloqueo climático', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const dueMatch = {
      _id: 'id2',
      stadiumId: '5',
      status: 'upcoming',
      kickoffAt: new Date(Date.now() - 60_000),
      homeScore: null,
      awayScore: null,
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: 'notstarted' },
      save,
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
    expect(dueMatch.status).toBe('live');
    expect(save).toHaveBeenCalled();
  });
});
