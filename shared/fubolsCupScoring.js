import { compareRankingEntries } from './leaderboardStats.js';
import {
  compareAvgGoalDiff,
  compareGoalDiffScore,
  formatGoalDiffScore,
} from './goalDiffStats.js';

function tournamentStatsRow(tournamentStatsByUserId, playerId, name = '') {
  const raw = tournamentStatsByUserId.get(String(playerId)) ?? {};
  return {
    ...raw,
    points: raw.totalPoints ?? raw.points ?? 0,
    pa: raw.pa ?? 0,
    gl: raw.gl ?? 0,
    gv: raw.gv ?? 0,
    gt: raw.gt ?? 0,
    pb: raw.pb ?? 0,
    difGl: raw.difGl ?? 0,
    difGv: raw.difGv ?? 0,
    pj: raw.pj ?? 0,
    name: name || raw.name || '',
  };
}

function buildTiebreakResult({
  winnerId,
  criterion,
  label,
  winnerName,
  loserName,
  winnerDisplay,
  loserDisplay,
}) {
  return {
    winnerId,
    criterion,
    label,
    winnerName,
    loserName,
    winnerDisplay,
    loserDisplay,
    summary: `Empate en puntos del partido — desempate por ${label} (${winnerDisplay} ${winnerName} vs ${loserDisplay} ${loserName}).`,
  };
}

/**
 * Explica qué criterio del ranking del torneo definió el ganador del cruce.
 * Misma cadena que pickByTournamentTiebreak / compareRankingEntries.
 */
export function describeTournamentTiebreak(
  playerAId,
  playerBId,
  tournamentStatsByUserId,
  { nameA = '', nameB = '' } = {}
) {
  const a = tournamentStatsRow(tournamentStatsByUserId, playerAId, nameA);
  const b = tournamentStatsRow(tournamentStatsByUserId, playerBId, nameB);
  const winnerId = pickByTournamentTiebreak(playerAId, playerBId, tournamentStatsByUserId);
  const winnerIsA = winnerId === String(playerAId);
  const winner = winnerIsA ? a : b;
  const loser = winnerIsA ? b : a;
  const winnerName = winner.name || (winnerIsA ? nameA : nameB) || 'Jugador A';
  const loserName = loser.name || (winnerIsA ? nameB : nameA) || 'Jugador B';

  if (b.points !== a.points) {
    return buildTiebreakResult({
      winnerId,
      criterion: 'tournament_points',
      label: 'puntos del torneo',
      winnerName,
      loserName,
      winnerDisplay: String(winner.points),
      loserDisplay: String(loser.points),
    });
  }
  if (b.pa !== a.pa) {
    return buildTiebreakResult({
      winnerId,
      criterion: 'winner_picks',
      label: 'aciertos de ganador',
      winnerName,
      loserName,
      winnerDisplay: String(winner.pa),
      loserDisplay: String(loser.pa),
    });
  }

  const glgvA = (a.gl ?? 0) + (a.gv ?? 0);
  const glgvB = (b.gl ?? 0) + (b.gv ?? 0);
  if (glgvB !== glgvA) {
    return buildTiebreakResult({
      winnerId,
      criterion: 'exact_scores',
      label: 'marcadores exactos',
      winnerName,
      loserName,
      winnerDisplay: String(winner.gl + winner.gv),
      loserDisplay: String(loser.gl + loser.gv),
    });
  }

  if (b.gt !== a.gt) {
    return buildTiebreakResult({
      winnerId,
      criterion: 'total_goals',
      label: 'aciertos de goles totales',
      winnerName,
      loserName,
      winnerDisplay: String(winner.gt),
      loserDisplay: String(loser.gt),
    });
  }

  if (a.pb !== b.pb) {
    return buildTiebreakResult({
      winnerId,
      criterion: 'bonus_points',
      label: 'puntos bonus',
      winnerName,
      loserName,
      winnerDisplay: String(winner.pb),
      loserDisplay: String(loser.pb),
    });
  }

  const gdifCmp = compareGoalDiffScore(a.difGl, a.difGv, a.pj, b.difGl, b.difGv, b.pj);
  if (gdifCmp !== 0) {
    return buildTiebreakResult({
      winnerId,
      criterion: 'goal_diff_score',
      label: 'Gdif del torneo',
      winnerName,
      loserName,
      winnerDisplay: formatGoalDiffScore(winner.difGl, winner.difGv, winner.pj) ?? '—',
      loserDisplay: formatGoalDiffScore(loser.difGl, loser.difGv, loser.pj) ?? '—',
    });
  }

  const difLocalCmp = compareAvgGoalDiff(a.difGl, a.pj, b.difGl, b.pj);
  if (difLocalCmp !== 0) {
    const winnerAvg = a.pj > 0 ? (winner.difGl / winner.pj).toFixed(3) : '0';
    const loserAvg = loser.pj > 0 ? (loser.difGl / loser.pj).toFixed(3) : '0';
    return buildTiebreakResult({
      winnerId,
      criterion: 'avg_goal_diff_local',
      label: 'error promedio como local',
      winnerName,
      loserName,
      winnerDisplay: winnerAvg,
      loserDisplay: loserAvg,
    });
  }

  const difVisitCmp = compareAvgGoalDiff(a.difGv, a.pj, b.difGv, b.pj);
  if (difVisitCmp !== 0) {
    const winnerAvg = a.pj > 0 ? (winner.difGv / winner.pj).toFixed(3) : '0';
    const loserAvg = loser.pj > 0 ? (loser.difGv / loser.pj).toFixed(3) : '0';
    return buildTiebreakResult({
      winnerId,
      criterion: 'avg_goal_diff_away',
      label: 'error promedio como visitante',
      winnerName,
      loserName,
      winnerDisplay: winnerAvg,
      loserDisplay: loserAvg,
    });
  }

  return buildTiebreakResult({
    winnerId,
    criterion: 'name',
    label: 'orden alfabético',
    winnerName,
    loserName,
    winnerDisplay: winnerName,
    loserDisplay: loserName,
  });
}

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
