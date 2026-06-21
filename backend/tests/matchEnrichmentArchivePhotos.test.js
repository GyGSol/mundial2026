import { describe, it, expect, vi, beforeEach } from 'vitest';

const playerFindLean = vi.fn();

vi.mock('../src/models/Team.js', () => ({
  Team: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock('../src/models/Player.js', () => ({
  Player: {
    find: vi.fn(() => ({ lean: playerFindLean })),
  },
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
    type: 'group',
    isKnockout: false,
    knockoutPhase: null,
    knockoutPhaseKey: null,
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
  formatTeamForClient: vi.fn((team) => team),
}));

vi.mock('../src/services/kickoffTimeService.js', () => ({
  resolveDisplayKickoffAt: vi.fn((m) => m.kickoffAt),
  resolveScheduleKickoffAt: vi.fn((m) => m.kickoffAt),
}));

vi.mock('../src/services/matchWeatherEnrichmentService.js', () => ({
  attachWeatherAndScheduleToEnrichedMatches: vi.fn(async (_matches, enriched) => enriched),
}));

import { Player } from '../src/models/Player.js';
import { enrichMatchesForRankingArchive } from '../src/services/matchEnrichmentService.js';

describe('enrichMatchesForRankingArchive roster photos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerFindLean.mockResolvedValue([
      {
        teamExternalId: '20',
        fullName: 'Nilson Angulo',
        fifaCode: 'ECU',
        photoKey: 'ecuador/ecu-nilson-angulo.png',
        externalId: 'ECU-nilson-angulo',
      },
    ]);
  });

  it('carga plantel para enriquecer fotos de sustituciones en archivo finalizado', async () => {
    const [match] = await enrichMatchesForRankingArchive(
      [
        {
          _id: 'mongo34',
          externalId: '34',
          homeTeamId: '20',
          awayTeamId: '18',
          status: 'finished',
          homeScore: 2,
          awayScore: 0,
          raw: {
            fifaEvents: {
              timeline: [
                {
                  type: 'substitution',
                  side: 'home',
                  minute: 71,
                  playerOut: 'Pervis ESTUPINAN',
                  playerIn: 'Nilson ANGULO',
                  sortKey: 71,
                },
              ],
            },
          },
        },
      ],
      null
    );

    expect(Player.find).toHaveBeenCalled();
    expect(match.homeSubstitutions).toHaveLength(1);
    expect(match.homeSubstitutions[0].playerInPhotoUrl).toContain('ecu-nilson-angulo.png');
  });
});
