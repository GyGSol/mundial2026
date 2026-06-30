/**
 * Diagnóstico de partidos live / recién finalizados para ranking y predicciones.
 * Uso: node src/scripts/auditLiveMatchState.js [externalId ...]
 */
import dotenv from 'dotenv';
import { connectDb } from '../config/db.js';
import { Match } from '../models/Match.js';
import {
  findRecentlyFinishedMatchesQuery,
  isEligibleRecentFinishedMatch,
  pickFeaturedRecentFinishedMatches,
  RECENTLY_FINISHED_GRACE_MS,
} from '../services/matchDisplayVisibilityService.js';
import { wallClockAllowsMatchFinished } from '../services/matchStatusRules.js';
import {
  enrichMatchLiveFields,
  goalCountsFromTimeline,
  readMatchTimeline,
  resolveEffectiveLiveScores,
} from '../services/matchLiveData.js';
import { resolveOfficialKickoffAt } from '../services/kickoffTimeService.js';
import { getRankingDashboard } from '../services/rankingDashboardService.js';
import { listPredictionsMatches } from '../services/predictionsMatchesService.js';
import { resolveScoringActual } from '../services/scoringService.js';
import {
  partitionLiveMatchesByActivity,
  buildFeaturedRecentFinishedRaw,
} from '../services/liveMatchPartitionService.js';
import { buildStatIndicatorMatchIds } from '../services/rankingDashboardService.js';

dotenv.config();

const DEFAULT_IDS = ['25', '26'];

function summarizeMatch(match, now = Date.now()) {
  const raw = match.raw ?? {};
  const timeline = readMatchTimeline(raw);
  const goalCounts = goalCountsFromTimeline(timeline);
  const effective = resolveEffectiveLiveScores(match, timeline, raw);
  const officialKickoff = resolveOfficialKickoffAt(match.externalId);
  const storedKickoffMs = match.kickoffAt ? new Date(match.kickoffAt).getTime() : null;
  const officialKickoffMs = officialKickoff ? officialKickoff.getTime() : null;
  const kickoffDriftMs =
    storedKickoffMs != null && officialKickoffMs != null
      ? storedKickoffMs - officialKickoffMs
      : null;

  const finishedMs = match.finishedAt ? new Date(match.finishedAt).getTime() : null;
  const graceRemainingMs =
    finishedMs != null ? RECENTLY_FINISHED_GRACE_MS - (now - finishedMs) : null;

  const scoringActual = resolveScoringActual(match);
  const scoringDrift =
    match.homeScore !== scoringActual.home || match.awayScore !== scoringActual.away;

  return {
    externalId: match.externalId,
    id: match._id.toString(),
    status: match.status,
    homeScoreDb: match.homeScore,
    awayScoreDb: match.awayScore,
    scoringActualHome: scoringActual.home,
    scoringActualAway: scoringActual.away,
    scoringDrift,
    homeScoreEffective: effective.homeScore,
    awayScoreEffective: effective.awayScore,
    scoreMismatch:
      match.homeScore !== effective.homeScore || match.awayScore !== effective.awayScore,
    kickoffAt: match.kickoffAt,
    kickoffTimezone: match.kickoffTimezone,
    officialKickoffAt: officialKickoff?.toISOString() ?? null,
    kickoffDriftMs,
    kickoffDriftOk: kickoffDriftMs == null || Math.abs(kickoffDriftMs) <= 60_000,
    finishedAt: match.finishedAt,
    graceRemainingMin:
      graceRemainingMs != null ? Math.round(graceRemainingMs / 60_000) : null,
    inGrace: graceRemainingMs != null && graceRemainingMs > 0,
    eligibleRecentFinished: isEligibleRecentFinishedMatch(match, now),
    wallClockAllowsFinished: wallClockAllowsMatchFinished(match, now),
    fifaMeta: {
      homeScore: raw.fifaMeta?.homeScore ?? null,
      awayScore: raw.fifaMeta?.awayScore ?? null,
      syncedAt: raw.fifaMeta?.syncedAt ?? null,
    },
    timelineGoals: goalCounts,
    timelineEventCount: timeline.length,
    timelineGoalEvents: timeline.filter((e) => e.type === 'goal').length,
    enriched: (() => {
      const e = enrichMatchLiveFields(match);
      return {
        homeScore: e.homeScore,
        awayScore: e.awayScore,
        matchTimelineLength: e.matchTimeline?.length ?? 0,
        timeElapsed: e.timeElapsed,
      };
    })(),
  };
}

async function main() {
  const ids = process.argv.slice(2);
  const externalIds = ids.length ? ids : DEFAULT_IDS;
  const now = Date.now();

  await connectDb();

  const liveMatches = await Match.find({ status: 'live' }).lean();
  const recentRaw = await Match.find(findRecentlyFinishedMatchesQuery(now)).lean();
  const featured = pickFeaturedRecentFinishedMatches(recentRaw, now);
  const { activeLiveRaw, staleLiveRaw } = partitionLiveMatchesByActivity(liveMatches, now);
  const featuredAfterDedup = buildFeaturedRecentFinishedRaw(recentRaw, staleLiveRaw, now, {
    activeLiveRaw,
  });
  const activeLiveIds = new Set(activeLiveRaw.map((m) => m._id.toString()));
  const featuredIds = new Set(featuredAfterDedup.map((m) => m._id.toString()));
  const duplicateLiveRecentIds = [...activeLiveIds].filter((id) => featuredIds.has(id));
  const indicatorBaselineMatchIds = buildStatIndicatorMatchIds(
    activeLiveRaw.map((m) => m._id.toString()),
    featuredAfterDedup.map((m) => m._id.toString())
  );

  const requested = await Match.find({ externalId: { $in: externalIds } }).lean();
  const byExternalId = new Map(requested.map((m) => [String(m.externalId), m]));

  const report = {
    auditedAt: new Date().toISOString(),
    graceWindowMin: RECENTLY_FINISHED_GRACE_MS / 60_000,
    liveCount: liveMatches.length,
    recentFinishedInQuery: recentRaw.map((m) => m.externalId),
    featuredExternalIds: featured.map((m) => m.externalId),
    featuredAfterDedupExternalIds: featuredAfterDedup.map((m) => m.externalId),
    duplicateLiveRecentIds,
    duplicateLiveRecentExternalIds: duplicateLiveRecentIds
      .map((id) => liveMatches.find((m) => m._id.toString() === id)?.externalId)
      .filter(Boolean),
    indicatorBaselineMatchIds,
    indicatorBaselineExternalIds: indicatorBaselineMatchIds
      .map((id) => {
        const fromLive = liveMatches.find((m) => m._id.toString() === id);
        if (fromLive) return fromLive.externalId;
        const fromRecent = recentRaw.find((m) => m._id.toString() === id);
        return fromRecent?.externalId ?? id;
      }),
    featuredExplanation:
      featured.length === 0
        ? 'Ningún partido elegible en gracia (o todos expirados / wall clock)'
        : `Máx 1 destacado: #${featured[0].externalId} (finishedAt más reciente elegible)`,
    live: liveMatches.map((m) => summarizeMatch(m, now)),
    requested: externalIds.map((id) => {
      const match = byExternalId.get(String(id));
      if (!match) return { externalId: id, error: 'not_found' };
      return summarizeMatch(match, now);
    }),
    recentFinishedAll: recentRaw.map((m) => summarizeMatch(m, now)),
    apiSnapshot: {},
  };

  const [dashboard, predictions] = await Promise.all([
    getRankingDashboard(null, null),
    listPredictionsMatches({}, null),
  ]);

  const barMatchIds = new Set([
    ...(dashboard.liveMatches ?? []).map((m) => m.id),
    ...(dashboard.recentFinishedMatches ?? []).map((m) => m.id),
  ]);
  const liveBarIds = new Set((dashboard.liveMatches ?? []).map((m) => m.id));
  const recentBarIds = new Set((dashboard.recentFinishedMatches ?? []).map((m) => m.id));
  const duplicateInRankingBar = [...liveBarIds].filter((id) => recentBarIds.has(id));
  const duplicateInPredictionsBar = [
    ...new Set((predictions.liveMatches ?? []).map((m) => m.id)),
  ].filter((id) => new Set((predictions.recentFinishedMatches ?? []).map((m) => m.id)).has(id));

  report.apiSnapshot = {
    duplicateInRankingBar,
    duplicateInPredictionsBar,
    ranking: {
      live: (dashboard.liveMatches ?? []).map((m) => ({
        externalId: m.externalId,
        id: m.id,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
      })),
      recentFinished: (dashboard.recentFinishedMatches ?? []).map((m) => ({
        externalId: m.externalId,
        id: m.id,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
      })),
    },
    predictions: {
      live: (predictions.liveMatches ?? []).map((m) => ({
        externalId: m.externalId,
        id: m.id,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
      })),
      recentFinished: (predictions.recentFinishedMatches ?? []).map((m) => ({
        externalId: m.externalId,
        id: m.id,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
      })),
    },
    scoreParityOk: [...barMatchIds].every((id) => {
      const rankMatch = [...(dashboard.liveMatches ?? []), ...(dashboard.recentFinishedMatches ?? [])].find(
        (m) => m.id === id
      );
      const predMatch = [...(predictions.liveMatches ?? []), ...(predictions.recentFinishedMatches ?? [])].find(
        (m) => m.id === id
      );
      if (!rankMatch || !predMatch) return true;
      return (
        rankMatch.homeScore === predMatch.homeScore &&
        rankMatch.awayScore === predMatch.awayScore
      );
    }),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
