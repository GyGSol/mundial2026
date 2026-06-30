/** Máximo goles plausibles en tiempo reglamentario + alargue. */
const MAX_FIELD_GOALS = 15;

function isPlausibleGoalCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_FIELD_GOALS && Math.floor(n) === n;
}

function readFifaFieldScores(raw = {}) {
  const meta = raw.fifaMeta ?? {};
  const homeScore = Number(meta.homeScore);
  const awayScore = Number(meta.awayScore);
  if (!meta.syncedAt || !isPlausibleGoalCount(homeScore) || !isPlausibleGoalCount(awayScore)) {
    return null;
  }
  return { homeScore, awayScore };
}

function readPenaltyScoresFromRaw(raw = {}) {
  const meta = raw.fifaMeta ?? {};
  const home = Number(meta.homePenaltyScore);
  const away = Number(meta.awayPenaltyScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home < 0 || away < 0) return null;
  if (home === 0 && away === 0) return null;
  return { homeScore: home, awayScore: away };
}

/**
 * Penales desde el payload enriquecido o desde raw.fifaMeta (overview/bracket).
 * @param {{ penaltyShootout?: { homeScore?: number, awayScore?: number, winnerSide?: string } | null, raw?: Record<string, unknown> }} match
 */
export function resolvePenaltyShootoutFromMatch(match = {}) {
  if (match.penaltyShootout) return match.penaltyShootout;
  const scores = readPenaltyScoresFromRaw(match.raw);
  if (!scores) return null;

  const meta = match.raw?.fifaMeta ?? {};
  let winnerSide = null;
  if (scores.homeScore !== scores.awayScore) {
    winnerSide = scores.homeScore > scores.awayScore ? 'home' : 'away';
  } else if (meta.winnerTeamId && meta.homeTeamId && meta.awayTeamId) {
    const winnerId = String(meta.winnerTeamId);
    if (winnerId === String(meta.homeTeamId)) winnerSide = 'home';
    else if (winnerId === String(meta.awayTeamId)) winnerSide = 'away';
  }

  return { ...scores, winnerSide, kicks: [] };
}

/**
 * Marcador tras 120' (sin penales). Con tanda, el marcador grande debe ser el del campo.
 * @param {{ homeScore?: number | null, awayScore?: number | null, raw?: Record<string, unknown>, penaltyShootout?: { homeScore?: number, awayScore?: number } | null }} input
 */
export function resolveFieldMatchScores(input = {}) {
  const dbHome = Number(input.homeScore);
  const dbAway = Number(input.awayScore);
  const safeHome = isPlausibleGoalCount(dbHome) ? dbHome : 0;
  const safeAway = isPlausibleGoalCount(dbAway) ? dbAway : 0;

  const penaltyShootout =
    input.penaltyShootout ?? readPenaltyScoresFromRaw(input.raw ?? {});
  if (!penaltyShootout) {
    return { homeScore: safeHome, awayScore: safeAway };
  }

  const penHome = Number(penaltyShootout.homeScore) || 0;
  const penAway = Number(penaltyShootout.awayScore) || 0;
  const fromAggregateHome = safeHome - penHome;
  const fromAggregateAway = safeAway - penAway;

  if (
    isPlausibleGoalCount(fromAggregateHome) &&
    isPlausibleGoalCount(fromAggregateAway) &&
    fromAggregateHome >= 0 &&
    fromAggregateAway >= 0 &&
    fromAggregateHome === fromAggregateAway
  ) {
    return { homeScore: fromAggregateHome, awayScore: fromAggregateAway };
  }

  const fifaField = readFifaFieldScores(input.raw ?? {});
  if (fifaField && fifaField.homeScore === fifaField.awayScore) {
    return fifaField;
  }

  if (safeHome === safeAway) {
    return { homeScore: safeHome, awayScore: safeAway };
  }

  if (fifaField) {
    return fifaField;
  }

  return { homeScore: safeHome, awayScore: safeAway };
}

/**
 * Ganador visual en KO: penales primero, luego marcador de campo.
 */
export function resolveKnockoutDisplayWinner(match = {}) {
  const penalties = resolvePenaltyShootoutFromMatch(match);
  if (penalties?.winnerSide === 'home' || penalties?.winnerSide === 'away') {
    return penalties.winnerSide;
  }

  const { homeScore, awayScore } = resolveFieldMatchScores(match);
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return null;
}
