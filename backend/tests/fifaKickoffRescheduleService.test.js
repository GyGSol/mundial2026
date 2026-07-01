import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/models/Match.js', () => ({
  Match: {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));
vi.mock('../src/models/Team.js', () => ({
  Team: { find: vi.fn() },
}));
vi.mock('../src/models/Stadium.js', () => ({
  Stadium: { find: vi.fn() },
}));
vi.mock('../src/services/matchScoringService.js', () => ({
  clearMatchScores: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/websocketService.js', () => ({
  notifyMatchesUpdated: vi.fn(),
}));
vi.mock('../src/services/matchRelatedCaches.js', () => ({
  invalidateMatchRelatedCaches: vi.fn(),
}));

import { Match } from '../src/models/Match.js';
import { Team } from '../src/models/Team.js';
import { Stadium } from '../src/models/Stadium.js';
import { clearMatchScores } from '../src/services/matchScoringService.js';
import { syncFifaKickoffReschedules } from '../src/services/fifaKickoffRescheduleService.js';
import { getCachedAllCalendarMatches } from '../src/services/fifaApiClient.js';

vi.mock('../src/services/fifaApiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCachedAllCalendarMatches: vi.fn(),
  };
});

describe('syncFifaKickoffReschedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aplica demora FIFA 22→23 ART y revierte live falso', async () => {
    const now = new Date('2026-07-01T01:30:00.000Z').getTime();
    const matchDoc = {
      _id: 'm79',
      externalId: '79',
      homeTeamId: '1',
      awayTeamId: '20',
      stadiumId: '3',
      status: 'live',
      kickoffAt: new Date('2026-07-01T01:00:00.000Z'),
      homeScore: 0,
      awayScore: 0,
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: 'live', finished: 'FALSE' },
    };

    Match.find.mockResolvedValue([matchDoc]);
    Team.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { externalId: '1', fifaCode: 'MEX' },
          { externalId: '20', fifaCode: 'ECU' },
        ]),
      }),
    });
    Stadium.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ externalId: '3', city: 'Guadalajara' }]),
    });
    getCachedAllCalendarMatches.mockResolvedValue([
      {
        MatchNumber: 79,
        Date: '2026-07-01T02:00:00Z',
        LocalDate: '2026-06-30T20:00:00Z',
        Home: { Abbreviation: 'MEX' },
        Away: { Abbreviation: 'ECU' },
      },
    ]);
    Match.findOneAndUpdate.mockResolvedValue({ _id: 'm79' });

    const result = await syncFifaKickoffReschedules(now);

    expect(result.updated).toHaveLength(1);
    expect(Match.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'm79' },
      expect.objectContaining({
        $set: expect.objectContaining({
          kickoffAt: new Date('2026-07-01T02:00:00Z'),
          localDate: '06/30/2026 20:00',
          status: 'upcoming',
          weatherOps: expect.objectContaining({
            phase: 'pre_kickoff_delay',
            source: 'fifa-calendar',
          }),
        }),
      }),
      { new: true }
    );
    expect(clearMatchScores).toHaveBeenCalledWith('m79');
  });

  it('no modifica si FIFA coincide con kickoff guardado', async () => {
    const now = Date.now();
    Match.find.mockResolvedValue([
      {
        _id: 'm1',
        externalId: '79',
        homeTeamId: '1',
        awayTeamId: '20',
        stadiumId: '3',
        status: 'upcoming',
        kickoffAt: new Date('2026-07-01T02:00:00.000Z'),
        weatherOps: { phase: 'normal' },
        raw: {},
      },
    ]);
    Team.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { externalId: '1', fifaCode: 'MEX' },
          { externalId: '20', fifaCode: 'ECU' },
        ]),
      }),
    });
    Stadium.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    getCachedAllCalendarMatches.mockResolvedValue([
      {
        MatchNumber: 79,
        Date: '2026-07-01T02:00:00Z',
        Home: { Abbreviation: 'MEX' },
        Away: { Abbreviation: 'ECU' },
      },
    ]);

    const result = await syncFifaKickoffReschedules(now);
    expect(result.updated).toEqual([]);
    expect(Match.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
