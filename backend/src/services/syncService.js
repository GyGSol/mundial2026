import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Stadium } from '../models/Stadium.js';
import { SyncMeta } from '../models/SyncMeta.js';
import {
  authenticate,
  fetchGames,
  fetchTeams,
  fetchGroups,
  fetchStadiums,
  normalizeGame,
  normalizeTeam,
  normalizeGroup,
  normalizeStadium,
} from './worldCupApiClient.js';
import { GROUP_LETTERS, organizeTeamsByGroup } from './simulationTournamentService.js';
import {
  recalculateMatchScores,
  recalculateAllLiveMatches,
  clearMatchScores,
  clearStaleUpcomingMatchScores,
} from './matchScoringService.js';
import { resolveStadiumTimezone } from './stadiumTimezones.js';
import {
  elapsedTokenIndicatesFinished,
  isMatchKickoffStale,
  isMatchClearlyInProgress,
  matchEvidenceShowsInProgress,
  readElapsedToken,
  shouldFinalizeStaleLiveMatch,
  wallClockAllowsMatchFinished,
} from './matchStatusRules.js';
import { applyStatusTransitionFields } from './matchDisplayVisibilityService.js';
import { latestClockFromTimeline } from './matchLiveData.js';
import { env } from '../config/env.js';
import {
  notifyLeaderboardUpdated,
  notifyMatchesUpdated,
  notifySyncComplete,
} from './websocketService.js';
import { syncLiveLineups, syncUpcomingKickoffLineups, syncUpcomingLineupGrids } from './lineupSyncService.js';
import { syncFifaMatchEvents, syncFifaReportsForMatchIds } from './fifaEventSyncService.js';
import { alignMatchesFromFifaCalendar } from './fifaFixtureAlignmentService.js';
import { auditPredictionMatchLinks } from './predictionMatchLinkService.js';
import { assistLiveMatchEvents } from './liveMatchEventAssistService.js';
import {
  collectWorldCup26SyncWarning,
  runPostSyncMatchAudit,
} from './matchIntegrityAuditService.js';
import { resolveAndApplySourceDisputes } from './aiMatchSourceResolverService.js';
import { syncMicroEventsFromMatch } from './matchMicroEventService.js';
import {
  mergePlausibleGoalCounts,
  readFifaAuthoritativeScores,
  sanitizeMatchGoalCount,
  sanitizeMatchScores,
} from './matchLiveData.js';

async function upsertTeams() {
  const data = await fetchTeams();
  const list = Array.isArray(data) ? data : data?.teams ?? data?.data ?? [];
  for (const item of list) {
    const doc = normalizeTeam(item);
    await Team.findOneAndUpdate(
      { externalId: doc.externalId },
      { $set: doc },
      { upsert: true, new: true }
    );
  }
  return list.length;
}

async function upsertGroups() {
  const data = await fetchGroups();
  const list = Array.isArray(data) ? data : data?.groups ?? data?.data ?? [];
  let i = 0;
  for (const item of list) {
    const doc = normalizeGroup(item, i++);
    await Group.findOneAndUpdate(
      { name: doc.name },
      { $set: doc },
      { upsert: true, new: true }
    );
  }
  return list.length;
}

async function upsertStadiums() {
  try {
    const data = await fetchStadiums();
    const list = Array.isArray(data) ? data : data?.stadiums ?? data?.data ?? [];
    for (const item of list) {
      const doc = normalizeStadium(item);
      if (!doc.externalId) continue;
      await Stadium.findOneAndUpdate(
        { externalId: doc.externalId },
        { $set: doc },
        { upsert: true, new: true }
      );
    }
    return list.length;
  } catch (err) {
    console.warn('Stadium sync skipped:', err.message);
    return Stadium.countDocuments();
  }
}

async function buildStadiumTimezoneMap() {
  const stadiums = await Stadium.find().select('externalId timezone city country nameEn').lean();
  const map = {};
  for (const stadium of stadiums) {
    map[stadium.externalId] =
      stadium.timezone || resolveStadiumTimezone(stadium) || null;
  }
  return map;
}

export function mergeSyncedRaw(existingRaw = {}, incomingRaw = {}) {
  const merged = { ...incomingRaw };
  const preserveKeys = [
    'footballDataMatchId',
    'fdMatchId',
    'fdEvents',
    'fifaMeta',
    'fifaEvents',
    'fifaReportStats',
  ];

  for (const key of preserveKeys) {
    if (existingRaw[key] != null) {
      merged[key] = existingRaw[key];
    }
  }

  return merged;
}

/** worldcup26 id ≠ FIFA MatchNumber; solo fusionar si el par local/visitante coincide. */
export function syncTeamsMatch(existing, incoming) {
  if (!existing || !incoming) return true;
  return (
    existing.homeTeamId === incoming.homeTeamId &&
    existing.awayTeamId === incoming.awayTeamId
  );
}

export function isPlaceholderTeamSlot(homeTeamId, awayTeamId) {
  const home = String(homeTeamId ?? '').trim();
  const away = String(awayTeamId ?? '').trim();
  return (!home || home === '0') && (!away || away === '0');
}

export function isOfficialKnockoutExternalId(externalId) {
  const id = String(externalId || '');
  return /^\d+$/.test(id) && Number(id) >= 73 && Number(id) <= 104;
}

export const OFFICIAL_KNOCKOUT_EXTERNAL_IDS = Array.from({ length: 32 }, (_, index) =>
  String(73 + index)
);

export function incomingIndicatesNotFinished(incoming, { now = Date.now() } = {}) {
  const raw = incoming.raw ?? {};
  const kickoffAt = incoming.kickoffAt;
  if (
    incoming.status === 'live' &&
    kickoffAt &&
    isMatchKickoffStale(kickoffAt, now)
  ) {
    return false;
  }

  const finished = raw.finished ?? raw.Finished;
  if (finished === 'FALSE' || finished === false) return true;
  if (finished === 'TRUE' || finished === true || finished === 'true') return false;

  const elapsed = raw.time_elapsed ?? raw.timeElapsed;
  if (!elapsed || elapsed === 'notstarted' || elapsed === '0') return true;
  if (elapsedTokenIndicatesFinished(elapsed)) return false;

  return incoming.status === 'upcoming';
}

export async function resolveExistingMatchForWorldCup26Sync(doc) {
  const byExternalId = await Match.findOne({ externalId: doc.externalId }).lean();
  if (byExternalId && syncTeamsMatch(byExternalId, doc)) {
    return byExternalId;
  }

  // 30+ placeholders KO comparten home/away 0/0; emparejar por par colapsa todos en un documento.
  if (isOfficialKnockoutExternalId(doc.externalId)) {
    return byExternalId;
  }

  if (!isPlaceholderTeamSlot(doc.homeTeamId, doc.awayTeamId)) {
    const byPair = await Match.findOne({
      homeTeamId: doc.homeTeamId,
      awayTeamId: doc.awayTeamId,
    }).lean();
    if (byPair) return byPair;
  }

  return byExternalId;
}

function downgradeImplausibleFinishedStatus(merged, kickoffAt, kickoffInFuture) {
  if (merged.status !== 'finished') return;
  if (wallClockAllowsMatchFinished({ ...merged, kickoffAt })) return;

  merged.status = kickoffInFuture ? 'upcoming' : 'live';
  const timeline = merged.raw?.fifaEvents?.timeline;
  const filtered = Array.isArray(timeline)
    ? timeline.filter((event) => event?.type !== 'match_end')
    : timeline;
  const clock =
    Array.isArray(filtered) && filtered.length ? latestClockFromTimeline(filtered) : null;
  merged.raw = {
    ...merged.raw,
    finished: 'FALSE',
    time_elapsed: clock ? String(clock).replace(/'+$/, '') : 'live',
    ...(Array.isArray(timeline)
      ? {
          fifaEvents: {
            ...(merged.raw?.fifaEvents ?? {}),
            timeline: filtered,
          },
        }
      : {}),
  };
}

export function mergeSyncedMatch(existing, incoming) {
  const merged = { ...incoming };
  if (!existing) return merged;

  if (!syncTeamsMatch(existing, incoming)) {
    return { ...existing };
  }

  merged.raw = mergeSyncedRaw(existing.raw ?? {}, incoming.raw ?? {});

  const kickoffAt = merged.kickoffAt ?? existing.kickoffAt;
  const kickoffMs = kickoffAt ? new Date(kickoffAt).getTime() : NaN;
  const kickoffPassed = Number.isFinite(kickoffMs) && kickoffMs <= Date.now();
  const kickoffInFuture = Number.isFinite(kickoffMs) && kickoffMs > Date.now();

  if (existing.status === 'finished' && kickoffInFuture) {
    merged.status = incoming.status === 'live' ? 'live' : 'upcoming';
    const scores = sanitizeMatchScores(incoming.homeScore, incoming.awayScore);
    merged.homeScore = scores.homeScore;
    merged.awayScore = scores.awayScore;
    return merged;
  }

  if (
    existing.status === 'finished' &&
    incoming.status === 'upcoming' &&
    incomingIndicatesNotFinished(incoming)
  ) {
    merged.status = incoming.status;
    merged.kickoffAt = existing.kickoffAt ?? merged.kickoffAt;
    merged.kickoffTimezone = existing.kickoffTimezone ?? merged.kickoffTimezone;
    const scores = sanitizeMatchScores(incoming.homeScore, incoming.awayScore);
    merged.homeScore = scores.homeScore;
    merged.awayScore = scores.awayScore;
    return merged;
  }

  if (
    existing.status === 'finished' &&
    kickoffPassed &&
    !isMatchKickoffStale(kickoffAt) &&
    matchEvidenceShowsInProgress(merged)
  ) {
    merged.status = 'live';
    const timeline = merged.raw?.fifaEvents?.timeline;
    const clock =
      Array.isArray(timeline) && timeline.length ? latestClockFromTimeline(timeline) : null;
    const badElapsed = elapsedTokenIndicatesFinished(readElapsedToken(merged));
    const badFinished =
      merged.raw?.finished === 'TRUE' ||
      merged.raw?.finished === true ||
      merged.raw?.finished === 'true';
    if (badElapsed || badFinished) {
      merged.raw = {
        ...merged.raw,
        finished: 'FALSE',
        ...(badElapsed
          ? { time_elapsed: clock ? String(clock).replace(/'+$/, '') : 'live' }
          : {}),
      };
    }
    return merged;
  }

  if (existing.status === 'finished') {
    merged.status = 'finished';
    const fifaScores = readFifaAuthoritativeScores(merged.raw ?? {});
    if (fifaScores) {
      merged.homeScore = fifaScores.homeScore;
      merged.awayScore = fifaScores.awayScore;
    } else {
      merged.homeScore = mergePlausibleGoalCounts(existing.homeScore, incoming.homeScore);
      merged.awayScore = mergePlausibleGoalCounts(existing.awayScore, incoming.awayScore);
    }
    downgradeImplausibleFinishedStatus(merged, kickoffAt, kickoffInFuture);
    return merged;
  }

  if (existing.status === 'live' && incoming.status === 'finished') {
    const liveState = { ...existing, kickoffAt, raw: merged.raw };
    if (isMatchClearlyInProgress(liveState) || matchEvidenceShowsInProgress(liveState)) {
      merged.status = 'live';
      const timeline = merged.raw?.fifaEvents?.timeline;
      const clock =
        Array.isArray(timeline) && timeline.length ? latestClockFromTimeline(timeline) : null;
      const badElapsed = elapsedTokenIndicatesFinished(readElapsedToken(merged));
      const badFinished =
        merged.raw?.finished === 'TRUE' ||
        merged.raw?.finished === true ||
        merged.raw?.finished === 'true';
      if (badElapsed || badFinished) {
        merged.raw = {
          ...merged.raw,
          finished: 'FALSE',
          ...(badElapsed
            ? { time_elapsed: clock ? String(clock).replace(/'+$/, '') : 'live' }
            : {}),
        };
      }
      return merged;
    }

    merged.status = 'finished';
    const fifaScores = readFifaAuthoritativeScores(merged.raw ?? {});
    if (fifaScores) {
      merged.homeScore = fifaScores.homeScore;
      merged.awayScore = fifaScores.awayScore;
    }
    downgradeImplausibleFinishedStatus(merged, kickoffAt, kickoffInFuture);
    return merged;
  }

  if (
    existing.status === 'live' &&
    shouldFinalizeStaleLiveMatch({ ...existing, kickoffAt, raw: merged.raw })
  ) {
    merged.status = 'finished';
    merged.raw = {
      ...merged.raw,
      time_elapsed: 'finished',
      finished: 'TRUE',
    };
    downgradeImplausibleFinishedStatus(merged, kickoffAt, kickoffInFuture);
    return merged;
  }

  if (existing.status === 'live' && incoming.status === 'upcoming' && kickoffPassed) {
    merged.status = 'live';
    merged.homeScore = mergePlausibleGoalCounts(existing.homeScore, incoming.homeScore);
    merged.awayScore = mergePlausibleGoalCounts(existing.awayScore, incoming.awayScore);
    return merged;
  }

  if (existing.status === 'live' && incoming.status === 'live') {
    const fifaScores = readFifaAuthoritativeScores(existing.raw ?? {});
    if (fifaScores) {
      merged.homeScore = fifaScores.homeScore;
      merged.awayScore = fifaScores.awayScore;
    } else {
      merged.homeScore = mergePlausibleGoalCounts(existing.homeScore, incoming.homeScore);
      merged.awayScore = mergePlausibleGoalCounts(existing.awayScore, incoming.awayScore);
    }

    if (shouldFinalizeStaleLiveMatch({ ...existing, kickoffAt, raw: merged.raw })) {
      merged.status = 'finished';
      merged.raw = {
        ...merged.raw,
        time_elapsed: 'finished',
        finished: 'TRUE',
      };
      downgradeImplausibleFinishedStatus(merged, kickoffAt, kickoffInFuture);
    }
  }

  merged.homeScore = sanitizeMatchGoalCount(merged.homeScore, 0);
  merged.awayScore = sanitizeMatchGoalCount(merged.awayScore, 0);

  if (existing?.status === 'live' && merged.status === 'upcoming') {
    merged.status = 'live';
    merged.homeScore = mergePlausibleGoalCounts(existing.homeScore, incoming.homeScore);
    merged.awayScore = mergePlausibleGoalCounts(existing.awayScore, incoming.awayScore);
  }

  return merged;
}

async function upsertWorldCup26GameItems(list, { stadiumTimezones = null } = {}) {
  const timezones = stadiumTimezones ?? (await buildStadiumTimezoneMap());
  const scoringIds = [];
  const newlyFinishedIds = [];
  const clearedScoreIds = [];
  let finishedArchiveDirty = false;
  const worldcup26Warnings = [];

  for (const item of list) {
    const stadiumId = String(item.stadium_id ?? item.stadiumId ?? '');
    const doc = normalizeGame(item, {
      stadiumTimezone: timezones[stadiumId] || undefined,
    });
    const existing = await resolveExistingMatchForWorldCup26Sync(doc);

    const warning = collectWorldCup26SyncWarning({ rawGame: item, doc, existing });
    if (warning) {
      worldcup26Warnings.push(warning);
    }

    if (existing && !syncTeamsMatch(existing, doc)) {
      continue;
    }

    const merged = mergeSyncedMatch(existing, doc);
    const wasFinished = existing?.status === 'finished';
    const wasLive = existing?.status === 'live';
    const updatePayload = {
      ...merged,
      lastSyncedAt: new Date(),
    };
    applyStatusTransitionFields(updatePayload, {
      previousStatus: existing?.status ?? null,
      nextStatus: merged.status,
      existingFinishedAt: existing?.finishedAt ?? null,
    });
    if (isOfficialKnockoutExternalId(doc.externalId)) {
      updatePayload.externalId = String(doc.externalId);
    } else if (existing?.externalId && existing.externalId !== 'finished-only') {
      updatePayload.externalId = existing.externalId;
    }
    if (existing?.kickoffAt) {
      updatePayload.kickoffAt = existing.kickoffAt;
    }
    if (existing?.kickoffTimezone) {
      updatePayload.kickoffTimezone = existing.kickoffTimezone;
    }
    const match = await Match.findOneAndUpdate(
      existing ? { _id: existing._id } : { externalId: doc.externalId },
      { $set: updatePayload },
      { upsert: !existing, new: true }
    );

    void syncMicroEventsFromMatch(match).catch((err) => {
      console.warn(`Micro-events sync failed (${match.externalId}):`, err.message);
    });

    const becameLive = match.status === 'live' && existing?.status !== 'live';
    const reopenedToLive = match.status === 'live' && wasFinished;
    const scoreChanged = needsRescore(existing, match);

    if (match.status === 'finished' && !wasFinished) {
      newlyFinishedIds.push(match._id);
      finishedArchiveDirty = true;
    }

    if ((wasFinished || wasLive) && match.status === 'upcoming') {
      clearedScoreIds.push(match._id);
      if (wasFinished) finishedArchiveDirty = true;
    }

    if (reopenedToLive) {
      clearedScoreIds.push(match._id);
      scoringIds.push(match._id);
      finishedArchiveDirty = true;
    } else if (match.status === 'finished' && (!wasFinished || scoreChanged)) {
      scoringIds.push(match._id);
      if (wasFinished && scoreChanged) finishedArchiveDirty = true;
    } else if (match.status === 'live' && (becameLive || scoreChanged)) {
      scoringIds.push(match._id);
    }
  }

  return {
    count: list.length,
    scoringIds,
    newlyFinishedIds,
    clearedScoreIds,
    finishedArchiveDirty,
    worldcup26Warnings,
  };
}

/** Repara partidos 73–104 si el sync previo colapsó placeholders 0/0 en un solo documento. */
export async function ensureOfficialKnockoutMatches() {
  const existingCount = await Match.countDocuments({
    externalId: { $in: OFFICIAL_KNOCKOUT_EXTERNAL_IDS },
  });

  if (existingCount >= OFFICIAL_KNOCKOUT_EXTERNAL_IDS.length) {
    return { repaired: false, count: existingCount };
  }

  const data = await fetchGames();
  const allGames = Array.isArray(data) ? data : data?.games ?? data?.matches ?? data?.data ?? [];
  const knockoutGames = allGames.filter((item) =>
    isOfficialKnockoutExternalId(String(item.id ?? item._id ?? item.idGame ?? ''))
  );

  const upsertResult = await upsertWorldCup26GameItems(knockoutGames);
  const count = await Match.countDocuments({
    externalId: { $in: OFFICIAL_KNOCKOUT_EXTERNAL_IDS },
  });

  if (count > existingCount) {
    const { invalidateWorldCupOverviewCache } = await import('./worldCupOverviewCache.js');
    invalidateWorldCupOverviewCache();
  }

  return {
    repaired: count > existingCount,
    count,
    previousCount: existingCount,
    sourceGames: knockoutGames.length,
    ...upsertResult,
  };
}

async function upsertMatches() {
  // worldcup26 game.id ≠ FIFA MatchNumber (externalId). Ver normalizeGame y resolveExistingMatchForWorldCup26Sync.
  const data = await fetchGames();
  const list = Array.isArray(data) ? data : data?.games ?? data?.matches ?? data?.data ?? [];
  const stadiumTimezones = await buildStadiumTimezoneMap();

  return upsertWorldCup26GameItems(list, { stadiumTimezones });
}

function needsRescore(before, after) {
  if (!before) return true;
  return (
    before.homeScore !== after.homeScore ||
    before.awayScore !== after.awayScore ||
    before.status !== after.status
  );
}

export { recalculateMatchScores, recalculateAllLiveMatches, clearMatchScores, clearStaleUpcomingMatchScores } from './matchScoringService.js';

export async function seedDemoDataIfEmpty() {
  const count = await Match.countDocuments();
  if (count > 0) return false;

  const teams = [
    { externalId: '1', nameEn: 'Mexico', fifaCode: 'MEX', group: 'A', flag: '' },
    { externalId: '2', nameEn: 'South Africa', fifaCode: 'RSA', group: 'A', flag: '' },
    { externalId: '3', nameEn: 'Brazil', fifaCode: 'BRA', group: 'C', flag: '' },
    { externalId: '4', nameEn: 'Morocco', fifaCode: 'MAR', group: 'C', flag: '' },
  ];

  for (const t of teams) {
    await Team.findOneAndUpdate({ externalId: t.externalId }, { $set: t }, { upsert: true });
  }

  const demoMatches = [
    {
      externalId: 'demo-1',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 0,
      awayScore: 0,
      group: 'A',
      matchday: '1',
      localDate: '06/11/2026 13:00',
      status: 'upcoming',
      kickoffAt: new Date('2026-06-11T19:00:00.000Z'),
    },
    {
      externalId: 'demo-2',
      homeTeamId: '3',
      awayTeamId: '4',
      homeScore: 2,
      awayScore: 1,
      group: 'C',
      matchday: '1',
      localDate: 'June 12, 2026',
      status: 'finished',
      kickoffAt: new Date('2026-06-12T19:00:00Z'),
    },
  ];

  for (const m of demoMatches) {
    await Match.findOneAndUpdate(
      { externalId: m.externalId },
      { $set: { ...m, lastSyncedAt: new Date() } },
      { upsert: true }
    );
  }

  console.log('Seeded demo teams and matches (no API credentials)');
  return true;
}

export async function runSync({ includeMetadata = true } = {}) {
  try {
    if (env.worldCupSyncEmail && env.worldCupSyncPassword) {
      await authenticate();
    }

    let teamsCount = await Team.countDocuments();
    let groupsCount = await Group.countDocuments();
    let stadiumsCount = await Stadium.countDocuments();

    if (includeMetadata) {
      teamsCount = await upsertTeams();
      groupsCount = await upsertGroups();
      stadiumsCount = await upsertStadiums();
    }

    const { count, scoringIds, newlyFinishedIds, clearedScoreIds, finishedArchiveDirty, worldcup26Warnings } =
      await upsertMatches();

    let fixtureAlignment = {
      aligned: 0,
      predictionsMoved: 0,
      predictionsMerged: 0,
      predictionsConflicted: 0,
    };
    try {
      fixtureAlignment = await alignMatchesFromFifaCalendar();
      if (
        fixtureAlignment.aligned > 0 ||
        fixtureAlignment.predictionsMoved > 0 ||
        fixtureAlignment.predictionsMerged > 0 ||
        fixtureAlignment.predictionsConflicted > 0
      ) {
        console.log(
          `FIFA fixture alignment: ${fixtureAlignment.aligned} partidos corregidos, ` +
            `${fixtureAlignment.predictionsMoved} predicciones movidas, ` +
            `${fixtureAlignment.predictionsMerged} fusionadas, ` +
            `${fixtureAlignment.predictionsConflicted} en conflicto`
        );
      }

      const linkAudit = await auditPredictionMatchLinks();
      if (fixtureAlignment.predictionsMoved > 0 || linkAudit.summary.hasIssues) {
        console.log('Prediction link audit:', JSON.stringify(linkAudit.summary));
        await SyncMeta.findOneAndUpdate(
          { key: 'predictionLinkAudit' },
          {
            lastSyncAt: new Date(),
            lastSyncError: linkAudit.summary.hasIssues ? 'issues_detected' : null,
            raw: {
              summary: linkAudit.summary,
              fixtureAlignment: {
                predictionsMoved: fixtureAlignment.predictionsMoved,
                predictionsMerged: fixtureAlignment.predictionsMerged,
                predictionsConflicted: fixtureAlignment.predictionsConflicted,
              },
            },
          },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn('FIFA fixture alignment skipped:', err.message);
    }

    try {
      const auditReport = await runPostSyncMatchAudit({ worldcup26Warnings });
      const disputeResults = await resolveAndApplySourceDisputes(auditReport.disputes);

      const auditHasIssues =
        auditReport.summary.kickoffMismatchCount > 0 ||
        auditReport.summary.worldcup26CollisionCount > 0 ||
        auditReport.summary.sourceDisputeCount > 0 ||
        auditReport.summary.predictionLinkIssues;

      if (auditHasIssues || disputeResults.length > 0) {
        console.log(
          'Match source audit:',
          JSON.stringify({
            summary: auditReport.summary,
            disputesResolved: disputeResults.length,
            applied: disputeResults.filter((r) => r.applied).length,
          })
        );
        await SyncMeta.findOneAndUpdate(
          { key: 'matchSourceDisputes' },
          {
            lastSyncAt: new Date(),
            lastSyncError: auditHasIssues ? 'issues_detected' : null,
            raw: {
              summary: auditReport.summary,
              worldcup26Warnings: auditReport.worldcup26Warnings,
              disputes: auditReport.disputes.map((d) => ({
                externalId: d.externalId,
                type: d.type,
                summary: d.summary,
              })),
              disputeResults,
            },
          },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn('Match source audit skipped:', err.message);
    }

    try {
      const { ensurePredictionSourceBackfillOnce, backfillPredictionGoalDiffs } =
        await import('./predictionMigrationService.js');
      const sourceBackfill = await ensurePredictionSourceBackfillOnce();
      if (sourceBackfill.updated > 0) {
        console.log(`Prediction source backfill: ${sourceBackfill.updated} actualizadas`);
      }
      const goalDiffBackfill = await backfillPredictionGoalDiffs({ onlyMissing: true });
      if (goalDiffBackfill.updated > 0) {
        console.log(
          `Goal diff backfill: ${goalDiffBackfill.updated} predicciones en ${goalDiffBackfill.matches} partidos`
        );
      }
    } catch (err) {
      console.warn('Prediction migration backfill skipped:', err.message);
    }

    for (const matchId of clearedScoreIds) {
      await clearMatchScores(matchId);
    }

    await clearStaleUpcomingMatchScores();

    for (const matchId of scoringIds) {
      await recalculateMatchScores(matchId);
    }

    await recalculateAllLiveMatches();

    if (newlyFinishedIds.length) {
      await syncFifaReportsForMatchIds(newlyFinishedIds);
    }

    await SyncMeta.findOneAndUpdate(
      { key: 'global' },
      { lastSyncAt: new Date(), lastSyncError: null },
      { upsert: true }
    );

    const lineupResult = await syncLiveLineups();
    const upcomingLineupResult = await syncUpcomingKickoffLineups();
    const gridLineupResult = await syncUpcomingLineupGrids();
    const fifaResult = await syncFifaMatchEvents({ extraMatchIds: newlyFinishedIds });
    const assistResult = await assistLiveMatchEvents();

    if (fifaResult.newlyFinishedIds?.length) {
      await syncFifaReportsForMatchIds(fifaResult.newlyFinishedIds);
    }

    for (const matchId of fifaResult.scoringIds ?? []) {
      await recalculateMatchScores(matchId);
    }

    const allNewlyFinished = [
      ...new Set([
        ...newlyFinishedIds.map((id) => id.toString()),
        ...(fifaResult.newlyFinishedIds ?? []).map((id) => id.toString()),
      ]),
    ];
    if (allNewlyFinished.length) {
      try {
        const { scheduleBackupsForFinishedMatches } = await import('./matchFinishBackupService.js');
        scheduleBackupsForFinishedMatches(allNewlyFinished);
      } catch (err) {
        console.warn('Match finish backup skipped:', err.message);
      }
    }

    try {
      const { reopenPrematurelyFinishedMatches } = await import('./kickoffLiveService.js');
      await reopenPrematurelyFinishedMatches();
    } catch (err) {
      console.warn('Premature finish reopen skipped:', err.message);
    }

    notifySyncComplete({ teamsCount, groupsCount, stadiumsCount, matchesCount: count });
    notifyMatchesUpdated({
      matchesCount: count,
      fifaEventsSynced: fifaResult.events ?? 0,
    });
    notifyLeaderboardUpdated({ reason: 'sync_complete' });
    const { invalidateMatchRelatedCaches, invalidateFinishedMatchArchiveCaches } =
      await import('./matchRelatedCaches.js');
    if (
      finishedArchiveDirty ||
      newlyFinishedIds.length ||
      (fifaResult.newlyFinishedIds?.length ?? 0) > 0
    ) {
      invalidateFinishedMatchArchiveCaches();
    }
    invalidateMatchRelatedCaches();

    if (lineupResult.updated > 0 || lineupResult.events > 0) {
      console.log(
        `Lineup/events sync: ${lineupResult.updated} titulares, ${lineupResult.events} partidos con eventos`
      );
    }
    if (upcomingLineupResult.updated > 0 || upcomingLineupResult.matches > 0) {
      console.log(
        `Upcoming lineup sync: ${upcomingLineupResult.updated} titulares en ${upcomingLineupResult.matches} partidos`
      );
    }
    if (gridLineupResult.updated > 0) {
      console.log(`Lineup grid sync: ${gridLineupResult.updated} partidos con grid API-Football`);
    }

    if (fifaResult.events > 0) {
      console.log(`FIFA events sync: ${fifaResult.events} partidos con timeline`);
    }

    if (assistResult.updated > 0) {
      console.log(
        `Live event assist: ${assistResult.updated} partidos actualizados (${assistResult.skipped} sin cambios)`
      );
    }

    console.log(
      `Sync OK: ${teamsCount} teams, ${groupsCount} groups, ${stadiumsCount} stadiums, ${count} matches`
    );
    return { teamsCount, groupsCount, stadiumsCount, matchesCount: count };
  } catch (err) {
    await SyncMeta.findOneAndUpdate(
      { key: 'global' },
      { lastSyncError: err.message },
      { upsert: true }
    );
    console.error('Sync failed:', err.message);
    await seedDemoDataIfEmpty();
    throw err;
  }
}

export async function syncTeamsMetadata() {
  try {
    const teamsCount = await upsertTeams();
    const groupsCount = await upsertGroups();
    return { teamsCount, groupsCount };
  } catch (err) {
    console.warn('Team metadata sync skipped:', err.message);
    return null;
  }
}

export async function ensureWorldCupTeamsLoaded() {
  await syncTeamsMetadata();

  let teams = await Team.find().sort({ group: 1, nameEn: 1 });
  let byGroup = organizeTeamsByGroup(teams);
  let incomplete = GROUP_LETTERS.filter((letter) => (byGroup[letter]?.length || 0) < 4);

  if (incomplete.length > 0) {
    try {
      await upsertTeams();
      await upsertGroups();
    } catch (err) {
      console.warn('Direct team API sync failed:', err.message);
    }
    teams = await Team.find().sort({ group: 1, nameEn: 1 });
    byGroup = organizeTeamsByGroup(teams);
    incomplete = GROUP_LETTERS.filter((letter) => (byGroup[letter]?.length || 0) < 4);
  }

  if (incomplete.length > 0) {
    throw new Error(
      `No se pudieron cargar los 48 países (${teams.length} equipos, faltan grupos ${incomplete.join(', ')}). Ejecutá npm run sync o revisá la conexión a la API.`
    );
  }

  return {
    teams: GROUP_LETTERS.flatMap((letter) => byGroup[letter].slice(0, 4)),
    teamCount: teams.length,
  };
}

export async function getLastSyncAt() {
  const meta = await SyncMeta.findOne({ key: 'global' });
  return meta?.lastSyncAt ?? null;
}
