/** FIFA timeline Period values (observados en WC 2026). */
export const FIFA_PERIOD_PRE_MATCH = 2;
export const FIFA_PERIOD_FIRST_HALF = 3;
export const FIFA_PERIOD_HALFTIME = 4;
export const FIFA_PERIOD_SECOND_HALF = 5;
/** Prórroga / tanda de penales (FIFA usa 9 en tanda; 6–7 en alargue según partido). */
export const FIFA_PERIOD_EXTRA_TIME_FIRST = 6;
export const FIFA_PERIOD_EXTRA_TIME_SECOND = 7;
export const FIFA_PERIOD_PENALTY_SHOOTOUT = 9;
export const FIFA_PERIOD_MATCH_END = 10;

function localizedDescription(event) {
  return event?.EventDescription?.find((item) => item.Locale === 'en-GB')?.Description ?? '';
}

function extractPlayerName(description, fallback = '') {
  const trimmed = String(description ?? '').trim();
  if (!trimmed) return fallback;

  const patterns = [
    /^(.+?)\s*\([^)]+\)\s+(?:scores|misses|sees|has)/i,
    /^(.+?)\s+(?:scores|misses)(?:!!|!|\s)/i,
    /^(.+?)\s+successfully converts/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return fallback;
}

export function normalizeFifaPeriodToken(period) {
  if (period == null || period === '') return '';
  return String(period).trim().toLowerCase();
}

/** Periodo FIFA de tiempo suplementario (1.er o 2.º alargue). */
export function isFifaExtraTimePeriod(period) {
  const numeric = Number(period);
  if (
    Number.isFinite(numeric) &&
    (numeric === FIFA_PERIOD_EXTRA_TIME_FIRST || numeric === FIFA_PERIOD_EXTRA_TIME_SECOND)
  ) {
    return true;
  }

  const token = normalizeFifaPeriodToken(period);
  if (!token) return false;
  return token.includes('extra') && !token.includes('afterextra') && !token.includes('afterpenalt');
}

/** Periodo FIFA de tanda de penales (numérico o texto). */
export function isFifaShootoutPeriod(period) {
  const numeric = Number(period);
  if (Number.isFinite(numeric) && numeric === FIFA_PERIOD_PENALTY_SHOOTOUT) return true;

  const token = normalizeFifaPeriodToken(period);
  if (!token) return false;
  return (
    token.includes('penalt') ||
    token.includes('shootout') ||
    token.includes('shoot-out') ||
    token.includes('afterpenalt')
  );
}

export function isShootoutKickDescription(description) {
  const desc = String(description ?? '').trim().toLowerCase();
  if (!desc) return false;
  if (desc.includes('penalty shoot')) return true;
  if (desc.includes('shoot-out') || desc.includes('shootout')) {
    return (
      desc.includes('scores') ||
      desc.includes('misses') ||
      desc.includes('saved') ||
      desc.includes('not scored')
    );
  }
  return false;
}

export function isInGamePenaltyDescription(description) {
  const desc = String(description ?? '').trim().toLowerCase();
  return desc.includes('converts the penalty') || desc.includes('penalty converted');
}

export function isTimelineShootoutKick(event) {
  if (!event) return false;
  if (event.isShootoutKick) return true;
  if (event.type === 'penalty_shootout_kick') return true;
  if (isFifaShootoutPeriod(event.fifaPeriod)) return true;
  if (isShootoutKickDescription(event.description)) return true;
  return false;
}

/**
 * Marcador de tanda desde entrada de calendario FIFA.
 * @param {Record<string, unknown> | null | undefined} fifaEntry
 */
export function readFifaPenaltyShootoutScores(fifaEntry) {
  if (!fifaEntry) return null;

  const home = Number(
    fifaEntry.HomeTeamPenaltyScore ??
      fifaEntry.Home?.PenaltyScore ??
      fifaEntry.Home?.TeamPenaltyScore
  );
  const away = Number(
    fifaEntry.AwayTeamPenaltyScore ??
      fifaEntry.Away?.PenaltyScore ??
      fifaEntry.Away?.TeamPenaltyScore
  );

  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home < 0 || away < 0 || home > 30 || away > 30) return null;
  if (home === 0 && away === 0) return null;

  return { homeScore: home, awayScore: away };
}

export function readStoredPenaltyShootoutScores(raw = {}) {
  const meta = raw.fifaMeta ?? {};
  const home = Number(meta.homePenaltyScore);
  const away = Number(meta.awayPenaltyScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home < 0 || away < 0) return null;
  if (home === 0 && away === 0) return null;
  return { homeScore: home, awayScore: away };
}

export function inferPenaltyShootoutWinnerSide({ homeScore, awayScore, winnerTeamId, homeTeamId, awayTeamId }) {
  if (homeScore != null && awayScore != null && homeScore !== awayScore) {
    return homeScore > awayScore ? 'home' : 'away';
  }
  if (winnerTeamId && homeTeamId && awayTeamId) {
    if (String(winnerTeamId) === String(homeTeamId)) return 'home';
    if (String(winnerTeamId) === String(awayTeamId)) return 'away';
  }
  return null;
}

function resolveSide(teamId, homeTeamId, awayTeamId) {
  const id = String(teamId ?? '');
  if (id && id === String(homeTeamId)) return 'home';
  if (id && id === String(awayTeamId)) return 'away';
  return null;
}

function inferShootoutKickScored(event, description) {
  const desc = String(description ?? '').toLowerCase();
  if (desc.includes('misses') || desc.includes('saved') || desc.includes('not scored')) {
    return false;
  }
  if (event?.Type === 0 || desc.includes('scores')) return true;
  return null;
}

/**
 * Arma kicks de tanda desde eventos crudos FIFA (Period 9 u homólogos).
 * @param {Array<Record<string, unknown>>} rawEvents
 */
export function buildPenaltyShootoutKicksFromRawEvents(rawEvents = [], homeTeamId, awayTeamId) {
  const kicks = [];
  let prevHomePen = 0;
  let prevAwayPen = 0;

  for (const event of rawEvents) {
    const inShootoutPeriod = isFifaShootoutPeriod(event?.Period);
    const shootoutDesc = isShootoutKickDescription(localizedDescription(event));
    if (!inShootoutPeriod && !shootoutDesc) continue;

    const side = resolveSide(event?.IdTeam, homeTeamId, awayTeamId);
    if (!side) continue;

    const description = localizedDescription(event);
    const homePen = Number(event?.HomePenaltyGoals ?? 0);
    const awayPen = Number(event?.AwayPenaltyGoals ?? 0);
    let scored = inferShootoutKickScored(event, description);

    if (scored == null) {
      if (side === 'home' && homePen > prevHomePen) scored = true;
      else if (side === 'away' && awayPen > prevAwayPen) scored = true;
      else scored = false;
    }

    prevHomePen = Math.max(prevHomePen, homePen);
    prevAwayPen = Math.max(prevAwayPen, awayPen);

    kicks.push({
      side,
      player: extractPlayerName(description) || null,
      scored: Boolean(scored),
      description,
    });
  }

  return kicks;
}

/**
 * @param {Record<string, unknown>} raw
 * @param {Record<string, unknown> | null | undefined} [fifaEntry]
 * @param {{ homeTeamId?: string, awayTeamId?: string }} [ids]
 */
export function resolvePenaltyShootoutForMatch(raw = {}, fifaEntry = null, ids = {}) {
  const meta = raw.fifaMeta ?? {};
  const homeTeamId = ids.homeTeamId ?? meta.homeTeamId ?? fifaEntry?.Home?.IdTeam;
  const awayTeamId = ids.awayTeamId ?? meta.awayTeamId ?? fifaEntry?.Away?.IdTeam;

  const fromEntry = readFifaPenaltyShootoutScores(fifaEntry);
  const fromMeta = readStoredPenaltyShootoutScores(raw);
  const scores = fromEntry ?? fromMeta;

  const periodToken = normalizeFifaPeriodToken(
    fifaEntry?.Period ?? raw.fifaLiveState?.period ?? meta.period
  );
  const hadShootout =
    Boolean(scores) ||
    periodToken.includes('afterpenalt') ||
    isFifaShootoutPeriod(fifaEntry?.Period ?? raw.fifaLiveState?.period);

  if (!hadShootout && !scores) return null;

  const rawEvents = raw.fifaEvents?.rawEvents ?? [];
  const kicks = buildPenaltyShootoutKicksFromRawEvents(rawEvents, homeTeamId, awayTeamId);

  const homeScore = scores?.homeScore ?? kicks.filter((k) => k.scored && k.side === 'home').length;
  const awayScore = scores?.awayScore ?? kicks.filter((k) => k.scored && k.side === 'away').length;

  if (!scores && kicks.length === 0) return null;
  if (homeScore === 0 && awayScore === 0 && kicks.length === 0) return null;

  const winnerSide = inferPenaltyShootoutWinnerSide({
    homeScore,
    awayScore,
    winnerTeamId: fifaEntry?.Winner ?? meta.winnerTeamId,
    homeTeamId,
    awayTeamId,
  });

  return {
    homeScore,
    awayScore,
    winnerSide,
    kicks,
  };
}

export function partitionTimelineForShootout(timeline = []) {
  const fieldEvents = [];
  const shootoutKicks = [];

  for (const event of timeline) {
    if (isTimelineShootoutKick(event)) {
      shootoutKicks.push(event);
    } else {
      fieldEvents.push(event);
    }
  }

  return { fieldEvents, shootoutKicks };
}
