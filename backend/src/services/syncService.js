import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Stadium } from '../models/Stadium.js';
import { Prediction } from '../models/Prediction.js';
import { SyncMeta } from '../models/SyncMeta.js';
import { recalculateUserTotalPoints } from './leaderboardService.js';
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
import { calculatePoints } from './scoringService.js';
import { recalculateConsolationBonuses } from './consolationBonusService.js';
import { GROUP_LETTERS, organizeTeamsByGroup } from './simulationTournamentService.js';
import { resolveStadiumTimezone } from './stadiumTimezones.js';
import { env } from '../config/env.js';
import {
  notifyLeaderboardUpdated,
  notifyMatchesUpdated,
  notifySyncComplete,
} from './websocketService.js';
import { syncLiveLineups } from './lineupSyncService.js';

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

async function upsertMatches() {
  const data = await fetchGames();
  const list = Array.isArray(data) ? data : data?.games ?? data?.matches ?? data?.data ?? [];
  const scoringIds = [];
  const stadiumTimezones = await buildStadiumTimezoneMap();

  for (const item of list) {
    const stadiumId = String(item.stadium_id ?? item.stadiumId ?? '');
    const doc = normalizeGame(item, {
      stadiumTimezone: stadiumTimezones[stadiumId] || undefined,
    });
    const existing = await Match.findOne({ externalId: doc.externalId });
    const wasFinished = existing?.status === 'finished';
    const match = await Match.findOneAndUpdate(
      { externalId: doc.externalId },
      { $set: { ...doc, lastSyncedAt: new Date() } },
      { upsert: true, new: true }
    );

    const becameLive = match.status === 'live' && existing?.status !== 'live';
    const scoreChanged = needsRescore(existing, match);

    if (match.status === 'finished' && (!wasFinished || scoreChanged)) {
      scoringIds.push(match._id);
    } else if (match.status === 'live' && (becameLive || scoreChanged)) {
      scoringIds.push(match._id);
    }
  }

  return { count: list.length, scoringIds };
}

function needsRescore(before, after) {
  if (!before) return true;
  return (
    before.homeScore !== after.homeScore ||
    before.awayScore !== after.awayScore ||
    before.status !== after.status
  );
}

export async function recalculateMatchScores(matchId) {
  const match = await Match.findById(matchId);
  if (!match || (match.status !== 'finished' && match.status !== 'live')) return;

  const predictions = await Prediction.find({ matchId });
  const affectedUsers = new Set();

  for (const prediction of predictions) {
    const { total, breakdown } = calculatePoints(
      { home: prediction.homeGoals, away: prediction.awayGoals },
      { home: match.homeScore, away: match.awayScore }
    );

    prediction.pointsEarned = total;
    prediction.pointsBreakdown = breakdown;
    prediction.bonusPoint = 0;
    prediction.bonusReason = null;
    await prediction.save();

    affectedUsers.add(prediction.userId.toString());
  }

  for (const userId of affectedUsers) {
    if (match.status === 'finished') {
      await recalculateConsolationBonuses(userId);
    }
    await recalculateUserTotalPoints(userId);
  }

  if (affectedUsers.size > 0) {
    notifyLeaderboardUpdated({
      reason: match.status === 'live' ? 'live_scores_updated' : 'scores_recalculated',
      matchId: matchId.toString(),
    });
  }
}

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

    const { count, scoringIds } = await upsertMatches();

    for (const matchId of scoringIds) {
      await recalculateMatchScores(matchId);
    }

    await SyncMeta.findOneAndUpdate(
      { key: 'global' },
      { lastSyncAt: new Date(), lastSyncError: null },
      { upsert: true }
    );

    const lineupResult = await syncLiveLineups();

    notifySyncComplete({ teamsCount, groupsCount, stadiumsCount, matchesCount: count });
    notifyMatchesUpdated({ matchesCount: count });
    notifyLeaderboardUpdated({ reason: 'sync_complete' });

    if (lineupResult.updated > 0) {
      console.log(`Lineup sync: ${lineupResult.updated} titulares en ${lineupResult.matches} partidos`);
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
