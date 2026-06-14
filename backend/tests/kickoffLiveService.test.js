import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Match } from '../src/models/Match.js';
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
  });

  it('no promueve partidos con pre_kickoff_delay', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const dueMatch = {
      _id: 'id1',
      stadiumId: '5',
      status: 'upcoming',
      kickoffAt: new Date(Date.now() - 60_000),
      weatherOps: { phase: 'pre_kickoff_delay' },
      save,
    };
    Match.find.mockResolvedValue([dueMatch]);
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
    Stadium.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ externalId: '5', city: 'Houston' }]),
    });

    const promoted = await promoteMatchesAtKickoff();
    expect(promoted).toHaveLength(1);
    expect(dueMatch.status).toBe('live');
    expect(save).toHaveBeenCalled();
  });
});
