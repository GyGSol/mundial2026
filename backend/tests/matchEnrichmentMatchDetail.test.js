import { describe, it, expect, vi, beforeEach } from 'vitest';

const buildMatchLineupPayloadMock = vi.fn();

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
    predictionOpen: false,
    lockAt: null,
    hasPrediction: false,
  })),
}));

vi.mock('../src/services/matchPhaseUtils.js', () => ({
  enrichMatchPhaseFields: vi.fn(() => ({
    type: 'knockout',
    isKnockout: true,
    knockoutPhase: 'Dieciseisavos de final',
    knockoutPhaseKey: 'round_of_32',
  })),
}));

vi.mock('../src/services/aiTeamMatchContextService.js', () => ({
  getFifaWorldRankings: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/data/broadcastSchedule.js', () => ({
  getBroadcastersForMatch: vi.fn(() => []),
}));

vi.mock('../src/services/stadiumPayload.js', () => ({
  formatStadiumForClient: vi.fn(() => null),
}));

vi.mock('../src/services/teamPayload.js', () => ({
  formatTeamForClient: vi.fn((team) => team ?? { nameEn: 'Team' }),
}));

vi.mock('../src/services/kickoffTimeService.js', () => ({
  resolveDisplayKickoffAt: vi.fn((m) => m.kickoffAt),
  resolveScheduleKickoffAt: vi.fn((m) => m.kickoffAt),
}));

vi.mock('../src/services/matchWeatherEnrichmentService.js', () => ({
  attachWeatherAndScheduleToEnrichedMatches: vi.fn(async (_matches, enriched) => enriched),
}));

vi.mock('../src/services/matchLineupService.js', () => ({
  buildMatchLineupPayload: (...args) => buildMatchLineupPayloadMock(...args),
}));

import { enrichMatchesForMatchDetail } from '../src/services/matchEnrichmentService.js';

describe('enrichMatchesForMatchDetail', () => {
  beforeEach(() => {
    buildMatchLineupPayloadMock.mockReset();
    buildMatchLineupPayloadMock.mockResolvedValue({
      status: 'confirmed',
      home: { formation: '4-2-3-1', players: [{ name: 'Ronaldo' }], coach: null },
      away: { formation: '4-2-3-1', players: [{ name: 'Modric' }], coach: null },
    });
  });

  it('incluye alineación en partidos upcoming', async () => {
    const raw = {
      _id: 'mongo83',
      externalId: '83',
      homeTeamId: 'POR',
      awayTeamId: 'CRO',
      status: 'upcoming',
      kickoffAt: new Date('2026-07-02T23:00:00.000Z'),
    };

    const [match] = await enrichMatchesForMatchDetail([raw], undefined);

    expect(buildMatchLineupPayloadMock).toHaveBeenCalledTimes(1);
    expect(buildMatchLineupPayloadMock.mock.calls[0][1]).toEqual({
      fetchExternalShirts: false,
    });
    expect(match.lineup?.status).toBe('confirmed');
    expect(match.lineup?.home?.players).toHaveLength(1);
  });
});
