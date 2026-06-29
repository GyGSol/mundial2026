import { describe, it, expect } from 'vitest';
import {
  resolveFieldMatchScores,
  resolveKnockoutDisplayWinner,
  resolvePenaltyShootoutFromMatch,
} from '../../shared/matchDisplayScore.js';

describe('matchDisplayScore', () => {
  it('sin penales devuelve el marcador tal cual', () => {
    expect(resolveFieldMatchScores({ homeScore: 2, awayScore: 1 })).toEqual({
      homeScore: 2,
      awayScore: 1,
    });
  });

  it('con penales prefiere fifaMeta de campo (120 min)', () => {
    expect(
      resolveFieldMatchScores({
        homeScore: 4,
        awayScore: 5,
        raw: {
          fifaMeta: {
            syncedAt: '2026-06-29T00:00:00.000Z',
            homeScore: 1,
            awayScore: 1,
            homePenaltyScore: 3,
            awayPenaltyScore: 4,
          },
        },
        penaltyShootout: { homeScore: 3, awayScore: 4 },
      })
    ).toEqual({ homeScore: 1, awayScore: 1 });
  });

  it('resta penales del agregado FIFA cuando fifaMeta de campo falta', () => {
    expect(
      resolveFieldMatchScores({
        homeScore: 4,
        awayScore: 5,
        penaltyShootout: { homeScore: 3, awayScore: 4 },
      })
    ).toEqual({ homeScore: 1, awayScore: 1 });
  });

  it('resuelve penales desde raw.fifaMeta en overview', () => {
    const shootout = resolvePenaltyShootoutFromMatch({
      homeScore: 4,
      awayScore: 5,
      raw: {
        fifaMeta: {
          homePenaltyScore: 2,
          awayPenaltyScore: 3,
          winnerTeamId: 'par',
          homeTeamId: 'ger',
          awayTeamId: 'par',
        },
      },
    });
    expect(shootout).toMatchObject({ homeScore: 2, awayScore: 3, winnerSide: 'away' });
  });

  it('el ganador en KO empatado sale de penales', () => {
    const winner = resolveKnockoutDisplayWinner({
      homeScore: 4,
      awayScore: 5,
      penaltyShootout: { homeScore: 3, awayScore: 4, winnerSide: 'away' },
      raw: {
        fifaMeta: {
          syncedAt: '2026-06-29T00:00:00.000Z',
          homeScore: 1,
          awayScore: 1,
        },
      },
    });
    expect(winner).toBe('away');
  });
});
