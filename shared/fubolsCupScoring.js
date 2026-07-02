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
    summary: `Empate en puntos del partido — gana quien tiene menor ${label} (${winnerDisplay} ${winnerName} vs ${loserDisplay} ${loserName}).`,
  };
}

function pickWinnerByLowerComparison(cmp, playerAId, playerBId) {
  if (cmp === 0) return null;
  return cmp < 0 ? String(playerAId) : String(playerBId);
}

/**
 * Desempate de cruce Copa Fubols: menor Gdif del torneo gana (no puntos totales).
 * Si persiste el empate: error promedio local, visitante, orden alfabético.
 */
export function pickByGoalDiffTiebreak(playerAId, playerBId, tournamentStatsByUserId) {
  const a = tournamentStatsRow(tournamentStatsByUserId, playerAId);
  const b = tournamentStatsRow(tournamentStatsByUserId, playerBId);

  const winnerByGdif = pickWinnerByLowerComparison(
    compareGoalDiffScore(a.difGl, a.difGv, a.pj, b.difGl, b.difGv, b.pj),
    playerAId,
    playerBId
  );
  if (winnerByGdif) return winnerByGdif;

  const winnerByLocal = pickWinnerByLowerComparison(
    compareAvgGoalDiff(a.difGl, a.pj, b.difGl, b.pj),
    playerAId,
    playerBId
  );
  if (winnerByLocal) return winnerByLocal;

  const winnerByVisit = pickWinnerByLowerComparison(
    compareAvgGoalDiff(a.difGv, a.pj, b.difGv, b.pj),
    playerAId,
    playerBId
  );
  if (winnerByVisit) return winnerByVisit;

  return a.name.localeCompare(b.name, 'es') <= 0 ? String(playerAId) : String(playerBId);
}

/** @deprecated Usar pickByGoalDiffTiebreak — alias por compatibilidad interna. */
export const pickByTournamentTiebreak = pickByGoalDiffTiebreak;

/**
 * Explica el criterio de desempate del cruce (Gdif del torneo, menor gana).
 */
export function describeTournamentTiebreak(
  playerAId,
  playerBId,
  tournamentStatsByUserId,
  { nameA = '', nameB = '' } = {}
) {
  const a = tournamentStatsRow(tournamentStatsByUserId, playerAId, nameA);
  const b = tournamentStatsRow(tournamentStatsByUserId, playerBId, nameB);
  const winnerId = pickByGoalDiffTiebreak(playerAId, playerBId, tournamentStatsByUserId);
  const winnerIsA = winnerId === String(playerAId);
  const winner = winnerIsA ? a : b;
  const loser = winnerIsA ? b : a;
  const winnerName = winner.name || (winnerIsA ? nameA : nameB) || 'Jugador A';
  const loserName = loser.name || (winnerIsA ? nameB : nameA) || 'Jugador B';

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
    const winnerAvg = winner.pj > 0 ? (winner.difGl / winner.pj).toFixed(3) : '0';
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
    const winnerAvg = winner.pj > 0 ? (winner.difGv / winner.pj).toFixed(3) : '0';
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

  return pickByGoalDiffTiebreak(playerAId, playerBId, tournamentStatsByUserId);
}

/**
 * Ganador para mostrar en cruces en vivo / demo.
 * Con allowTiebreak=false (partido aún en juego): solo gana quien va arriba en puntos del partido.
 * Con allowTiebreak=true (partido(s) terminado(s)): misma lógica que resolveDuelWinner (Gdif si empatan).
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
