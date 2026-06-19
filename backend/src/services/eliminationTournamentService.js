import mongoose from 'mongoose';
import { TOURNAMENT_TYPE_ELIMINATION } from '../constants/tournamentTypes.js';
import { computeEliminationEntryFee, ELIMINATION_TOURNAMENT_PRIZE_FUBOLS } from '../config/economy.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { EliminationTournament } from '../models/EliminationTournament.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { TournamentEnrollment } from '../models/TournamentEnrollment.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { getAiUser } from './aiUserService.js';
import { isGroupAdmin } from './competitionGroupService.js';
import {
  chargeEliminationEntryFee,
  payoutEliminationChampion,
} from './fubolService.js';
import {
  rankActivePlayersForMatch,
} from './matchPredictionRankingsService.js';
import { recalculateMatchScores } from './syncService.js';

function tournamentError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toObjectId(groupId) {
  return typeof groupId === 'string' ? new mongoose.Types.ObjectId(groupId) : groupId;
}

function serializeMatchSummary(match) {
  if (!match) return null;
  return {
    id: match._id.toString(),
    externalId: match.externalId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    finishedAt: match.finishedAt,
    kickoffAt: match.kickoffAt,
  };
}

function mapRankRowToLeaderboard(row, userById) {
  const user = userById[row.id];
  return {
    id: row.id,
    name: row.name,
    isAiUser: Boolean(user?.isAiUser),
    rank: row.rank,
    totalPoints: row.points ?? 0,
    pj: row.pj ?? 1,
    pa: row.pa ?? 0,
    gl: row.gl ?? 0,
    gv: row.gv ?? 0,
    gt: row.gt ?? 0,
    pb: row.pb ?? 0,
    difGl: row.difGl ?? 0,
    difGv: row.difGv ?? 0,
  };
}

export async function getEliminationTournamentRecord(groupId) {
  return EliminationTournament.findOne({ groupId: toObjectId(groupId) }).lean();
}

export async function listEliminationEnrolledUserIds(groupId) {
  const rows = await TournamentEnrollment.find({
    groupId: toObjectId(groupId),
    tournamentType: TOURNAMENT_TYPE_ELIMINATION,
  })
    .select('userId')
    .lean();
  return rows.map((row) => row.userId);
}

export async function ensureEliminationEnrollment(userId, groupId, memberCount) {
  const oid = toObjectId(groupId);
  const fee = computeEliminationEntryFee(memberCount);

  const enrollment = await TournamentEnrollment.findOneAndUpdate(
    { userId, groupId: oid, tournamentType: TOURNAMENT_TYPE_ELIMINATION },
    { $setOnInsert: { enrolledAt: new Date() } },
    { upsert: true, new: true }
  );

  const feeResult = await chargeEliminationEntryFee({ userId, groupId: oid, memberCount });
  if (feeResult.charged || feeResult.reason === 'already_paid') {
    enrollment.entryFeeFubols = feeResult.fee ?? fee;
    enrollment.entryFeePaidAt = enrollment.entryFeePaidAt ?? new Date();
    await enrollment.save();
  }

  return enrollment;
}

export async function activateTournament(groupId, adminUserId) {
  const oid = toObjectId(groupId);
  const group = await CompetitionGroup.findById(oid);
  if (!group) throw tournamentError('Grupo no encontrado', 404);
  if (!(await isGroupAdmin({ userId: adminUserId, group }))) {
    throw tournamentError('Solo el administrador del grupo puede activar el torneo', 403);
  }

  let tournament = await EliminationTournament.findOne({ groupId: oid });
  if (tournament?.status === 'running' || tournament?.status === 'completed') {
    return getEliminationDashboard(groupId, adminUserId);
  }

  if (!tournament) {
    tournament = await EliminationTournament.create({
      groupId: oid,
      status: 'open',
      activatedBy: adminUserId,
      activatedAt: new Date(),
      activePlayerIds: [],
      eliminated: [],
      processedMatchIds: [],
      eliminationPoolFubols: 0,
    });
  } else {
    tournament.status = 'open';
    tournament.activatedBy = adminUserId;
    tournament.activatedAt = tournament.activatedAt ?? new Date();
    await tournament.save();
  }

  const memberCount = await UserGroupMembership.countDocuments({ groupId: oid });
  await ensureEliminationEnrollment(adminUserId, oid, memberCount);

  const aiUser = await getAiUser();
  if (aiUser) {
    await ensureEliminationEnrollment(aiUser._id, oid, memberCount);
  }

  return getEliminationDashboard(groupId, adminUserId);
}

export async function startTournament(groupId, adminUserId) {
  const oid = toObjectId(groupId);
  const group = await CompetitionGroup.findById(oid);
  if (!group) throw tournamentError('Grupo no encontrado', 404);
  if (!(await isGroupAdmin({ userId: adminUserId, group }))) {
    throw tournamentError('Solo el administrador del grupo puede iniciar el torneo', 403);
  }

  const tournament = await EliminationTournament.findOne({ groupId: oid });
  if (!tournament) throw tournamentError('Activá el Torneo Eliminación antes de iniciarlo', 400);
  if (tournament.status === 'running' || tournament.status === 'completed') {
    return getEliminationDashboard(groupId, adminUserId);
  }
  if (tournament.status !== 'open') {
    throw tournamentError('El torneo no está abierto a inscripciones', 400);
  }

  const enrolledIds = await listEliminationEnrolledUserIds(oid);
  if (enrolledIds.length < 2) {
    throw tournamentError('Se necesitan al menos 2 inscriptos para iniciar el torneo', 400);
  }

  tournament.status = 'running';
  tournament.startedAt = new Date();
  tournament.activePlayerIds = enrolledIds;
  await tournament.save();

  await processEliminationForGroup(groupId);

  return getEliminationDashboard(groupId, adminUserId);
}

async function rescoreUnscoredPredictions(finishedMatches = []) {
  for (const match of finishedMatches) {
    const unscored = await Prediction.countDocuments({
      matchId: match._id,
      pointsEarned: null,
    });
    if (unscored > 0) {
      await recalculateMatchScores(match._id);
    }
  }
}

export async function processEliminationForGroup(groupId) {
  const oid = toObjectId(groupId);
  const tournament = await EliminationTournament.findOne({ groupId: oid });
  if (!tournament || tournament.status !== 'running' || !tournament.startedAt) {
    return tournament;
  }

  const matches = await Match.find({
    status: 'finished',
    finishedAt: { $gte: tournament.startedAt },
    _id: { $nin: tournament.processedMatchIds },
  })
    .sort({ finishedAt: 1 })
    .lean();

  if (!matches.length) return tournament;

  await rescoreUnscoredPredictions(matches);

  for (const match of matches) {
    if (tournament.activePlayerIds.length <= 1) break;

    const activeIds = [...tournament.activePlayerIds];
    const users = await User.find({ _id: { $in: activeIds } })
      .select('name isAiUser')
      .lean();
    const userMap = Object.fromEntries(users.map((user) => [user._id.toString(), user.name]));
    const userById = Object.fromEntries(users.map((user) => [user._id.toString(), user]));

    const predictions = await Prediction.find({
      userId: { $in: activeIds },
      matchId: match._id,
      pointsEarned: { $ne: null },
    }).lean();

    const predictionsByUserId = new Map(
      predictions.map((prediction) => [prediction.userId.toString(), prediction])
    );

    const ranked = rankActivePlayersForMatch({
      activeUserIds: activeIds,
      predictionsByUserId,
      userMap,
      actual: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
    });

    tournament.processedMatchIds.push(match._id);

    if (!ranked.length) continue;

    const lastPlace = ranked[ranked.length - 1];
    const eliminatedUserId = new mongoose.Types.ObjectId(lastPlace.id);

    tournament.activePlayerIds = activeIds.filter(
      (id) => id.toString() !== eliminatedUserId.toString()
    );
    tournament.eliminated.push({
      userId: eliminatedUserId,
      matchId: match._id,
      eliminatedAt: new Date(),
      rankInMatch: lastPlace.rank,
    });

    if (tournament.activePlayerIds.length === 1) {
      tournament.status = 'completed';
      tournament.completedAt = new Date();
      tournament.championId = tournament.activePlayerIds[0];
      await tournament.save();
      await payoutEliminationChampion({
        userId: tournament.championId,
        groupId: oid,
      });
      return tournament;
    }
  }

  await tournament.save();
  return tournament;
}

async function buildMatchTableForPlayers(match, activePlayerIds) {
  if (!match || !activePlayerIds.length) {
    return { match: serializeMatchSummary(match), leaderboard: [] };
  }

  const users = await User.find({ _id: { $in: activePlayerIds } })
    .select('name isAiUser')
    .lean();
  const userMap = Object.fromEntries(users.map((user) => [user._id.toString(), user.name]));
  const userById = Object.fromEntries(users.map((user) => [user._id.toString(), user]));

  const predictions = await Prediction.find({
    userId: { $in: activePlayerIds },
    matchId: match._id,
    pointsEarned: { $ne: null },
  }).lean();

  const predictionsByUserId = new Map(
    predictions.map((prediction) => [prediction.userId.toString(), prediction])
  );

  const actual =
    match.status === 'finished' || match.status === 'live'
      ? { home: match.homeScore ?? 0, away: match.awayScore ?? 0 }
      : null;

  const ranked = rankActivePlayersForMatch({
    activeUserIds: activePlayerIds,
    predictionsByUserId,
    userMap,
    actual,
  });

  return {
    match: serializeMatchSummary(match),
    leaderboard: ranked.map((row) => mapRankRowToLeaderboard(row, userById)),
  };
}

export async function getEliminationDashboard(groupId, viewerUserId) {
  const oid = toObjectId(groupId);
  const group = await CompetitionGroup.findById(oid).lean();
  if (!group) throw tournamentError('Grupo no encontrado', 404);

  if (viewerUserId) {
    const membership = await UserGroupMembership.findOne({ userId: viewerUserId, groupId: oid });
    if (!membership) throw tournamentError('Debés ser miembro del grupo', 403);
  }

  await processEliminationForGroup(groupId);

  const tournament = await EliminationTournament.findOne({ groupId: oid }).lean();
  const memberCount = await UserGroupMembership.countDocuments({ groupId: oid });
  const entryFeeFubols = computeEliminationEntryFee(memberCount);

  const enrolledIds = await listEliminationEnrolledUserIds(oid);
  const enrolledUsers = enrolledIds.length
    ? await User.find({ _id: { $in: enrolledIds } })
        .select('name isAiUser')
        .lean()
    : [];

  const isEnrolled = viewerUserId
    ? enrolledIds.some((id) => id.toString() === String(viewerUserId))
    : false;

  const isAdmin = viewerUserId
    ? await isGroupAdmin({ userId: viewerUserId, group })
    : false;

  const status = tournament?.status ?? 'inactive';
  const activeIds =
    tournament?.status === 'running' || tournament?.status === 'completed'
      ? tournament.activePlayerIds ?? []
      : enrolledIds;

  const activePlayers = activeIds.length
    ? (
        await User.find({ _id: { $in: activeIds } })
          .select('name isAiUser')
          .lean()
      ).map((user) => ({
        id: user._id.toString(),
        name: user.name,
        isAiUser: Boolean(user.isAiUser),
      }))
    : [];

  const eliminatedUserIds = (tournament?.eliminated ?? []).map((row) => row.userId);
  const eliminatedUsers = eliminatedUserIds.length
    ? await User.find({ _id: { $in: eliminatedUserIds } })
        .select('name isAiUser')
        .lean()
    : [];
  const eliminatedUserById = Object.fromEntries(
    eliminatedUsers.map((user) => [user._id.toString(), user])
  );

  const matchIds = [...new Set((tournament?.eliminated ?? []).map((row) => String(row.matchId)))];
  const matches = matchIds.length
    ? await Match.find({ _id: { $in: matchIds } }).lean()
    : [];
  const matchById = Object.fromEntries(matches.map((match) => [match._id.toString(), match]));

  const eliminated = (tournament?.eliminated ?? []).map((row) => {
    const user = eliminatedUserById[row.userId.toString()];
    const match = matchById[row.matchId.toString()];
    return {
      userId: row.userId.toString(),
      name: user?.name ?? 'Jugador',
      isAiUser: Boolean(user?.isAiUser),
      matchId: row.matchId.toString(),
      matchLabel: match
        ? `${match.homeTeam?.name ?? 'Local'} vs ${match.awayTeam?.name ?? 'Visitante'}`
        : '',
      rankInMatch: row.rankInMatch,
      eliminatedAt: row.eliminatedAt,
    };
  });

  let currentMatchTable = { match: null, leaderboard: [] };
  const lastProcessedId = tournament?.processedMatchIds?.length
    ? tournament.processedMatchIds[tournament.processedMatchIds.length - 1]
    : null;

  if (lastProcessedId && tournament?.status === 'running') {
    const lastMatch = await Match.findById(lastProcessedId).lean();
    currentMatchTable = await buildMatchTableForPlayers(lastMatch, activeIds);
  } else if (lastProcessedId && tournament?.status === 'completed') {
    const lastMatch = await Match.findById(lastProcessedId).lean();
    const finalActiveIds = tournament.championId ? [tournament.championId] : activeIds;
    currentMatchTable = await buildMatchTableForPlayers(lastMatch, finalActiveIds);
  } else if (tournament?.status === 'running' && activeIds.length > 1) {
    const liveMatch = await Match.findOne({ status: 'live' })
      .sort({ kickoffAt: 1 })
      .lean();
    if (liveMatch) {
      currentMatchTable = await buildMatchTableForPlayers(liveMatch, activeIds);
    }
  }

  let champion = null;
  if (tournament?.championId) {
    const champUser =
      eliminatedUserById[tournament.championId.toString()] ||
      activePlayers.find((p) => p.id === tournament.championId.toString()) ||
      (await User.findById(tournament.championId).select('name isAiUser').lean());
    if (champUser) {
      champion = {
        id: tournament.championId.toString(),
        name: champUser.name,
        isAiUser: Boolean(champUser.isAiUser),
      };
    }
  }

  return {
    group: { id: group._id.toString(), name: group.name },
    tournament: tournament
      ? {
          status: tournament.status,
          activatedAt: tournament.activatedAt,
          startedAt: tournament.startedAt,
          completedAt: tournament.completedAt,
          prizePaidAt: tournament.prizePaidAt,
          enrolledCount: enrolledUsers.length,
        }
      : { status: 'inactive', enrolledCount: enrolledUsers.length },
    entryFeeFubols,
    memberCount,
    prizeFubols: ELIMINATION_TOURNAMENT_PRIZE_FUBOLS,
    poolTotalFubols: tournament?.eliminationPoolFubols ?? 0,
    canActivate: Boolean(isAdmin && status === 'inactive'),
    canStart: Boolean(isAdmin && status === 'open' && enrolledUsers.length >= 2),
    isEnrolled,
    enrolledPlayers: enrolledUsers.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      isAiUser: Boolean(user.isAiUser),
    })),
    activePlayers,
    eliminated,
    champion,
    currentMatchTable,
  };
}

export async function assertEliminationEnrollmentOpen(groupId) {
  const tournament = await getEliminationTournamentRecord(groupId);
  if (!tournament) {
    throw tournamentError('El administrador debe activar el Torneo Eliminación primero', 400);
  }
  if (tournament.status !== 'open') {
    throw tournamentError('Las inscripciones al Torneo Eliminación están cerradas', 400);
  }
  return tournament;
}
