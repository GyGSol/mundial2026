import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/models/Team.js', () => ({
  Team: {
    find: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue([
        { externalId: '27', nameEn: 'Iran', fifaCode: 'IRN', flag: '' },
        { externalId: '28', nameEn: 'New Zealand', fifaCode: 'NZL', flag: '' },
      ]),
    })),
  },
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

vi.mock('../src/services/aiTeamMatchContextService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getFifaWorldRankings: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('../src/services/matchWeatherEnrichmentService.js', () => ({
  attachWeatherAndScheduleToEnrichedMatches: vi.fn((_matches, enriched) => enriched),
}));

vi.mock('../src/services/matchLiveData.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enrichMatchLiveFields: vi.fn((match) => ({
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      status: match.status,
    })),
  };
});

import { formatMatchSummary } from '../src/services/worldCupStatsService.js';
import { enrichMatchesForPredictions } from '../src/services/matchEnrichmentService.js';

const teamMap = {
  27: { externalId: '27', nameEn: 'Iran', fifaCode: 'IRN', flag: '' },
  28: { externalId: '28', nameEn: 'New Zealand', fifaCode: 'NZL', flag: '' },
};

const sampleMatches = [
  {
    _id: 'm15',
    externalId: '15',
    homeTeamId: '27',
    awayTeamId: '28',
    homeScore: 0,
    awayScore: 1,
    group: 'G',
    matchday: '1',
    localDate: '06/15/2026 18:00',
    status: 'live',
    kickoffAt: new Date('2026-06-16T01:00:00.000Z'),
    type: 'group',
  },
  {
    _id: 'm16',
    externalId: '16',
    homeTeamId: '27',
    awayTeamId: '28',
    homeScore: 2,
    awayScore: 2,
    group: 'G',
    matchday: '2',
    localDate: '06/20/2026 18:00',
    status: 'finished',
    kickoffAt: new Date('2026-06-21T01:00:00.000Z'),
    type: 'group',
  },
  {
    _id: 'm17',
    externalId: '17',
    homeTeamId: '27',
    awayTeamId: '28',
    homeScore: 0,
    awayScore: 0,
    group: 'G',
    matchday: '3',
    localDate: '06/25/2026 18:00',
    status: 'upcoming',
    kickoffAt: new Date('2026-06-26T01:00:00.000Z'),
    type: 'group',
  },
];

function parityTriple(match) {
  return {
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  };
}

describe('matchEndpointParity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('status y marcador coinciden entre overview y predicciones para mismos externalId', async () => {
    const enriched = await enrichMatchesForPredictions(sampleMatches, undefined);

    for (const externalId of ['15', '16', '17']) {
      const raw = sampleMatches.find((m) => m.externalId === externalId);
      const overview = formatMatchSummary(raw, teamMap);
      const predictions = enriched.find((m) => m.externalId === externalId);

      expect(parityTriple(predictions)).toEqual(parityTriple(overview));
    }
  });
});
