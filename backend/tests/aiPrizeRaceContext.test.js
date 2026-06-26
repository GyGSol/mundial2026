import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/models/UserGroupMembership.js', () => ({
  UserGroupMembership: { find: vi.fn() },
}));
vi.mock('../src/models/CompetitionGroup.js', () => ({
  CompetitionGroup: { findById: vi.fn() },
}));
vi.mock('../src/services/leaderboardService.js', () => ({
  getLeaderboard: vi.fn(),
}));
vi.mock('../src/services/prizePoolService.js', () => ({
  projectPrizeDistribution: vi.fn(async () => ({ distribution: [] })),
}));

import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { getLeaderboard } from '../src/services/leaderboardService.js';
import { projectPrizeDistribution } from '../src/services/prizePoolService.js';
import { buildPrizeRaceContext } from '../src/services/aiPrizeRaceContextService.js';

describe('aiPrizeRaceContextService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prioriza grupo cerca del corte de premios', async () => {
    const aiId = '507f1f77bcf86cd799439011';
    const groupId = '507f1f77bcf86cd799439012';

    UserGroupMembership.find.mockReturnValue({
      select: () => ({
        lean: async () => [{ groupId }],
      }),
    });

    CompetitionGroup.findById.mockReturnValue({
      select: () => ({
        lean: async () => ({ name: 'Grupo Test', prizesWinnersCount: 3 }),
      }),
    });

    getLeaderboard.mockResolvedValue([
      { id: 'u1', rank: 1, totalPoints: 50, difGl: 0, difGv: 0, pj: 5, pa: 3, pb: 2 },
      { id: 'u2', rank: 2, totalPoints: 48, difGl: 0, difGv: 0, pj: 5, pa: 2, pb: 2 },
      { id: 'u3', rank: 3, totalPoints: 46, difGl: 0, difGv: 0, pj: 5, pa: 2, pb: 1 },
      { id: aiId, rank: 4, totalPoints: 45, difGl: 2, difGv: 1, pj: 5, pa: 2, pb: 1 },
    ]);

    const ctx = await buildPrizeRaceContext(aiId, groupId);
    expect(ctx.carreraPremios.rankActual).toBe(4);
    expect(ctx.carreraPremios.enZonaPremio).toBe(false);
    expect(ctx.carreraPremios.diferenciaAlCorte).toBe(-1);
    expect(ctx.carreraPremios.notaEstrategica).toMatch(/corte de premios/i);
  });

  it('proyecta Fubols para IA en zona de premio', async () => {
    const aiId = '507f1f77bcf86cd799439011';
    const groupId = '507f1f77bcf86cd799439012';

    UserGroupMembership.find.mockReturnValue({
      select: () => ({
        lean: async () => [{ groupId }],
      }),
    });

    CompetitionGroup.findById.mockReturnValue({
      select: () => ({
        lean: async () => ({ name: 'Grupo Test', prizesWinnersCount: 3 }),
      }),
    });

    getLeaderboard.mockResolvedValue([
      { id: 'u1', rank: 1, totalPoints: 50, difGl: 0, difGv: 0, pj: 5, pa: 3, pb: 2 },
      { id: aiId, rank: 2, totalPoints: 48, difGl: 0, difGv: 0, pj: 5, pa: 2, pb: 2 },
      { id: 'u3', rank: 3, totalPoints: 46, difGl: 0, difGv: 0, pj: 5, pa: 2, pb: 1 },
    ]);

    projectPrizeDistribution.mockResolvedValue({
      distribution: [{ userId: 'u1', fubols: 500 }, { userId: aiId, fubols: 330 }],
    });

    const ctx = await buildPrizeRaceContext(aiId, groupId);
    expect(ctx.carreraPremios.rankActual).toBe(2);
    expect(ctx.carreraPremios.enZonaPremio).toBe(true);
    expect(ctx.carreraPremios.fubolsProyectadosSiTerminaAsi).toBe(330);
  });
});
