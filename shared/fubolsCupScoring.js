import { compareRankingEntries } from './leaderboardStats.js';

export function scoreMatchDuel(pointsA, pointsB) {
  const a = Number(pointsA) || 0;
  const b = Number(pointsB) || 0;
  if (a === b) return { winner: null, margin: 0 };
  if (a > b) return { winner: 'A', margin: a - b };
  return { winner: 'B', margin: b - a };
}

export function pickByTournamentTiebreak(playerAId, playerBId, tournamentStatsByUserId) {
  const tourA = tournamentStatsByUserId.get(String(playerAId)) ?? {};
  const tourB = tournamentStatsByUserId.get(String(playerBId)) ?? {};
  const cmp = compareRankingEntries(
    { ...tourA, points: tourA.totalPoints ?? tourA.points ?? 0 },
    { ...tourB, points: tourB.totalPoints ?? tourB.points ?? 0 }
  );
  return cmp < 0 ? String(playerAId) : String(playerBId);
}

/**
 * @param {object} params
 * @param {Array<{ pointsA: number, pointsB: number }>} params.matchResults
 * @param {string} params.playerAId
 * @param {string} params.playerBId
 * @param {Map<string, object>} params.tournamentStatsByUserId
 */
export function resolveDuelWinner({
  matchResults,
  playerAId,
  playerBId,
  tournamentStatsByUserId,
}) {
  const wins = { A: 0, B: 0 };
  const margins = { A: 0, B: 0 };

  for (const match of matchResults ?? []) {
    const slice = scoreMatchDuel(match.pointsA, match.pointsB);
    if (!slice.winner) continue;
    wins[slice.winner] += 1;
    margins[slice.winner] = Math.max(margins[slice.winner], slice.margin);
  }

  if (wins.A === 2) return String(playerAId);
  if (wins.B === 2) return String(playerBId);
  if (wins.A === 1 && wins.B === 0) return String(playerAId);
  if (wins.B === 1 && wins.A === 0) return String(playerBId);
  if (wins.A === 1 && wins.B === 1) {
    if (margins.A > margins.B) return String(playerAId);
    if (margins.B > margins.A) return String(playerBId);
  }

  return pickByTournamentTiebreak(playerAId, playerBId, tournamentStatsByUserId);
}

export function buildMatchResultSlice({ matchId, externalId, pointsA, pointsB, playerAId, playerBId }) {
  const slice = scoreMatchDuel(pointsA, pointsB);
  let winnerId = null;
  if (slice.winner === 'A') winnerId = String(playerAId);
  if (slice.winner === 'B') winnerId = String(playerBId);
  return {
    matchId: matchId ? String(matchId) : null,
    externalId: externalId != null ? String(externalId) : null,
    pointsA: Number(pointsA) || 0,
    pointsB: Number(pointsB) || 0,
    winnerId,
    margin: slice.margin,
  };
}
