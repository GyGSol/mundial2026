import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/models/Team.js', () => ({
  Team: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock('../src/models/Player.js', () => ({
  Player: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
  HEALTH_STATUSES: ['available', 'injured', 'doubt'],
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
  getCachedTournamentGoalCountsBundle: vi.fn().mockResolvedValue({
    globalCounts: new Map(),
    goalsByExternalId: new Map(),
  }),
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

  it('propaga slotSourceMatch para Ganador de con banderas', async () => {
    getCachedUserPredictedMatchContext.mockResolvedValue({
      resolvedKnockoutByExternalId: new Map([
        [
          '97',
          {
            homeTeam: null,
            awayTeam: null,
            homeTeamSlotLabel: 'Ganador de ARG vs FRA',
            awayTeamSlotLabel: 'Ganador de BRA vs GER',
            homeTeamSlotSourceMatch: {
              homeTeam: { externalId: 'ARG', fifaCode: 'ARG', nameEn: 'Argentina' },
              awayTeam: { externalId: 'FRA', fifaCode: 'FRA', nameEn: 'France' },
              homeTeamSlotLabel: null,
              awayTeamSlotLabel: null,
            },
            awayTeamSlotSourceMatch: {
              homeTeam: { externalId: 'BRA', fifaCode: 'BRA', nameEn: 'Brazil' },
              awayTeam: { externalId: 'GER', fifaCode: 'GER', nameEn: 'Germany' },
              homeTeamSlotLabel: null,
              awayTeamSlotLabel: null,
            },
            knockoutPhase: 'Cuartos de final',
            knockoutPhaseKey: 'quarter_final',
          },
        ],
      ]),
    });

    const [match] = await enrichMatchesForPredictions(
      [
        {
          _id: 'mongo97',
          externalId: '97',
          homeTeamId: 0,
          awayTeamId: 0,
          status: 'upcoming',
          homeScore: 0,
          awayScore: 0,
        },
      ],
      'user-id'
    );

    expect(match.homeTeamSlotSourceMatch?.homeTeam?.fifaCode).toBe('ARG');
    expect(match.awayTeamSlotSourceMatch?.awayTeam?.fifaCode).toBe('GER');
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

  it('expone marcador de 120 min y penales en finalizados sin timeline en vivo', async () => {
    const [match] = await enrichMatchesForPredictionsList(
      [
        {
          _id: 'mongo74',
          externalId: '74',
          homeTeamId: 1,
          awayTeamId: 2,
          status: 'finished',
          homeScore: 4,
          awayScore: 5,
          raw: {
            fifaMeta: {
              homeScore: 4,
              awayScore: 5,
              homePenaltyScore: 3,
              awayPenaltyScore: 4,
            },
          },
        },
      ],
      'user-id',
      { liveBarMatchIds: new Set() }
    );

    expect(match.homeScore).toBe(1);
    expect(match.awayScore).toBe(1);
    expect(match.penaltyShootout?.homeScore).toBe(3);
    expect(match.penaltyShootout?.awayScore).toBe(4);
    expect(enrichMatchLiveFields).not.toHaveBeenCalled();
  });
});
