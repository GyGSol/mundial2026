import { enrichMatchPhaseFields } from './matchPhaseUtils.js';
import {
  FIFA_PERIOD_MATCH_END,
  isFifaExtraTimePeriod,
  isFifaShootoutPeriod,
  normalizeFifaPeriodToken,
  resolvePenaltyShootoutForMatch,
} from './penaltyShootoutService.js';
import { parseElapsedClockToSortKey, parseScorersField, latestMinuteFromScorerLists } from './matchLiveData.js';

function readElapsedToken(match) {
  const raw = match?.raw ?? {};
  return String(raw.time_elapsed ?? raw.timeElapsed ?? '').trim().toLowerCase();
}

function elapsedTokenIndicatesFinished(elapsed) {
  const normalized = String(elapsed ?? '').trim().toLowerCase();
  return (
    normalized === 'finished' ||
    normalized === 'ft' ||
    normalized === 'fulltime' ||
    normalized === 'final'
  );
}

function maxTimelineSortKey(match) {
  const timeline = match?.raw?.fifaEvents?.timeline ?? match?.matchTimeline;
  if (!Array.isArray(timeline) || !timeline.length) return Number.NEGATIVE_INFINITY;

  let bestKey = Number.NEGATIVE_INFINITY;
  for (const event of timeline) {
    if (event.minute == null || !Number.isFinite(Number(event.minute))) continue;
    const key =
      event.sortKey != null
        ? Number(event.sortKey)
        : parseElapsedClockToSortKey(
            event.extraMinute != null && Number(event.extraMinute) > 0
              ? `${event.minute}+${event.extraMinute}'`
              : `${event.minute}'`
          );
    if (key > bestKey) bestKey = key;
  }
  return bestKey;
}

function maxEffectivePlayMinute(match) {
  const timelineMinute = maxTimelineSortKey(match);
  const raw = match?.raw ?? {};
  const scorerLabel = latestMinuteFromScorerLists(
    parseScorersField(raw.home_scorers ?? raw.homeScorers),
    parseScorersField(raw.away_scorers ?? raw.awayScorers)
  );
  const scorerMinute = scorerLabel ? parseElapsedClockToSortKey(scorerLabel) : null;

  if (timelineMinute <= Number.NEGATIVE_INFINITY && scorerMinute == null) return null;
  if (timelineMinute <= Number.NEGATIVE_INFINITY) return scorerMinute;
  if (scorerMinute == null) return timelineMinute;
  return Math.max(timelineMinute, scorerMinute);
}

function readFifaPeriodToken(match, fifaEntry = null) {
  const raw = match?.raw ?? {};
  return normalizeFifaPeriodToken(
    fifaEntry?.Period ?? raw.fifaLiveState?.period ?? raw.fifaMeta?.period ?? ''
  );
}

function matchScoresAreTied(match) {
  const home = Number(match?.homeScore) || 0;
  const away = Number(match?.awayScore) || 0;
  return home === away;
}

function penaltyShootoutDecided(match, fifaEntry = null) {
  const shootout = resolvePenaltyShootoutForMatch(match?.raw ?? {}, fifaEntry);
  if (!shootout) return false;
  if (shootout.winnerSide) return true;
  const home = Number(shootout.homeScore);
  const away = Number(shootout.awayScore);
  return Number.isFinite(home) && Number.isFinite(away) && home !== away;
}

/** Empate en eliminatoria: el partido sigue (alargue o penales), no cerrar como finalizado. */
export function knockoutTieBlocksMatchFinish(match, fifaEntry = null) {
  if (!enrichMatchPhaseFields(match).isKnockout) return false;
  if (!matchScoresAreTied(match)) return false;
  if (penaltyShootoutDecided(match, fifaEntry)) return false;

  const raw = match?.raw ?? {};
  const period = fifaEntry?.Period ?? raw.fifaLiveState?.period ?? raw.fifaMeta?.period;
  const periodToken = readFifaPeriodToken(match, fifaEntry);

  if (periodToken.includes('afterpenalt')) return false;
  if (Number(period) === FIFA_PERIOD_MATCH_END) return false;

  if (isFifaExtraTimePeriod(period) || isFifaShootoutPeriod(period)) return true;

  const playMinute = maxEffectivePlayMinute(match);
  if (playMinute != null && playMinute > 90) return true;

  const finishedFlag = raw.finished ?? raw.Finished;
  if (finishedFlag === 'TRUE' || finishedFlag === true || finishedFlag === 'true') return true;
  if (elapsedTokenIndicatesFinished(readElapsedToken(match))) return true;

  if (periodToken.includes('afterextra')) return true;

  if (periodToken.includes('full') || Number(period) === 5) return true;

  return false;
}

export function matchIndicatesExtraTimePlay(match, fifaEntry = null) {
  const raw = match?.raw ?? {};
  const period = fifaEntry?.Period ?? raw.fifaLiveState?.period ?? raw.fifaLiveState?.Period;
  if (isFifaExtraTimePeriod(period)) return true;

  const playMinute = maxEffectivePlayMinute(match);
  return playMinute != null && playMinute > 90;
}
