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

  if (wins.A > wins.B) return String(playerAId);
  if (wins.B > wins.A) return String(playerBId);
  if (wins.A === 1 && wins.B === 1) {
    if (margins.A > margins.B) return String(playerAId);
    if (margins.B > margins.A) return String(playerBId);
  }

  return pickByTournamentTiebreak(playerAId, playerBId, tournamentStatsByUserId);
}

/**
 * Ganador para mostrar en cruces en vivo / demo.
 * Con allowTiebreak=false (partido aún en juego): solo gana quien va arriba en puntos del partido.
 * Con allowTiebreak=true (partido(s) terminado(s)): misma lógica que resolveDuelWinner (incl. torneo).
 */
export function resolveDisplayDuelWinnerId({
  matchResults,
  playerAId,
  playerBId,
  tournamentStatsByUserId,
  allowTiebreak = false,
}) {
  const results = (matchResults ?? []).filter(
    (row) => row.pointsA != null && row.pointsB != null
  );
  if (!results.length) return null;

  if (allowTiebreak) {
    return resolveDuelWinner({
      matchResults: results.map((row) => ({
        pointsA: row.pointsA,
        pointsB: row.pointsB,
      })),
      playerAId,
      playerBId,
      tournamentStatsByUserId,
    });
  }

  if (results.length === 1) {
    const slice = scoreMatchDuel(results[0].pointsA, results[0].pointsB);
    if (slice.winner === 'A') return String(playerAId);
    if (slice.winner === 'B') return String(playerBId);
    return null;
  }

  const wins = { A: 0, B: 0 };
  for (const row of results) {
    const slice = scoreMatchDuel(row.pointsA, row.pointsB);
    if (slice.winner) wins[slice.winner] += 1;
  }
  if (wins.A > wins.B) return String(playerAId);
  if (wins.B > wins.A) return String(playerBId);
  return null;
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
