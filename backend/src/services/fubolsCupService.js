import mongoose from 'mongoose';
import crypto from 'node:crypto';
import {
  FUBOLS_CUP_BRACKET_ADVANCEMENT,
  FUBOLS_CUP_FIRST_ROUND_PAIRINGS,
  FUBOLS_CUP_MIN_HUMANS,
  FUBOLS_CUP_ROUNDS,
  FUBOLS_CUP_ROUND_OF_32_MAX,
  FUBOLS_CUP_ROUND_OF_32_MIN,
  applyShuffledMatchAssignmentsToRounds,
  buildEmptyBracketRounds,
  getDuelWorldCupExternalIds,
  isRoundOf32Complete,
  reconcileWorldCupMatchAssignments,
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
import { Stadium } from '../models/Stadium.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { payoutFubolsCupAdvance, payoutFubolsCupChampion } from './fubolService.js';
import { getLeaderboard } from './leaderboardService.js';
import { resolveScheduleKickoffAt } from './kickoffTimeService.js';
import { recalculateMatchScores } from './syncService.js';
import { enrichMatches } from './matchEnrichmentService.js';
import { PREDICTIONS_LIST_MATCH_PROJECTION } from './liveBarMatchProjection.js';
import { getFifaWorldRankings } from './aiTeamMatchContextService.js';
import {
  buildKnockoutPhases,
  WORLD_CUP_MATCH_SELECT,
} from './worldCupStatsService.js';

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
      if (!prev?.playerAId || !prev?.playerBId) return null;
      if (source.slot === 'loser') {
        if (!prev.winnerId) return null;
        return String(prev.winnerId) === String(prev.playerAId)
          ? String(prev.playerBId)
          : String(prev.playerAId);
      }
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
      homeTeam: {
        name: homeName,
        nameEn: homeName,
        externalId: m.homeTeamId,
        fifaCode: home?.fifaCode ?? m.homeTeamId,
        flag: home?.flag ?? null,
      },
      awayTeam: {
        name: awayName,
        nameEn: awayName,
        externalId: m.awayTeamId,
        fifaCode: away?.fifaCode ?? m.awayTeamId,
        flag: away?.flag ?? null,
      },
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

function markRoundsDirty(tournament) {
  tournament.markModified('rounds');
}

async function saveTournament(tournament) {
  markRoundsDirty(tournament);
  return tournament.save();
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
  if (!referenceMatch) return [];
  const kickoff = resolveScheduleKickoffAt(referenceMatch);
  const query = kickoffSlotQuery(kickoff);
  if (!query) return [referenceMatch];
  const slot = await Match.find(query).sort({ externalId: 1 }).lean();
  return slot.length ? slot : [referenceMatch];
}

function duelWorldCupExternalIds(round, duelIndex) {
  return getDuelWorldCupExternalIds(round, duelIndex);
}

async function resolveDuelIfReady(tournament, roundIndex, duelIndex, tournamentStats) {
  const round = tournament.rounds[roundIndex];
  const duel = round?.duels?.[duelIndex];
  if (!duel || duel.resolvedAt || !duel.playerAId || !duel.playerBId) return;

  const externalIds = duelWorldCupExternalIds(round, duelIndex);
  const matches = await getMatchesByExternalIds(externalIds);

  if (matches.length !== externalIds.length) return;
  if (!matches.every((m) => m?.status === 'finished')) return;

  const firstMatch = matches.find(Boolean);
  if (!firstMatch) return;

  const firstUnfinishedSlot = await findMatchesInKickoffSlot(firstMatch);
  const pendingInSlot = firstUnfinishedSlot.filter(Boolean).some(
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
  tournament.matchShuffleSeed = crypto.randomBytes(16).toString('hex');
  applyShuffledMatchAssignmentsToRounds(tournament.rounds, tournament.matchShuffleSeed);
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
  await saveTournament(tournament);
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

  if (tournament.matchShuffleSeed) {
    reconcileWorldCupMatchAssignments(tournament.rounds, tournament.matchShuffleSeed, {
      onlyUnresolved: true,
    });
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

  const finalRound = tournament.rounds.find((row) => row.roundKey === 'final');
  const finalDuel = finalRound?.duels?.[0];
  if (finalDuel?.resolvedAt && finalDuel.winnerId && tournament.status !== 'completed') {
    tournament.status = 'completed';
    tournament.completedAt = new Date();
    tournament.championId = finalDuel.winnerId;
    await saveTournament(tournament);
    if (!tournament.championPrizePaidAt) {
      await payoutFubolsCupChampion({
        userId: finalDuel.winnerId,
        groupId: tournament.groupId,
      });
    }
  } else {
    await saveTournament(tournament);
  }

  return tournament;
}

function compareWorldCupMatchChronology(a, b) {
  const timeA = a.match?.kickoffAt ? new Date(a.match.kickoffAt).getTime() : NaN;
  const timeB = b.match?.kickoffAt ? new Date(b.match.kickoffAt).getTime() : NaN;
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  return Number(a.externalId) - Number(b.externalId);
}

function enrichDuelsWithWorldCupMatches(duels, matchByExternalId) {
  return duels.map((duel) => {
    const worldCupMatches = (duel.worldCupExternalIds ?? [])
      .map((externalId) => ({
        externalId: String(externalId),
        match: matchByExternalId[String(externalId)] ?? null,
      }))
      .sort(compareWorldCupMatchChronology);
    return {
      ...duel,
      worldCupMatches,
    };
  });
}

function applyOfficialKnockoutDisplay(enriched, official) {
  if (!official) return enriched;

  return {
    ...enriched,
    homeTeam: official.homeTeam ?? enriched.homeTeam,
    awayTeam: official.awayTeam ?? enriched.awayTeam,
    homeTeamSlotLabel: official.homeTeam ? null : official.homeTeamSlotLabel,
    awayTeamSlotLabel: official.awayTeam ? null : official.awayTeamSlotLabel,
    homeTeamSlotSourceMatch: official.homeTeam ? null : official.homeTeamSlotSourceMatch,
    awayTeamSlotSourceMatch: official.awayTeam ? null : official.awayTeamSlotSourceMatch,
    knockoutPhase: official.phaseLabel ?? enriched.knockoutPhase,
  };
}

const KNOCKOUT_EXTERNAL_IDS = Array.from({ length: 32 }, (_, index) => String(73 + index));

async function loadOfficialKnockoutDisplayByExternalId(targetExternalIds) {
  const targetSet = new Set(targetExternalIds.map(String));
  const needsKnockout = [...targetSet].some((id) => {
    const n = Number(id);
    return Number.isFinite(n) && n >= 73 && n <= 104;
  });
  if (!needsKnockout) return {};

  const [knockoutMatches, teams, stadiums, rankings] = await Promise.all([
    Match.find({ externalId: { $in: KNOCKOUT_EXTERNAL_IDS } })
      .select(WORLD_CUP_MATCH_SELECT)
      .lean(),
    Team.find({}).lean(),
    Stadium.find({}).lean(),
    getFifaWorldRankings(),
  ]);

  const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
  const stadiumMap = Object.fromEntries(stadiums.map((stadium) => [stadium.externalId, stadium]));
  const phases = buildKnockoutPhases(knockoutMatches, teamMap, stadiumMap, rankings);

  const byExternalId = {};
  for (const phase of phases) {
    for (const match of phase.matches) {
      const key = String(match.externalId);
      if (targetSet.has(key)) {
        byExternalId[key] = match;
      }
    }
  }
  return byExternalId;
}

async function loadEnrichedMatchesByExternalId(externalIds, viewerUserId) {
  const ids = [...new Set(externalIds.map(String))].filter(Boolean);
  if (!ids.length) return {};

  const rawMatches = await Match.find({ externalId: { $in: ids } })
    .select(PREDICTIONS_LIST_MATCH_PROJECTION)
    .sort({ externalId: 1 })
    .lean();

  const viewerId = viewerUserId ? toObjectId(viewerUserId) : null;
  const [enrichedMatches, officialByExternalId] = await Promise.all([
    enrichMatches(rawMatches, viewerId, {
      includePlayers: false,
      includeKnockoutContext: false,
      ensureUserDefaults: false,
      includeWeather: false,
      includeLiveFields: false,
    }),
    loadOfficialKnockoutDisplayByExternalId(ids),
  ]);

  return Object.fromEntries(
    enrichedMatches.map((match) => [
      String(match.externalId),
      applyOfficialKnockoutDisplay(match, officialByExternalId[String(match.externalId)]),
    ])
  );
}

function serializeDuel(duel, round) {
  const externalIds = duelWorldCupExternalIds(round, duel.duelIndex);
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
    applyShuffledMatchAssignmentsToRounds(previewDoc.rounds, `preview:${groupId}`);
    roundsPayload = previewDoc.rounds;
  }

  let champion = null;
  if (tournament.championId) {
    const user = await User.findById(tournament.championId).select('name').lean();
    champion = user ? { id: user._id.toString(), name: user.name } : null;
  }

  const allExternalIds = [
    ...new Set(roundsPayload.flatMap((round) => round.worldCupExternalIds ?? [])),
  ];
  const matchByExternalId = await loadEnrichedMatchesByExternalId(allExternalIds, viewerUserId);

  const rounds = roundsPayload.map((round) => {
    const serializedDuels = (round.duels ?? []).map((duel) => serializeDuel(duel, round));
    const duels = enrichDuelsWithWorldCupMatches(serializedDuels, matchByExternalId);
    return {
      roundKey: round.roundKey,
      label: round.label,
      duels,
    };
  });

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
