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
import { env } from '../config/env.js';
import {
  notifyLeaderboardUpdated,
  notifyMatchesUpdated,
  notifySyncComplete,
} from './websocketService.js';
import { syncLiveLineups } from './lineupSyncService.js';
import { syncFifaMatchEvents, syncFifaReportsForMatchIds } from './fifaEventSyncService.js';
import { alignMatchesFromFifaCalendar } from './fifaFixtureAlignmentService.js';
import { auditPredictionMatchLinks } from './predictionMatchLinkService.js';
import { assistLiveMatchEvents } from './liveMatchEventAssistService.js';
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

export function incomingIndicatesNotFinished(incoming) {
  const raw = incoming.raw ?? {};
  const finished = raw.finished ?? raw.Finished;
  if (finished === 'FALSE' || finished === false) return true;
  if (finished === 'TRUE' || finished === true || finished === 'true') return false;

  const elapsed = raw.time_elapsed ?? raw.timeElapsed;
  if (!elapsed || elapsed === 'notstarted' || elapsed === '0') return true;
  if (String(elapsed).toLowerCase() === 'finished') return false;

  return incoming.status === 'upcoming';
}

export async function resolveExistingMatchForWorldCup26Sync(doc) {
  const byExternalId = await Match.findOne({ externalId: doc.externalId }).lean();
  if (byExternalId && syncTeamsMatch(byExternalId, doc)) {
    return byExternalId;
  }

  const byPair = await Match.findOne({
    homeTeamId: doc.homeTeamId,
    awayTeamId: doc.awayTeamId,
  }).lean();
  if (byPair) return byPair;

  return byExternalId;
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
    return merged;
  }

  if (existing.status === 'live' && incoming.status === 'finished') {
    merged.status = 'finished';
    const fifaScores = readFifaAuthoritativeScores(merged.raw ?? {});
    if (fifaScores) {
      merged.homeScore = fifaScores.homeScore;
      merged.awayScore = fifaScores.awayScore;
    }
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
  }

  merged.homeScore = sanitizeMatchGoalCount(merged.homeScore, 0);
  merged.awayScore = sanitizeMatchGoalCount(merged.awayScore, 0);

  return merged;
}

async function upsertMatches() {
  const data = await fetchGames();
  const list = Array.isArray(data) ? data : data?.games ?? data?.matches ?? data?.data ?? [];
  const scoringIds = [];
  const newlyFinishedIds = [];
  const clearedScoreIds = [];
  const stadiumTimezones = await buildStadiumTimezoneMap();

  for (const item of list) {
    const stadiumId = String(item.stadium_id ?? item.stadiumId ?? '');
    const doc = normalizeGame(item, {
      stadiumTimezone: stadiumTimezones[stadiumId] || undefined,
    });
    const existing = await resolveExistingMatchForWorldCup26Sync(doc);
    const merged = mergeSyncedMatch(existing, doc);
    const wasFinished = existing?.status === 'finished';
    const wasLive = existing?.status === 'live';
    const updatePayload = {
      ...merged,
      lastSyncedAt: new Date(),
    };
    if (existing?.externalId) {
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

    const becameLive = match.status === 'live' && existing?.status !== 'live';
    const scoreChanged = needsRescore(existing, match);

    if (match.status === 'finished' && !wasFinished) {
      newlyFinishedIds.push(match._id);
    }

    if ((wasFinished || wasLive) && match.status === 'upcoming') {
      clearedScoreIds.push(match._id);
    }

    if (match.status === 'finished' && (!wasFinished || scoreChanged)) {
      scoringIds.push(match._id);
    } else if (match.status === 'live' && (becameLive || scoreChanged)) {
      scoringIds.push(match._id);
    }
  }

  return { count: list.length, scoringIds, newlyFinishedIds, clearedScoreIds };
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

    const { count, scoringIds, newlyFinishedIds, clearedScoreIds } = await upsertMatches();

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
      const { ensurePredictionSourceBackfillOnce } = await import('./predictionMigrationService.js');
      const sourceBackfill = await ensurePredictionSourceBackfillOnce();
      if (sourceBackfill.updated > 0) {
        console.log(`Prediction source backfill: ${sourceBackfill.updated} actualizadas`);
      }
    } catch (err) {
      console.warn('Prediction source backfill skipped:', err.message);
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
    const fifaResult = await syncFifaMatchEvents({ extraMatchIds: newlyFinishedIds });
    const assistResult = await assistLiveMatchEvents();

    if (fifaResult.newlyFinishedIds?.length) {
      await syncFifaReportsForMatchIds(fifaResult.newlyFinishedIds);
    }

    for (const matchId of fifaResult.scoringIds ?? []) {
      await recalculateMatchScores(matchId);
    }

    notifySyncComplete({ teamsCount, groupsCount, stadiumsCount, matchesCount: count });
    notifyMatchesUpdated({
      matchesCount: count,
      fifaEventsSynced: fifaResult.events ?? 0,
    });
    notifyLeaderboardUpdated({ reason: 'sync_complete' });
    const { invalidateWorldCupOverviewCache } = await import('./worldCupOverviewCache.js');
    invalidateWorldCupOverviewCache();

    if (lineupResult.updated > 0 || lineupResult.events > 0) {
      console.log(
        `Lineup/events sync: ${lineupResult.updated} titulares, ${lineupResult.events} partidos con eventos`
      );
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
