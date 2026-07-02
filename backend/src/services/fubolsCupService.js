import mongoose from 'mongoose';
import {
  FUBOLS_CUP_BRACKET_ADVANCEMENT,
  FUBOLS_CUP_FIRST_ROUND_PAIRINGS,
  FUBOLS_CUP_MIN_HUMANS,
  FUBOLS_CUP_ROUNDS,
  FUBOLS_CUP_ROUND_OF_32_MAX,
  FUBOLS_CUP_ROUND_OF_32_MIN,
  buildEmptyBracketRounds,
  getWorldCupExternalIdsForDuel,
  isRoundOf32Complete,
} from '../../../shared/fubolsCupBracket.js';
import {
  buildMatchResultSlice,
  resolveDuelWinner,
} from '../../../shared/fubolsCupScoring.js';
import {
  FUBOLS_CUP_CHAMPION_PRIZE,
  FUBOLS_CUP_ROUND_ADVANCE_PRIZE,
} from '../config/economy.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { FubolsCupTournament } from '../models/FubolsCupTournament.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { payoutFubolsCupAdvance, payoutFubolsCupChampion } from './fubolService.js';
import { getLeaderboard } from './leaderboardService.js';
import { resolveScheduleKickoffAt } from './kickoffTimeService.js';
import { recalculateMatchScores } from './syncService.js';
import { kickoffSlotKey, matchesInFirstKickoffSlot } from '../utils/kickoffSlot.js';

function cupError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toObjectId(groupId) {
  return typeof groupId === 'string' ? new mongoose.Types.ObjectId(groupId) : groupId;
}

export async function getHumanLeaderboardTop8(groupId) {
  const leaderboard = await getLeaderboard(groupId, 50);
  return leaderboard.filter((row) => !row.isAiUser).slice(0, FUBOLS_CUP_MIN_HUMANS);
}

function seedRankToUserId(seeds, rank) {
  const row = seeds.find((s) => s.seedRank === rank);
  if (!row?.userId) return null;
  return String(row.userId);
}

function findDuel(tournament, roundIndex, duelIndex) {
  return tournament.rounds?.[roundIndex]?.duels?.[duelIndex] ?? null;
}

function assignFirstRoundPlayers(rounds, seeds, userMap) {
  const round = rounds[0];
  if (!round) return;
  FUBOLS_CUP_FIRST_ROUND_PAIRINGS.forEach(([seedA, seedB], duelIndex) => {
    const duel = round.duels[duelIndex];
    if (!duel) return;
    const playerAId = seedRankToUserId(seeds, seedA);
    const playerBId = seedRankToUserId(seeds, seedB);
    duel.playerAId = playerAId;
    duel.playerBId = playerBId;
    duel.seedA = seedA;
    duel.seedB = seedB;
    duel.playerAName = userMap[playerAId] ?? null;
    duel.playerBName = userMap[playerBId] ?? null;
  });
}

function assignBracketFromWinners(tournament) {
  for (const link of FUBOLS_CUP_BRACKET_ADVANCEMENT) {
    const duel = findDuel(tournament, link.roundIndex, link.duelIndex);
    if (!duel) continue;

    const resolveSource = (source) => {
      if (source.slot === 'A') {
        const semi = findDuel(tournament, source.roundIndex, source.duelIndex);
        return semi?.playerAId ? String(semi.playerAId) : null;
      }
      if (source.slot === 'B') {
        const semi = findDuel(tournament, source.roundIndex, source.duelIndex);
        return semi?.playerBId ? String(semi.playerBId) : null;
      }
      const prev = findDuel(tournament, source.roundIndex, source.duelIndex);
      return prev?.winnerId ? String(prev.winnerId) : null;
    };

    const playerAId = resolveSource(link.playerASource);
    const playerBId = resolveSource(link.playerBSource);
    if (playerAId) duel.playerAId = playerAId;
    if (playerBId) duel.playerBId = playerBId;
  }
}

async function loadUserNameMap(userIds = []) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const users = await User.find({ _id: { $in: ids } }).select('name').lean();
  return Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
}

async function attachTeamsToMatches(matches = []) {
  if (!matches.length) return [];
  const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
  const teams = teamIds.length
    ? await Team.find({ externalId: { $in: teamIds } }).select('externalId nameEn fifaCode').lean()
    : [];
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  return matches.map((m) => {
    const home = teamMap[m.homeTeamId];
    const away = teamMap[m.awayTeamId];
    const homeName = home?.nameEn ?? m.homeTeamId;
    const awayName = away?.nameEn ?? m.awayTeamId;
    return {
      ...m,
      homeTeam: { name: homeName, nameEn: homeName, externalId: m.homeTeamId },
      awayTeam: { name: awayName, nameEn: awayName, externalId: m.awayTeamId },
    };
  });
}

async function getMatchesByExternalIds(externalIds = []) {
  if (!externalIds.length) return [];
  const matches = await Match.find({ externalId: { $in: externalIds.map(String) } })
    .sort({ externalId: 1 })
    .lean();
  return attachTeamsToMatches(matches);
}

async function getRoundOf32FinishedExternalIds() {
  const matches = await Match.find({
    externalId: {
      $gte: String(FUBOLS_CUP_ROUND_OF_32_MIN),
      $lte: String(FUBOLS_CUP_ROUND_OF_32_MAX),
    },
    status: 'finished',
  })
    .select('externalId')
    .lean();
  return matches.map((m) => String(m.externalId));
}

async function ensureTournamentDocument(groupId) {
  const oid = toObjectId(groupId);
  let tournament = await FubolsCupTournament.findOne({ groupId: oid });
  if (!tournament) {
    tournament = await FubolsCupTournament.create({
      groupId: oid,
      status: 'preview',
      rounds: buildEmptyBracketRounds(),
    });
  }
  return tournament;
}

async function buildTournamentStatsMap(groupId) {
  const leaderboard = await getLeaderboard(groupId, 100);
  return new Map(leaderboard.map((row) => [String(row.id), row]));
}

async function fetchDuelPredictions(playerAId, playerBId, matchIds) {
  const predictions = await Prediction.find({
    userId: { $in: [playerAId, playerBId] },
    matchId: { $in: matchIds },
    pointsEarned: { $ne: null },
  }).lean();

  const byUserMatch = new Map();
  for (const p of predictions) {
    byUserMatch.set(`${p.userId.toString()}:${p.matchId.toString()}`, p);
  }
  return byUserMatch;
}

function pointsForPlayer(byUserMatch, userId, matchId) {
  const p = byUserMatch.get(`${userId}:${matchId}`);
  return p?.pointsEarned ?? 0;
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

function kickoffSlotQuery(kickoffAt) {
  if (!kickoffAt) return null;
  return {
    $or: [{ kickoffAt }, { scheduleKickoffAt: kickoffAt }],
  };
}

async function findMatchesInKickoffSlot(referenceMatch) {
  const kickoff = resolveScheduleKickoffAt(referenceMatch);
  const query = kickoffSlotQuery(kickoff);
  if (!query) return [referenceMatch];
  return Match.find(query).sort({ externalId: 1 }).lean();
}

function duelWorldCupExternalIds(roundKey, duelIndex) {
  return getWorldCupExternalIdsForDuel(roundKey, duelIndex);
}

async function resolveDuelIfReady(tournament, roundIndex, duelIndex, tournamentStats) {
  const round = tournament.rounds[roundIndex];
  const duel = round?.duels?.[duelIndex];
  if (!duel || duel.resolvedAt || !duel.playerAId || !duel.playerBId) return;

  const externalIds = duelWorldCupExternalIds(round.roundKey, duelIndex);
  const matches = await getMatchesByExternalIds(externalIds);

  if (!matches.every((m) => m.status === 'finished')) return;

  const firstUnfinishedSlot = await findMatchesInKickoffSlot(matches[0]);
  const pendingInSlot = firstUnfinishedSlot.some(
    (m) => m.status === 'upcoming' || m.status === 'live'
  );
  if (pendingInSlot) return;

  await rescoreUnscoredPredictions(matches);

  const playerAId = String(duel.playerAId);
  const playerBId = String(duel.playerBId);
  const matchIds = matches.map((m) => m._id);
  const byUserMatch = await fetchDuelPredictions(playerAId, playerBId, matchIds);

  const matchResults = matches.map((match) =>
    buildMatchResultSlice({
      matchId: match._id,
      externalId: match.externalId,
      pointsA: pointsForPlayer(byUserMatch, playerAId, match._id.toString()),
      pointsB: pointsForPlayer(byUserMatch, playerBId, match._id.toString()),
      playerAId,
      playerBId,
    })
  );

  const winnerId = resolveDuelWinner({
    matchResults: matchResults.map((row) => ({ pointsA: row.pointsA, pointsB: row.pointsB })),
    playerAId,
    playerBId,
    tournamentStatsByUserId: tournamentStats,
  });

  duel.matchResults = matchResults;
  duel.winnerId = winnerId;
  duel.resolvedAt = new Date();

  const roundMeta = FUBOLS_CUP_ROUNDS[roundIndex];
  if (roundMeta?.bothAdvanceToNextRound && roundIndex + 1 < tournament.rounds.length) {
    const finalDuel = tournament.rounds[roundIndex + 1].duels[0];
    finalDuel.playerAId = playerAId;
    finalDuel.playerBId = playerBId;
    const userMap = await loadUserNameMap([playerAId, playerBId]);
    finalDuel.playerAName = userMap[playerAId] ?? null;
    finalDuel.playerBName = userMap[playerBId] ?? null;
  }

  if (!duel.advancePaidAt) {
    await payoutFubolsCupAdvance({
      userId: winnerId,
      groupId: tournament.groupId,
      roundKey: round.roundKey,
      duelId: duel.duelId,
    });
    duel.advancePaidAt = new Date();
  }
}

export async function trySeedFubolsCup(groupId) {
  const tournament = await ensureTournamentDocument(groupId);
  if (tournament.status !== 'preview' && tournament.seededAt) {
    return tournament;
  }

  const finishedR32 = await getRoundOf32FinishedExternalIds();
  if (!isRoundOf32Complete(finishedR32)) {
    return tournament;
  }

  const top8 = await getHumanLeaderboardTop8(groupId);
  if (top8.length < FUBOLS_CUP_MIN_HUMANS) {
    tournament.status = 'cancelled';
    await tournament.save();
    return tournament;
  }

  tournament.seeds = top8.map((row, index) => ({
    userId: new mongoose.Types.ObjectId(row.id),
    seedRank: index + 1,
    tournamentPointsAtSeed: row.totalPoints ?? row.points ?? 0,
  }));
  tournament.rounds = buildEmptyBracketRounds();
  const userMap = await loadUserNameMap(top8.map((r) => r.id));
  assignFirstRoundPlayers(tournament.rounds, tournament.seeds, userMap);
  for (const row of tournament.rounds) {
    for (const duel of row.duels) {
      if (duel.playerAId) duel.playerAName = userMap[String(duel.playerAId)] ?? duel.playerAName;
      if (duel.playerBId) duel.playerBName = userMap[String(duel.playerBId)] ?? duel.playerBName;
    }
  }
  tournament.seededAt = new Date();
  tournament.status = 'running';
  await tournament.save();
  return tournament;
}

function applyPreviewPairings(tournament, previewTop8) {
  if (!tournament.rounds?.length) {
    tournament.rounds = buildEmptyBracketRounds();
  }
  const seeds = previewTop8.map((row, index) => ({
    userId: row.id,
    seedRank: index + 1,
    tournamentPointsAtSeed: row.totalPoints ?? row.points ?? 0,
  }));
  const userMap = Object.fromEntries(previewTop8.map((r) => [String(r.id), r.name]));
  assignFirstRoundPlayers(tournament.rounds, seeds, userMap);
}

const FUBOLS_CUP_WC_EXTERNAL_MIN = FUBOLS_CUP_ROUND_OF_32_MIN;
const FUBOLS_CUP_WC_EXTERNAL_MAX = 104;

export async function processFubolsCupAfterMatchFinished(match) {
  const externalId = Number.parseInt(String(match?.externalId ?? ''), 10);
  if (
    !Number.isFinite(externalId) ||
    externalId < FUBOLS_CUP_WC_EXTERNAL_MIN ||
    externalId > FUBOLS_CUP_WC_EXTERNAL_MAX
  ) {
    return;
  }

  const tournaments = await FubolsCupTournament.find({
    status: { $in: ['preview', 'running'] },
  })
    .select('groupId')
    .lean();

  await Promise.all(
    tournaments.map((row) =>
      processFubolsCupForGroup(row.groupId.toString()).catch((err) => {
        console.warn(`Copa Fubols process failed (${row.groupId}):`, err.message);
      })
    )
  );
}

export async function processFubolsCupForGroup(groupId) {
  let tournament = await ensureTournamentDocument(groupId);
  if (tournament.status === 'cancelled' || tournament.status === 'completed') {
    return tournament;
  }

  tournament = await trySeedFubolsCup(groupId);
  if (tournament.status !== 'running') {
    return tournament;
  }

  const tournamentStats = await buildTournamentStatsMap(groupId);

  for (let roundIndex = 0; roundIndex < tournament.rounds.length; roundIndex += 1) {
    assignBracketFromWinners(tournament);
    const userIds = tournament.rounds.flatMap((r) =>
      r.duels.flatMap((d) => [d.playerAId, d.playerBId]).filter(Boolean)
    );
    const userMap = await loadUserNameMap(userIds);
    for (const round of tournament.rounds) {
      for (const duel of round.duels) {
        if (duel.playerAId) duel.playerAName = userMap[String(duel.playerAId)] ?? duel.playerAName;
        if (duel.playerBId) duel.playerBName = userMap[String(duel.playerBId)] ?? duel.playerBName;
      }
    }

    const round = tournament.rounds[roundIndex];
    for (let duelIndex = 0; duelIndex < round.duels.length; duelIndex += 1) {
      await resolveDuelIfReady(tournament, roundIndex, duelIndex, tournamentStats);
      assignBracketFromWinners(tournament);
    }
  }

  const finalRound = tournament.rounds[tournament.rounds.length - 1];
  const finalDuel = finalRound?.duels?.[0];
  if (finalDuel?.resolvedAt && finalDuel.winnerId && tournament.status !== 'completed') {
    tournament.status = 'completed';
    tournament.completedAt = new Date();
    tournament.championId = finalDuel.winnerId;
    await tournament.save();
    if (!tournament.championPrizePaidAt) {
      await payoutFubolsCupChampion({
        userId: finalDuel.winnerId,
        groupId: tournament.groupId,
      });
    }
  } else {
    await tournament.save();
  }

  return tournament;
}

function serializeMatch(match) {
  if (!match) return null;
  return {
    id: match._id?.toString?.() ?? String(match._id),
    externalId: String(match.externalId),
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    kickoffAt: match.kickoffAt,
    scheduleKickoffAt: match.scheduleKickoffAt,
  };
}

function serializeDuel(duel, roundKey) {
  const externalIds = duelWorldCupExternalIds(roundKey, duel.duelIndex);
  return {
    duelId: duel.duelId,
    duelIndex: duel.duelIndex,
    playerA: duel.playerAId
      ? { id: String(duel.playerAId), name: duel.playerAName, seed: duel.seedA }
      : null,
    playerB: duel.playerBId
      ? { id: String(duel.playerBId), name: duel.playerBName, seed: duel.seedB }
      : null,
    winnerId: duel.winnerId ? String(duel.winnerId) : null,
    matchResults: (duel.matchResults ?? []).map((row) => ({
      matchId: row.matchId ? String(row.matchId) : null,
      externalId: row.externalId,
      pointsA: row.pointsA,
      pointsB: row.pointsB,
      winnerId: row.winnerId ? String(row.winnerId) : null,
      margin: row.margin,
    })),
    worldCupExternalIds: externalIds,
    resolvedAt: duel.resolvedAt,
  };
}

export async function getFubolsCupDashboard(groupId, viewerUserId) {
  const oid = toObjectId(groupId);
  const group = await CompetitionGroup.findById(oid).lean();
  if (!group) throw cupError('Grupo no encontrado', 404);

  if (viewerUserId) {
    const membership = await UserGroupMembership.findOne({ userId: viewerUserId, groupId: oid });
    if (!membership) throw cupError('Debés ser miembro del grupo', 403);
  }

  const tournament = await processFubolsCupForGroup(groupId);
  const previewTop8 = await getHumanLeaderboardTop8(groupId);
  const r32Finished = await getRoundOf32FinishedExternalIds();
  const r32Complete = isRoundOf32Complete(r32Finished);

  let roundsPayload = tournament.rounds ?? [];
  if (tournament.status === 'preview') {
    const previewDoc = { rounds: buildEmptyBracketRounds() };
    applyPreviewPairings(previewDoc, previewTop8);
    roundsPayload = previewDoc.rounds;
  }

  let champion = null;
  if (tournament.championId) {
    const user = await User.findById(tournament.championId).select('name').lean();
    champion = user ? { id: user._id.toString(), name: user.name } : null;
  }

  const rounds = await Promise.all(
    roundsPayload.map(async (round) => {
      const matches = await getMatchesByExternalIds(round.worldCupExternalIds ?? []);
      const matchByExternalId = Object.fromEntries(
        matches.map((m) => [String(m.externalId), serializeMatch(m)])
      );
      return {
        roundKey: round.roundKey,
        label: round.label,
        duels: (round.duels ?? []).map((duel) => serializeDuel(duel, round.roundKey)),
        matchesByExternalId: matchByExternalId,
      };
    })
  );

  return {
    tournament: {
      status: tournament.status,
      seededAt: tournament.seededAt,
      completedAt: tournament.completedAt,
      humanCount: previewTop8.length,
      r32Complete,
    },
    seeds: (tournament.seeds ?? []).map((row) => ({
      userId: String(row.userId),
      seedRank: row.seedRank,
      tournamentPointsAtSeed: row.tournamentPointsAtSeed,
      name: previewTop8.find((p) => String(p.id) === String(row.userId))?.name ?? null,
    })),
    previewTop8: previewTop8.map((row) => ({
      id: String(row.id),
      name: row.name,
      rank: row.rank,
      totalPoints: row.totalPoints ?? row.points ?? 0,
    })),
    rounds,
    champion,
    prizes: {
      championFubols: FUBOLS_CUP_CHAMPION_PRIZE,
      roundAdvanceFubols: FUBOLS_CUP_ROUND_ADVANCE_PRIZE,
      trophy: 'La Copa FUBOLS',
    },
  };
}
