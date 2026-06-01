import bcrypt from 'bcryptjs';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { Prediction } from '../models/Prediction.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { SimulationState } from '../models/SimulationState.js';
import { createCompetitionGroup } from './competitionGroupService.js';
import { getLeaderboard } from './leaderboardService.js';
import { buildMatchPredictionRankings } from './matchPredictionRankingsService.js';
import { recalculateMatchScores, ensureWorldCupTeamsLoaded } from './syncService.js';
import {
  notifyLeaderboardUpdated,
  notifyMatchesUpdated,
} from './websocketService.js';
import {
  GROUP_LETTERS,
  KNOCKOUT_ROUNDS,
  TOTAL_FULL_TOURNAMENT_MATCHES,
  TOTAL_GROUP_MATCHES,
  TOTAL_KNOCKOUT_MATCHES,
  buildGroupStageFixtures,
  buildLoserEntries,
  buildNextRoundCrossovers,
  buildQualifierField,
  buildRoundOf32Crossovers,
  buildWinnerEntries,
  compareSimulationSchedule,
  computeGroupStandingsFromMatches,
  getKnockoutRoundMeta,
  getNextKnockoutRound,
  isGroupStageComplete,
  isKnockoutRoundComplete,
  MATCH_INTERVAL_MS,
  organizeTeamsByGroup,
} from './simulationTournamentService.js';

const SIM_EMAIL_DOMAIN = '@sim.mundial2026.local';
const DEFAULT_PLAYERS = 10;
const DEFAULT_MATCHES = 12;
const SIM_PASSWORD = 'sim123456';

const PLAYER_NAMES = [
  'Ana Torres',
  'Bruno Díaz',
  'Carla Ruiz',
  'Diego Luna',
  'Elena Vargas',
  'Federico Paz',
  'Gabriela Sol',
  'Hugo Mena',
  'Iván Costa',
  'Julia Ríos',
];

import { randomScore, buildPairings } from './simulationService.helpers.js';

export { randomScore, buildPairings } from './simulationService.helpers.js';

function buildGroupsUsedSnapshot(teamsByGroup) {
  return GROUP_LETTERS.map((letter) => ({
    group: letter,
    teams: (teamsByGroup[letter] || []).slice(0, 4).map((team) => ({
      externalId: team.externalId,
      nameEn: team.nameEn,
      fifaCode: team.fifaCode,
    })),
  }));
}

async function ensure48Teams() {
  const { teams } = await ensureWorldCupTeamsLoaded();
  const teamsByGroup = organizeTeamsByGroup(teams);

  return {
    teams,
    teamsCount: teams.length,
    groupsUsed: buildGroupsUsedSnapshot(teamsByGroup),
  };
}

async function enrichMatch(match) {
  if (!match) return null;
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }),
    Team.findOne({ externalId: match.awayTeamId }),
  ]);

  return {
    id: match._id.toString(),
    externalId: match.externalId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    group: match.group,
    matchday: match.matchday,
    localDate: match.localDate,
    status: match.status,
    kickoffAt: match.kickoffAt,
    type: match.type,
    crossover: match.raw?.crossover ?? null,
    scheduleOrder: match.raw?.scheduleOrder ?? null,
    globalMatchday: match.raw?.globalMatchday ?? null,
    homeTeam: homeTeam
      ? {
          nameEn: homeTeam.nameEn,
          fifaCode: homeTeam.fifaCode,
          flag: homeTeam.flag,
          externalId: homeTeam.externalId,
        }
      : null,
    awayTeam: awayTeam
      ? {
          nameEn: awayTeam.nameEn,
          fifaCode: awayTeam.fifaCode,
          flag: awayTeam.flag,
          externalId: awayTeam.externalId,
        }
      : null,
  };
}

async function seedPredictions(users, matchIds) {
  for (const matchId of matchIds) {
    for (const user of users) {
      await Prediction.create({
        userId: user._id,
        matchId,
        homeGoals: randomScore(),
        awayGoals: randomScore(),
        pointsEarned: null,
        bonusPoint: 0,
        bonusReason: null,
        pointsBreakdown: null,
      });
    }
  }
}

async function createMatchesFromFixtures({
  fixtures,
  runId,
  users,
  state,
  baseKickoff,
  startOrder = 0,
}) {
  const created = [];
  for (let i = 0; i < fixtures.length; i += 1) {
    const fixture = fixtures[i];
    const scheduleOrder = fixture.order ?? startOrder + i;
    const match = await Match.create({
      externalId: `sim-${runId}-${scheduleOrder + 1}`,
      homeTeamId: fixture.home.externalId ?? fixture.home.teamId,
      awayTeamId: fixture.away.externalId ?? fixture.away.teamId,
      homeScore: 0,
      awayScore: 0,
      group: fixture.group || '',
      matchday: fixture.matchday || '',
      localDate: fixture.localDate,
      type: fixture.type || 'group',
      status: 'upcoming',
      kickoffAt: new Date(baseKickoff.getTime() + scheduleOrder * MATCH_INTERVAL_MS),
      lastSyncedAt: new Date(),
      raw: {
        scheduleOrder,
        crossover: fixture.crossover || null,
        bracketSlot: fixture.bracketSlot || null,
        globalMatchday: fixture.globalMatchday || null,
        knockoutRound: fixture.type !== 'group' ? fixture.type : null,
      },
    });
    created.push(match);
    state.matchIds.push(match._id);
  }

  await seedPredictions(users, created.map((match) => match._id));
  state.matchCount += created.length;
  await state.save();
  return created;
}

async function resolveScheduleContinuation(state) {
  const [firstMatch, lastMatch] = await Promise.all([
    Match.findOne({ _id: { $in: state.matchIds } }).sort({ 'raw.scheduleOrder': 1, kickoffAt: 1 }),
    Match.findOne({ _id: { $in: state.matchIds } }).sort({ 'raw.scheduleOrder': -1, kickoffAt: -1 }),
  ]);

  const lastOrder = lastMatch?.raw?.scheduleOrder;
  const startOrder = Number.isFinite(lastOrder) ? lastOrder + 1 : 0;

  const firstOrder = firstMatch?.raw?.scheduleOrder ?? 0;
  const tournamentBase = firstMatch?.kickoffAt
    ? new Date(firstMatch.kickoffAt.getTime() - firstOrder * MATCH_INTERVAL_MS)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    baseKickoff: tournamentBase,
    startOrder,
  };
}

async function findNextUpcomingMatch(state) {
  const upcoming = await Match.find({
    _id: { $in: state.matchIds },
    status: 'upcoming',
  });
  upcoming.sort(compareSimulationSchedule);
  return upcoming[0] ?? null;
}

function randomKnockoutScore() {
  let home = randomScore();
  let away = randomScore();
  let attempts = 0;
  while (home === away && attempts < 10) {
    away = randomScore();
    attempts += 1;
  }
  if (home === away) {
    home += 1;
  }
  return { home, away };
}

function scoreForMatch(match) {
  if (match.type && match.type !== 'group') {
    return randomKnockoutScore();
  }
  return { home: randomScore(), away: randomScore() };
}

async function maybeAdvanceTournament(state, users, runId) {
  if (state.mode !== 'full') return;

  const matches = await Match.find({ _id: { $in: state.matchIds } }).sort({ kickoffAt: 1 });
  const groupMatches = matches.filter((match) => match.type === 'group');
  const finishedGroup = groupMatches.filter((match) => match.status === 'finished');

  if (state.phase === 'group' && isGroupStageComplete(groupMatches, finishedGroup.length)) {
    await generateRoundOf32(state, users, runId, groupMatches);
    return;
  }

  if (state.phase !== 'knockout' || !state.currentKnockoutRound) return;

  const roundMatches = matches.filter((match) => match.type === state.currentKnockoutRound);
  if (!isKnockoutRoundComplete(roundMatches)) return;

  if (state.currentKnockoutRound === 'semi_final') {
    await generateSemifinalExtras(state, users, runId, roundMatches);
    return;
  }

  if (state.currentKnockoutRound === 'third_place' || state.currentKnockoutRound === 'final') {
    return;
  }

  const nextRound = getNextKnockoutRound(state.currentKnockoutRound);
  if (!nextRound) {
    state.phase = 'completed';
    state.currentKnockoutRound = null;
    await state.save();
    return;
  }

  await generateKnockoutRound(state, users, runId, nextRound, roundMatches);
}

async function generateRoundOf32(state, users, runId, groupMatches) {
  const finishedGroupMatches = groupMatches.filter((match) => match.status === 'finished');
  const teams = await Team.find({
    externalId: {
      $in: [
        ...new Set(
          groupMatches.flatMap((match) => [match.homeTeamId, match.awayTeamId])
        ),
      ],
    },
  });
  const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
  const standings = computeGroupStandingsFromMatches(teams, finishedGroupMatches);
  const qualifiers = buildQualifierField(standings, teamMap);
  const crossovers = buildRoundOf32Crossovers(qualifiers);
  const { baseKickoff, startOrder } = await resolveScheduleContinuation(state);

  const fixtures = crossovers.map((pair, index) => ({
    home: pair.home.team,
    away: pair.away.team,
    type: 'round_of_32',
    localDate: `Dieciseisavos · ${pair.crossover}`,
    crossover: pair.crossover,
    bracketSlot: pair.bracketSlot,
    order: startOrder + index,
  }));

  await createMatchesFromFixtures({
    fixtures,
    runId,
    users,
    state,
    baseKickoff,
    startOrder,
  });

  state.phase = 'knockout';
  state.currentKnockoutRound = 'round_of_32';
  state.pendingCrossovers = crossovers.map((pair) => ({
    round: 'round_of_32',
    crossover: pair.crossover,
    home: pair.home.seedLabel,
    away: pair.away.seedLabel,
  }));
  await state.save();

  notifyMatchesUpdated({ reason: 'simulation_knockout_generated', round: 'round_of_32' });
}

async function generateKnockoutRound(state, users, runId, roundType, previousRoundMatches) {
  const teams = await Team.find();
  const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
  const winners = buildWinnerEntries(previousRoundMatches, teamMap);
  const crossovers = buildNextRoundCrossovers(winners);
  const meta = getKnockoutRoundMeta(roundType);
  const { baseKickoff, startOrder } = await resolveScheduleContinuation(state);

  const fixtures = crossovers.map((pair, index) => ({
    home: pair.home.team,
    away: pair.away.team,
    type: roundType,
    localDate: `${meta?.label || roundType} · ${pair.crossover}`,
    crossover: pair.crossover,
    bracketSlot: pair.bracketSlot,
    order: startOrder + index,
  }));

  await createMatchesFromFixtures({
    fixtures,
    runId,
    users,
    state,
    baseKickoff,
    startOrder,
  });

  state.currentKnockoutRound = roundType;
  state.pendingCrossovers = crossovers.map((pair) => ({
    round: roundType,
    crossover: pair.crossover,
    home: pair.home.sourceLabel,
    away: pair.away.sourceLabel,
  }));
  await state.save();

  notifyMatchesUpdated({ reason: 'simulation_knockout_generated', round: roundType });
}

async function generateSemifinalExtras(state, users, runId, semiMatches) {
  const teams = await Team.find();
  const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
  const winners = buildWinnerEntries(semiMatches, teamMap);
  const losers = buildLoserEntries(semiMatches, teamMap);
  const { baseKickoff, startOrder } = await resolveScheduleContinuation(state);

  const fixtures = [
    {
      home: losers[0].team,
      away: losers[1].team,
      type: 'third_place',
      localDate: 'Tercer puesto · Perdedores de semifinales',
      crossover: `${losers[0].sourceLabel} vs ${losers[1].sourceLabel}`,
      bracketSlot: 1,
      order: startOrder,
    },
    {
      home: winners[0].team,
      away: winners[1].team,
      type: 'final',
      localDate: 'Final · Campeón del simulacro',
      crossover: `${winners[0].sourceLabel} vs ${winners[1].sourceLabel}`,
      bracketSlot: 1,
      order: startOrder + 1,
    },
  ];

  await createMatchesFromFixtures({
    fixtures,
    runId,
    users,
    state,
    baseKickoff,
    startOrder,
  });

  state.currentKnockoutRound = 'third_place';
  state.pendingCrossovers = fixtures.map((fixture) => ({
    round: fixture.type,
    crossover: fixture.crossover,
  }));
  await state.save();

  notifyMatchesUpdated({ reason: 'simulation_knockout_generated', round: 'third_place,final' });
}

export async function cleanupSimulation() {
  const state = await SimulationState.findOne({ key: 'active' });
  if (!state) return { cleaned: false };

  await Prediction.deleteMany({ userId: { $in: state.userIds } });
  await User.deleteMany({ _id: { $in: state.userIds } });
  await Match.deleteMany({ _id: { $in: state.matchIds } });
  await CompetitionGroup.deleteOne({ _id: state.groupId });
  await SimulationState.deleteOne({ _id: state._id });

  return { cleaned: true };
}

export async function setupSimulation({
  playerCount = DEFAULT_PLAYERS,
  matchCount = DEFAULT_MATCHES,
  mode = 'full',
} = {}) {
  await cleanupSimulation();

  const runId = Date.now().toString(36);
  const group = await createCompetitionGroup({
    name: `Simulación ${new Date().toLocaleString('es-AR')}`,
    description:
      mode === 'full'
        ? 'Mundial completo: 72 partidos de grupos + fase final con cruces'
        : 'Demo rápida de predicciones',
  });

  const passwordHash = await bcrypt.hash(SIM_PASSWORD, 10);
  const users = [];

  for (let i = 0; i < playerCount; i += 1) {
    const name = PLAYER_NAMES[i] || `Jugador ${i + 1}`;
    const user = await User.create({
      name,
      email: `sim-${runId}-${i + 1}${SIM_EMAIL_DOMAIN}`,
      passwordHash,
      competitionGroupId: group.id,
      totalPoints: 0,
    });
    users.push(user);
  }

  const baseKickoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  let fixtures = [];
  let groupMatchCount = 0;

  let groupsUsed = [];

  if (mode === 'full') {
    const { teams, groupsUsed: zones, teamsCount } = await ensure48Teams();
    groupsUsed = zones;
    const teamsByGroup = organizeTeamsByGroup(teams);
    fixtures = buildGroupStageFixtures(teamsByGroup);
    groupMatchCount = fixtures.length;
  } else {
    if ((await Team.countDocuments()) < 2) {
      await ensureWorldCupTeamsLoaded().catch(() => null);
    }
    const teams = await Team.find().sort({ nameEn: 1 }).limit(48);
    const available = teams.length >= 2 ? teams : await Team.find().sort({ nameEn: 1 }).limit(48);
    fixtures = buildPairings(available, matchCount).map((pair, index) => ({
      home: pair.home,
      away: pair.away,
      group: pair.home.group || String.fromCharCode(65 + (index % 12)),
      type: 'group',
      matchday: String((index % 3) + 1),
      order: index,
      localDate: `Sim · Partido ${index + 1}`,
    }));
    groupMatchCount = fixtures.length;
  }

  const state = await SimulationState.create({
    key: 'active',
    runId,
    groupId: group.id,
    matchIds: [],
    userIds: users.map((user) => user._id),
    liveMatchId: null,
    finishedCount: 0,
    matchCount: 0,
    playerCount: users.length,
    mode,
    phase: 'group',
    currentKnockoutRound: null,
    groupMatchCount,
    pendingCrossovers: null,
    groupsUsed,
  });

  await createMatchesFromFixtures({
    fixtures,
    runId,
    users,
    state,
    baseKickoff,
    startOrder: 0,
  });

  notifyMatchesUpdated({ reason: 'simulation_setup', mode });
  notifyLeaderboardUpdated({ reason: 'simulation_setup' });

  return getSimulationStatus();
}

export async function getSimulationStatus() {
  const state = await SimulationState.findOne({ key: 'active' });
  if (!state) {
    return { active: false };
  }

  const [group, liveMatch, upcomingMatches, finishedMatches, allMatches, leaderboard] =
    await Promise.all([
      CompetitionGroup.findById(state.groupId),
      state.liveMatchId ? Match.findById(state.liveMatchId) : null,
      Match.find({
        _id: { $in: state.matchIds },
        status: 'upcoming',
      }),
      Match.find({
        _id: { $in: state.matchIds },
        status: 'finished',
      }),
      Match.find({ _id: { $in: state.matchIds } }),
      getLeaderboard(state.groupId.toString()),
    ]);

  upcomingMatches.sort(compareSimulationSchedule);
  finishedMatches.sort(compareSimulationSchedule);
  allMatches.sort(compareSimulationSchedule);

  const nextMatch = state.liveMatchId ? null : upcomingMatches[0] ?? null;

  const groupFinished = allMatches.filter(
    (match) => match.type === 'group' && match.status === 'finished'
  ).length;
  const knockoutFinished = allMatches.filter(
    (match) => match.type !== 'group' && match.status === 'finished'
  ).length;
  const currentRoundMatches = state.currentKnockoutRound
    ? allMatches.filter((match) => match.type === state.currentKnockoutRound)
    : [];
  const currentRoundFinished = currentRoundMatches.filter(
    (match) => match.status === 'finished'
  ).length;

  const [liveEnriched, nextEnriched, finishedEnriched, scheduledEnriched] = await Promise.all([
    enrichMatch(liveMatch),
    enrichMatch(nextMatch),
    Promise.all(finishedMatches.map((match) => enrichMatch(match))),
    Promise.all(allMatches.map((match) => enrichMatch(match))),
  ]);

  const remainingCount =
    state.mode === 'full'
      ? TOTAL_FULL_TOURNAMENT_MATCHES - state.finishedCount
      : state.matchCount - state.finishedCount;

  let groupStandings = [];
  if (state.mode === 'full') {
    const teams = await Team.find({
      externalId: {
        $in: [
          ...new Set(
            allMatches
              .filter((match) => match.type === 'group')
              .flatMap((match) => [match.homeTeamId, match.awayTeamId])
          ),
        ],
      },
    });
    groupStandings = computeGroupStandingsFromMatches(
      teams,
      allMatches.filter((match) => match.type === 'group' && match.status === 'finished')
    );
  }

  const { rankingsByMatch: matchPredictionRankings } = await buildMatchPredictionRankings(
    state.groupId.toString(),
    finishedMatches
  );

  return {
    active: true,
    runId: state.runId,
    mode: state.mode,
    phase: state.phase,
    currentKnockoutRound: state.currentKnockoutRound,
    currentKnockoutLabel: getKnockoutRoundMeta(state.currentKnockoutRound)?.label ?? null,
    group: group
      ? { id: group._id.toString(), name: group.name, description: group.description }
      : null,
    playerCount: state.playerCount,
    matchCount: state.matchCount,
    finishedCount: state.finishedCount,
    remainingCount,
    teamsCount: state.mode === 'full' ? GROUP_LETTERS.length * 4 : null,
    groupMatchCount: state.groupMatchCount,
    groupFinishedCount: groupFinished,
    knockoutMatchCount: state.mode === 'full' ? TOTAL_KNOCKOUT_MATCHES : 0,
    knockoutFinishedCount: knockoutFinished,
    totalPlannedMatches: state.mode === 'full' ? TOTAL_FULL_TOURNAMENT_MATCHES : state.matchCount,
    currentRoundProgress: state.currentKnockoutRound
      ? {
          round: state.currentKnockoutRound,
          label: getKnockoutRoundMeta(state.currentKnockoutRound)?.label,
          finished: currentRoundFinished,
          total: currentRoundMatches.length,
        }
      : null,
    pendingCrossovers: state.pendingCrossovers,
    groupsUsed: state.groupsUsed || [],
    groupZonesCount: GROUP_LETTERS.length,
    groupStandings,
    isLive: Boolean(state.liveMatchId),
    liveMatch: liveEnriched,
    nextMatch: state.liveMatchId ? null : nextEnriched,
    finishedMatches: finishedEnriched.filter(Boolean),
    scheduledMatches: scheduledEnriched.filter(Boolean),
    matchPredictionRankings,
    predictionGroup: group
      ? { id: group._id.toString(), name: group.name }
      : null,
    leaderboard,
  };
}

export async function startNextLiveMatch() {
  const state = await SimulationState.findOne({ key: 'active' });
  if (!state) {
    const error = new Error('No hay simulación activa');
    error.status = 404;
    throw error;
  }
  if (state.liveMatchId) {
    const error = new Error('Ya hay un partido en curso');
    error.status = 409;
    throw error;
  }
  if (state.phase === 'completed') {
    const error = new Error('La simulación ya terminó');
    error.status = 409;
    throw error;
  }

  const nextMatch = await findNextUpcomingMatch(state);

  if (!nextMatch) {
    const error = new Error('No quedan partidos por jugar');
    error.status = 409;
    throw error;
  }

  nextMatch.status = 'live';
  nextMatch.lastSyncedAt = new Date();
  await nextMatch.save();

  state.liveMatchId = nextMatch._id;
  await state.save();

  notifyMatchesUpdated({
    reason: 'simulation_live',
    matchId: nextMatch._id.toString(),
  });

  return getSimulationStatus();
}

export async function finishLiveMatch() {
  const state = await SimulationState.findOne({ key: 'active' });
  if (!state?.liveMatchId) {
    const error = new Error('No hay partido en curso para finalizar');
    error.status = 409;
    throw error;
  }

  const match = await Match.findById(state.liveMatchId);
  if (!match) {
    const error = new Error('Partido en curso no encontrado');
    error.status = 404;
    throw error;
  }

  const scores = scoreForMatch(match);
  match.homeScore = scores.home;
  match.awayScore = scores.away;
  match.status = 'finished';
  match.lastSyncedAt = new Date();
  await match.save();

  await recalculateMatchScores(match._id);

  state.liveMatchId = null;
  state.finishedCount += 1;

  if (match.type === 'final') {
    state.phase = 'completed';
    state.currentKnockoutRound = null;
  } else if (match.type === 'third_place') {
    state.currentKnockoutRound = 'final';
  }

  await state.save();

  const users = await User.find({ _id: { $in: state.userIds } });
  await maybeAdvanceTournament(state, users, state.runId);

  notifyMatchesUpdated({
    reason: 'simulation_finished',
    matchId: match._id.toString(),
  });
  notifyLeaderboardUpdated({
    reason: 'simulation_finished',
    matchId: match._id.toString(),
  });

  return getSimulationStatus();
}

export async function resetSimulation() {
  await cleanupSimulation();
  notifyLeaderboardUpdated({ reason: 'simulation_reset' });
  return { active: false, reset: true };
}
