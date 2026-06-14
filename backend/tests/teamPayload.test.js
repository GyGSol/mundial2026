import { describe, it, expect } from 'vitest';
import { formatTeamForClient } from '../src/services/teamPayload.js';

describe('teamPayload', () => {
  const rankings = {
    asOf: '2026-06-11',
    byCode: { ARG: 1, MEX: 14, CUW: 82 },
  };

  it('incluye fifaRanking cuando hay código en el seed', () => {
    const team = formatTeamForClient(
      { externalId: '1', nameEn: 'Argentina', fifaCode: 'ARG', flag: null },
      rankings
    );
    expect(team.fifaRanking).toEqual({ rank: 1, asOf: '2026-06-11' });
  });

  it('omite fifaRanking si el país no está en el ranking', () => {
    const team = formatTeamForClient(
      { externalId: '9', nameEn: 'Unknown', fifaCode: 'ZZZ', flag: null },
      rankings
    );
    expect(team.fifaRanking).toBeUndefined();
  });
});
