import { describe, it, expect, vi, beforeEach } from 'vitest';

const buildProbableSideMock = vi.fn();

vi.mock('../src/models/Player.js', () => ({
  Player: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock('../src/models/Team.js', () => ({
  Team: { findOne: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })) },
}));

vi.mock('../src/models/Match.js', () => ({
  Match: { updateOne: vi.fn() },
}));

vi.mock('../src/services/probableLineupService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildProbableSide: (...args) => buildProbableSideMock(...args),
  };
});

vi.mock('../src/services/apiFootballLineupClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasApiFootballKey: vi.fn(() => false),
    resolveApiFootballFixtureId: vi.fn(),
    fetchFixtureLineups: vi.fn(),
  };
});

function mkPlayers(count, prefix = 'P') {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix}${i + 1}`,
    shirtNumber: i + 1,
    position: i === 0 ? 'GK' : 'MID',
    gridX: 50,
    gridY: 50,
    isStarter: true,
  }));
}

describe('buildMatchLineupPayload hydrate incomplete sides', () => {
  beforeEach(() => {
    buildProbableSideMock.mockReset();
    buildProbableSideMock.mockImplementation(async (teamExternalId) => ({
      formation: '4-3-3',
      coach: null,
      players: mkPlayers(11, teamExternalId),
    }));
  });

  it('completa Escocia (3) cuando Marruecos ya tiene 11 en snapshot', async () => {
    const { buildMatchLineupPayload } = await import('../src/services/matchLineupService.js');

    const match = {
      externalId: '30',
      homeTeamId: 'SCO',
      awayTeamId: 'MAR',
      raw: {
        lineupSnapshot: {
          source: 'football-data',
          fetchedAt: new Date().toISOString(),
          layoutVersion: 3,
          home: { formation: '4-3-3', players: mkPlayers(3, 'SCO'), coach: null },
          away: { formation: '4-3-3', players: mkPlayers(11, 'MAR'), coach: null },
        },
      },
    };

    const payload = await buildMatchLineupPayload(match, { fetchExternalShirts: false });

    expect(payload.home.players).toHaveLength(11);
    expect(payload.away.players).toHaveLength(11);
    expect(buildProbableSideMock).toHaveBeenCalledWith('SCO', '4-3-3');
    expect(buildProbableSideMock).not.toHaveBeenCalledWith('MAR', expect.anything());
  });
});
