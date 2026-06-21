import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/models/Team.js', () => ({
  Team: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock('../src/models/Player.js', () => ({
  Player: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock('../src/models/Stadium.js', () => ({
  Stadium: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock('../src/models/Prediction.js', () => ({
  Prediction: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock('../src/services/predictionLockService.js', () => ({
  ensureDefaultPredictionsForUser: vi.fn(),
  enrichMatchPredictionMeta: vi.fn(() => ({
    predictionOpen: true,
    lockAt: null,
    hasPrediction: false,
  })),
}));

vi.mock('../src/services/userPredictedMatchContextCache.js', () => ({
  getCachedUserPredictedMatchContext: vi.fn(),
}));

vi.mock('../src/services/matchPhaseUtils.js', () => ({
  enrichMatchPhaseFields: vi.fn(() => ({
    type: 'knockout',
    isKnockout: true,
    knockoutPhase: 'Dieciseisavos de final',
    knockoutPhaseKey: 'round_of_32',
  })),
}));

vi.mock('../src/services/matchLiveData.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enrichMatchLiveFields: vi.fn(() => ({
      homeScore: 0,
      awayScore: 0,
    })),
  };
});

vi.mock('../src/data/broadcastSchedule.js', () => ({
  getBroadcastersForMatch: vi.fn(() => []),
}));

vi.mock('../src/services/stadiumPayload.js', () => ({
  formatStadiumForClient: vi.fn(() => null),
}));

vi.mock('../src/services/tournamentGoalsFinishedMatchesCache.js', () => ({
  getCachedFinishedMatchesForTournamentGoals: vi.fn().mockResolvedValue([]),
}));

import { Player } from '../src/models/Player.js';
import { ensureDefaultPredictionsForUser } from '../src/services/predictionLockService.js';
import { getCachedUserPredictedMatchContext } from '../src/services/userPredictedMatchContextCache.js';
import { enrichMatchLiveFields } from '../src/services/matchLiveData.js';
import {
  enrichMatchesForPredictions,
  enrichMatchesForPredictionsList,
} from '../src/services/matchEnrichmentService.js';

describe('enrichMatchesForPredictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedUserPredictedMatchContext.mockResolvedValue({
      resolvedKnockoutByExternalId: new Map([
        [
          '73',
          {
            homeTeam: { externalId: 'A2', nameEn: 'Team A2' },
            awayTeam: null,
            homeTeamSlotLabel: null,
            awayTeamSlotLabel: '2.º del grupo B',
            knockoutPhase: 'Dieciseisavos de final',
            knockoutPhaseKey: 'round_of_32',
          },
        ],
      ]),
    });
  });

  it('no invoca ensureDefaultPredictionsForUser en lectura', async () => {
    await enrichMatchesForPredictions([], 'user-id');
    expect(ensureDefaultPredictionsForUser).not.toHaveBeenCalled();
  });

  it('no carga plantillas de jugadores', async () => {
    await enrichMatchesForPredictions(
      [
        {
          _id: 'mongo73',
          externalId: '73',
          homeTeamId: 1,
          awayTeamId: 2,
          status: 'upcoming',
        },
      ],
      'user-id'
    );

    expect(Player.find).not.toHaveBeenCalled();
  });

  it('aplica slots de eliminatoria desde el contexto cacheado', async () => {
    const [match] = await enrichMatchesForPredictions(
      [
        {
          _id: 'mongo73',
          externalId: '73',
          homeTeamId: 1,
          awayTeamId: 2,
          status: 'upcoming',
          homeScore: 0,
          awayScore: 0,
        },
      ],
      'user-id'
    );

    expect(getCachedUserPredictedMatchContext).toHaveBeenCalledWith('user-id');
    expect(match.homeTeam?.externalId).toBe('A2');
    expect(match.awayTeamSlotLabel).toBe('2.º del grupo B');
    expect(match.isKnockout).toBe(true);
  });
});

describe('enrichMatchesForPredictionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedUserPredictedMatchContext.mockResolvedValue({
      resolvedKnockoutByExternalId: new Map(),
    });
  });

  it('enriquece timeline solo en vivo o barra destacada', async () => {
    const upcoming = {
      _id: 'mongo-up',
      externalId: '1',
      homeTeamId: 1,
      awayTeamId: 2,
      status: 'upcoming',
      homeScore: 0,
      awayScore: 0,
    };
    const finishedArchive = {
      _id: 'mongo-fin',
      externalId: '2',
      homeTeamId: 1,
      awayTeamId: 2,
      status: 'finished',
      homeScore: 1,
      awayScore: 0,
    };
    const live = {
      _id: 'mongo-live',
      externalId: '3',
      homeTeamId: 1,
      awayTeamId: 2,
      status: 'live',
      homeScore: 0,
      awayScore: 0,
    };
    const barFinished = {
      _id: 'mongo-bar',
      externalId: '4',
      homeTeamId: 1,
      awayTeamId: 2,
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    };

    const enriched = await enrichMatchesForPredictionsList(
      [upcoming, finishedArchive, live, barFinished],
      'user-id',
      { liveBarMatchIds: new Set(['mongo-bar']) }
    );

    expect(enriched).toHaveLength(4);
    expect(enrichMatchLiveFields).toHaveBeenCalledTimes(2);
  });
});
