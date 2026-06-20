import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ensureOfficialKnockoutMatches,
  isOfficialKnockoutExternalId,
  isPlaceholderTeamSlot,
  OFFICIAL_KNOCKOUT_EXTERNAL_IDS,
  resolveExistingMatchForWorldCup26Sync,
} from '../src/services/syncService.js';
import { normalizeGame } from '../src/services/worldCupApiClient.js';

const matchFindOne = vi.fn();
const matchCountDocuments = vi.fn();
const matchFindOneAndUpdate = vi.fn();

vi.mock('../src/models/Match.js', () => ({
  Match: {
    findOne: (...args) => matchFindOne(...args),
    countDocuments: (...args) => matchCountDocuments(...args),
    findOneAndUpdate: (...args) => matchFindOneAndUpdate(...args),
  },
}));

const fetchGames = vi.fn();

vi.mock('../src/services/worldCupApiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchGames: (...args) => fetchGames(...args),
  };
});

vi.mock('../src/models/Stadium.js', () => ({
  Stadium: {
    find: () => ({
      select: () => ({
        lean: () => Promise.resolve([]),
      }),
    }),
  },
}));

vi.mock('../src/services/matchMicroEventService.js', () => ({
  syncMicroEventsFromMatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/worldCupOverviewCache.js', () => ({
  invalidateWorldCupOverviewCache: vi.fn(),
}));

function knockoutGame(externalId, homeLabel, awayLabel, type = 'r32') {
  return {
    id: String(externalId),
    home_team_id: '0',
    away_team_id: '0',
    home_score: '0',
    away_score: '0',
    group: type === 'final' ? 'FINAL' : 'R32',
    matchday: '4',
    local_date: '06/28/2026 12:00',
    stadium_id: '16',
    finished: 'FALSE',
    time_elapsed: 'notstarted',
    type,
    home_team_label: homeLabel,
    away_team_label: awayLabel,
  };
}

describe('knockoutFixtureSync helpers', () => {
  it('detecta placeholders 0/0 y ids oficiales KO', () => {
    expect(isPlaceholderTeamSlot('0', '0')).toBe(true);
    expect(isPlaceholderTeamSlot('', '')).toBe(true);
    expect(isPlaceholderTeamSlot('1', '0')).toBe(false);
    expect(isOfficialKnockoutExternalId('73')).toBe(true);
    expect(isOfficialKnockoutExternalId('72')).toBe(false);
    expect(OFFICIAL_KNOCKOUT_EXTERNAL_IDS).toHaveLength(32);
  });
});

describe('resolveExistingMatchForWorldCup26Sync', () => {
  beforeEach(() => {
    matchFindOne.mockReset();
  });

  it('no colapsa dos placeholders KO distintos por par 0/0', async () => {
    const corrupted73 = {
      _id: 'm73',
      externalId: '73',
      homeTeamId: '0',
      awayTeamId: '0',
      type: 'final',
    };

    matchFindOne.mockImplementation((query) => {
      if (query.externalId === '73') {
        return { lean: () => Promise.resolve(corrupted73) };
      }
      if (query.externalId === '74') {
        return { lean: () => Promise.resolve(null) };
      }
      return { lean: () => Promise.resolve(null) };
    });

    const doc73 = normalizeGame(knockoutGame(73, 'Runner-up Group A', 'Runner-up Group B'));
    const doc74 = normalizeGame(knockoutGame(74, 'Winner Group E', '3rd Group A/B/C/D/F'));

    const existing73 = await resolveExistingMatchForWorldCup26Sync(doc73);
    const existing74 = await resolveExistingMatchForWorldCup26Sync(doc74);

    expect(existing73?.externalId).toBe('73');
    expect(existing74).toBeNull();
    expect(matchFindOne).not.toHaveBeenCalledWith({
      homeTeamId: '0',
      awayTeamId: '0',
    });
  });
});

describe('ensureOfficialKnockoutMatches', () => {
  beforeEach(() => {
    matchFindOne.mockReset();
    matchCountDocuments.mockReset();
    matchFindOneAndUpdate.mockReset();
    fetchGames.mockReset();
  });

  it('re-importa los 32 partidos KO cuando faltan en la base', async () => {
    const games = OFFICIAL_KNOCKOUT_EXTERNAL_IDS.map((id, index) => {
      if (id === '73') {
        return knockoutGame(73, 'Runner-up Group A', 'Runner-up Group B');
      }
      if (id === '104') {
        return knockoutGame(104, 'Winner Match 101', 'Winner Match 102', 'final');
      }
      return knockoutGame(
        id,
        `Winner Group ${String.fromCharCode(65 + (index % 12))}`,
        'Runner-up Group B'
      );
    });

    fetchGames.mockResolvedValue({ games });

    matchCountDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(32);

    matchFindOne.mockImplementation((query) => {
      if (query.externalId === '73') {
        return {
          lean: () =>
            Promise.resolve({
              _id: 'm73',
              externalId: '73',
              homeTeamId: '0',
              awayTeamId: '0',
              type: 'final',
              status: 'upcoming',
              raw: {
                home_team_label: 'Winner Match 101',
                away_team_label: 'Winner Match 102',
              },
            }),
        };
      }
      return { lean: () => Promise.resolve(null) };
    });

    matchFindOneAndUpdate.mockImplementation((_query, update) =>
      Promise.resolve({
        _id: `m-${update.$set.externalId}`,
        ...update.$set,
      })
    );

    const result = await ensureOfficialKnockoutMatches();

    expect(result.repaired).toBe(true);
    expect(result.count).toBe(32);
    expect(result.previousCount).toBe(1);
    expect(fetchGames).toHaveBeenCalledTimes(1);
    expect(matchFindOneAndUpdate).toHaveBeenCalled();
  });

  it('no hace nada si ya hay 32 partidos KO', async () => {
    matchCountDocuments.mockResolvedValueOnce(32);

    const result = await ensureOfficialKnockoutMatches();

    expect(result.repaired).toBe(false);
    expect(result.count).toBe(32);
    expect(fetchGames).not.toHaveBeenCalled();
  });

  it('no rompe si worldcup26 no responde', async () => {
    matchCountDocuments.mockResolvedValueOnce(3);
    fetchGames.mockRejectedValue(new Error('fetch failed'));

    const result = await ensureOfficialKnockoutMatches();

    expect(result.repaired).toBe(false);
    expect(result.count).toBe(3);
    expect(result.error).toBe('fetch failed');
  });
});
