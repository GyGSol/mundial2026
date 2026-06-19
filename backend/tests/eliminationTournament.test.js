import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { TournamentEnrollment } from '../src/models/TournamentEnrollment.js';
import { EliminationTournament } from '../src/models/EliminationTournament.js';
import { FubolTransaction } from '../src/models/FubolTransaction.js';
import { TOURNAMENT_TYPE_ELIMINATION } from '../src/constants/tournamentTypes.js';
import { ELIMINATION_TOURNAMENT_PRIZE_FUBOLS, computeEliminationEntryFee } from '../src/config/economy.js';
import { joinCompetitionGroup } from '../src/services/competitionGroupService.js';
import {
  activateTournament,
  startTournament,
  processEliminationForGroup,
  getEliminationDashboard,
} from '../src/services/eliminationTournamentService.js';
import { enrollUser } from '../src/services/tournamentEnrollmentService.js';
import { creditUser } from '../src/services/fubolService.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();

async function connectTestDb() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
}

async function createFundedUser(label) {
  const user = await User.create({
    name: label,
    email: `elim-${label}-${Date.now()}-${Math.random()}@test.local`,
    passwordHash: 'hash',
    balanceFubols: 0,
  });
  await creditUser({
    userId: user._id,
    amount: 500,
    type: 'deposit',
    idempotencyKey: `elim-setup-${user._id}`,
    skipTreasuryDeposit: true,
  });
  return user;
}

describe('eliminationTournamentService', () => {
  const cleanup = {
    groupIds: [],
    userIds: [],
    matchIds: [],
  };

  beforeAll(connectTestDb);

  afterEach(async () => {
    if (cleanup.groupIds.length) {
      await EliminationTournament.deleteMany({ groupId: { $in: cleanup.groupIds } });
      await TournamentEnrollment.deleteMany({ groupId: { $in: cleanup.groupIds } });
      await UserGroupMembership.deleteMany({ groupId: { $in: cleanup.groupIds } });
      await CompetitionGroup.deleteMany({ _id: { $in: cleanup.groupIds } });
    }
    if (cleanup.matchIds.length) {
      await Prediction.deleteMany({ matchId: { $in: cleanup.matchIds } });
      await Match.deleteMany({ _id: { $in: cleanup.matchIds } });
    }
    if (cleanup.userIds.length) {
      await FubolTransaction.deleteMany({ userId: { $in: cleanup.userIds } });
      await User.deleteMany({ _id: { $in: cleanup.userIds } });
    }
    cleanup.groupIds = [];
    cleanup.userIds = [];
    cleanup.matchIds = [];
  });

  async function setupGroupWithAdmin() {
    const admin = await createFundedUser('admin');
    cleanup.userIds.push(admin._id);

    const groupDoc = await CompetitionGroup.create({
      name: `Elim ${Date.now()}-${Math.random()}`,
      createdBy: admin._id,
    });
    const groupId = groupDoc._id;
    cleanup.groupIds.push(groupId);

    await UserGroupMembership.create({ userId: admin._id, groupId, role: 'owner' });

    const memberCount = await UserGroupMembership.countDocuments({ groupId });
    return { admin, groupId: groupId.toString(), memberCount };
  }

  it('activar inscribe admin y cobra cuota elimination', async () => {
    const { admin, groupId, memberCount } = await setupGroupWithAdmin();
    const fee = computeEliminationEntryFee(memberCount);

    const dashboard = await activateTournament(groupId, admin._id.toString());
    expect(dashboard.tournament.status).toBe('open');
    expect(dashboard.isEnrolled).toBe(true);

    const enrollment = await TournamentEnrollment.findOne({
      groupId,
      userId: admin._id,
      tournamentType: TOURNAMENT_TYPE_ELIMINATION,
    }).lean();
    expect(enrollment).toBeTruthy();
    expect(enrollment.entryFeeFubols).toBe(fee);

    const tx = await FubolTransaction.findOne({
      userId: admin._id,
      type: 'elimination_entry_fee',
    }).lean();
    expect(tx?.amount).toBe(-fee);

    const tournament = await EliminationTournament.findOne({ groupId }).lean();
    expect(tournament.eliminationPoolFubols).toBe(fee);
  });

  it('start rechaza no-admin y menos de 2 inscriptos', async () => {
    const { admin, groupId } = await setupGroupWithAdmin();
    const outsider = await createFundedUser('outsider');
    cleanup.userIds.push(outsider._id);

    await activateTournament(groupId, admin._id.toString());

    await expect(startTournament(groupId, outsider._id.toString())).rejects.toMatchObject({
      status: 403,
    });

    await expect(startTournament(groupId, admin._id.toString())).rejects.toMatchObject({
      message: expect.stringContaining('2 inscriptos'),
    });
  });

  it('procesa 3 jugadores en 2 partidos y paga 100 Fubols al campeón', async () => {
    const { admin, groupId, memberCount } = await setupGroupWithAdmin();
    const playerB = await createFundedUser('playerB');
    const playerC = await createFundedUser('playerC');
    cleanup.userIds.push(playerB._id, playerC._id);

    await joinCompetitionGroup({ userId: playerB._id, groupId });
    await joinCompetitionGroup({ userId: playerC._id, groupId });

    await activateTournament(groupId, admin._id.toString());
    await enrollUser(playerB._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);
    await enrollUser(playerC._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);

    const beforeStart = await startTournament(groupId, admin._id.toString());
    const startedAt = new Date(beforeStart.tournament.startedAt);

    const match1 = await Match.create({
      externalId: `elim-m1-${Date.now()}`,
      homeTeamId: 't1',
      awayTeamId: 't2',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      finishedAt: new Date(startedAt.getTime() + 60_000),
      kickoffAt: new Date(startedAt.getTime() + 30_000),
    });
    const match2 = await Match.create({
      externalId: `elim-m2-${Date.now()}`,
      homeTeamId: 't3',
      awayTeamId: 't4',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      finishedAt: new Date(startedAt.getTime() + 120_000),
      kickoffAt: new Date(startedAt.getTime() + 90_000),
    });
    cleanup.matchIds.push(match1._id, match2._id);

    await Prediction.create({
      userId: admin._id,
      matchId: match1._id,
      homeGoals: 2,
      awayGoals: 0,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });
    await Prediction.create({
      userId: playerB._id,
      matchId: match1._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 1,
      pointsBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
    });
    await Prediction.create({
      userId: playerC._id,
      matchId: match1._id,
      homeGoals: 0,
      awayGoals: 1,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });

    await Prediction.create({
      userId: admin._id,
      matchId: match2._id,
      homeGoals: 1,
      awayGoals: 1,
      pointsEarned: 4,
      pointsBreakdown: { winner: 1, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });
    await Prediction.create({
      userId: playerB._id,
      matchId: match2._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });

    await processEliminationForGroup(groupId);

    const tournament = await EliminationTournament.findOne({ groupId }).lean();
    expect(tournament.activePlayerIds).toHaveLength(1);
    expect(tournament.eliminated).toHaveLength(2);
    expect(tournament.eliminated[0].userId.toString()).toBe(playerC._id.toString());
    expect(tournament.eliminated[1].userId.toString()).toBe(playerB._id.toString());
    expect(tournament.status).toBe('completed');
    expect(tournament.championId.toString()).toBe(admin._id.toString());

    const championBalance = await User.findById(admin._id).select('balanceFubols').lean();
    const fee = computeEliminationEntryFee(memberCount);
    const expectedBalance = 500 - fee + ELIMINATION_TOURNAMENT_PRIZE_FUBOLS;
    expect(championBalance.balanceFubols).toBe(expectedBalance);

    const prizeTx = await FubolTransaction.find({
      userId: admin._id,
      type: 'prize_payout',
    }).lean();
    expect(prizeTx.some((tx) => tx.amount === ELIMINATION_TOURNAMENT_PRIZE_FUBOLS)).toBe(true);

    await processEliminationForGroup(groupId);
    const prizeCount = await FubolTransaction.countDocuments({
      userId: admin._id,
      type: 'prize_payout',
      idempotencyKey: `elimination-prize:${groupId}`,
    });
    expect(prizeCount).toBe(1);
  });

  it('elimina jugador sin predicción (0 puntos)', async () => {
    const { admin, groupId } = await setupGroupWithAdmin();
    const playerB = await createFundedUser('nopredB');
    cleanup.userIds.push(playerB._id);
    await joinCompetitionGroup({ userId: playerB._id, groupId });

    await activateTournament(groupId, admin._id.toString());
    await enrollUser(playerB._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);

    const dashboard = await startTournament(groupId, admin._id.toString());
    const startedAt = new Date(dashboard.tournament.startedAt);

    const match = await Match.create({
      externalId: `elim-nopred-${Date.now()}`,
      homeTeamId: 't1',
      awayTeamId: 't2',
      homeScore: 1,
      awayScore: 0,
      status: 'finished',
      finishedAt: new Date(startedAt.getTime() + 60_000),
    });
    cleanup.matchIds.push(match._id);

    await Prediction.create({
      userId: admin._id,
      matchId: match._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 4,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
    });

    await processEliminationForGroup(groupId);
    const tournament = await EliminationTournament.findOne({ groupId }).lean();
    expect(tournament.eliminated[0].userId.toString()).toBe(playerB._id.toString());
  });

  it('no procesa partidos finalizados antes de startedAt', async () => {
    const { admin, groupId } = await setupGroupWithAdmin();
    const playerB = await createFundedUser('earlyB');
    cleanup.userIds.push(playerB._id);
    await joinCompetitionGroup({ userId: playerB._id, groupId });

    await activateTournament(groupId, admin._id.toString());
    await enrollUser(playerB._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);

    const earlyMatch = await Match.create({
      externalId: `elim-early-${Date.now()}`,
      homeTeamId: 't1',
      awayTeamId: 't2',
      homeScore: 3,
      awayScore: 0,
      status: 'finished',
      finishedAt: new Date(),
    });
    cleanup.matchIds.push(earlyMatch._id);

    await Prediction.create({
      userId: admin._id,
      matchId: earlyMatch._id,
      homeGoals: 0,
      awayGoals: 3,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });
    await Prediction.create({
      userId: playerB._id,
      matchId: earlyMatch._id,
      homeGoals: 3,
      awayGoals: 0,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });

    const dashboard = await startTournament(groupId, admin._id.toString());
    const tournament = await EliminationTournament.findOne({ groupId }).lean();

    expect(tournament.processedMatchIds).toHaveLength(0);
    expect(tournament.eliminated).toHaveLength(0);
    expect(tournament.activePlayerIds).toHaveLength(2);
    expect(dashboard.tournament.status).toBe('running');
  });

  it('desempata empate en último lugar con compareRankingEntries', async () => {
    const { admin, groupId } = await setupGroupWithAdmin();
    const lowPa = await createFundedUser('lowPa');
    const highPa = await createFundedUser('highPa');
    cleanup.userIds.push(lowPa._id, highPa._id);
    await joinCompetitionGroup({ userId: lowPa._id, groupId });
    await joinCompetitionGroup({ userId: highPa._id, groupId });

    await activateTournament(groupId, admin._id.toString());
    await enrollUser(lowPa._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);
    await enrollUser(highPa._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);

    const dashboard = await startTournament(groupId, admin._id.toString());
    const startedAt = new Date(dashboard.tournament.startedAt);

    const match = await Match.create({
      externalId: `elim-tie-${Date.now()}`,
      homeTeamId: 't1',
      awayTeamId: 't2',
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      finishedAt: new Date(startedAt.getTime() + 60_000),
    });
    cleanup.matchIds.push(match._id);

    await Prediction.create({
      userId: admin._id,
      matchId: match._id,
      homeGoals: 2,
      awayGoals: 1,
      pointsEarned: 10,
      pointsBreakdown: { winner: 3, homeGoals: 3, awayGoals: 3, totalGoals: 1 },
    });
    await Prediction.create({
      userId: lowPa._id,
      matchId: match._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });
    await Prediction.create({
      userId: highPa._id,
      matchId: match._id,
      homeGoals: 1,
      awayGoals: 1,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });

    await processEliminationForGroup(groupId);
    const tournament = await EliminationTournament.findOne({ groupId }).lean();
    expect(tournament.eliminated[0].userId.toString()).toBe(lowPa._id.toString());
    expect(tournament.activePlayerIds).toHaveLength(2);
  });

  it('elimina según puntos combinados de dos partidos con mismo kickoff', async () => {
    const { admin, groupId } = await setupGroupWithAdmin();
    const playerB = await createFundedUser('batchB');
    const playerC = await createFundedUser('batchC');
    cleanup.userIds.push(playerB._id, playerC._id);
    await joinCompetitionGroup({ userId: playerB._id, groupId });
    await joinCompetitionGroup({ userId: playerC._id, groupId });

    await activateTournament(groupId, admin._id.toString());
    await enrollUser(playerB._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);
    await enrollUser(playerC._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);

    const dashboard = await startTournament(groupId, admin._id.toString());
    const startedAt = new Date(dashboard.tournament.startedAt);
    const sharedKickoff = new Date(startedAt.getTime() + 60_000);

    const match1 = await Match.create({
      externalId: `elim-batch1-${Date.now()}`,
      homeTeamId: 't1',
      awayTeamId: 't2',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      finishedAt: new Date(startedAt.getTime() + 120_000),
      kickoffAt: sharedKickoff,
    });
    const match2 = await Match.create({
      externalId: `elim-batch2-${Date.now()}`,
      homeTeamId: 't3',
      awayTeamId: 't4',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      finishedAt: new Date(startedAt.getTime() + 130_000),
      kickoffAt: sharedKickoff,
    });
    cleanup.matchIds.push(match1._id, match2._id);

    await Prediction.create({
      userId: admin._id,
      matchId: match1._id,
      homeGoals: 2,
      awayGoals: 0,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });
    await Prediction.create({
      userId: admin._id,
      matchId: match2._id,
      homeGoals: 1,
      awayGoals: 1,
      pointsEarned: 4,
      pointsBreakdown: { winner: 1, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });
    await Prediction.create({
      userId: playerB._id,
      matchId: match1._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 1,
      pointsBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
    });
    await Prediction.create({
      userId: playerB._id,
      matchId: match2._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });
    await Prediction.create({
      userId: playerC._id,
      matchId: match1._id,
      homeGoals: 0,
      awayGoals: 1,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });
    await Prediction.create({
      userId: playerC._id,
      matchId: match2._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });

    await processEliminationForGroup(groupId);

    const tournament = await EliminationTournament.findOne({ groupId }).lean();
    expect(tournament.processedMatchIds).toHaveLength(2);
    expect(tournament.eliminated).toHaveLength(1);
    expect(tournament.eliminated[0].userId.toString()).toBe(playerC._id.toString());
    expect(tournament.activePlayerIds).toHaveLength(2);
  });

  it('no procesa un partido si otro del mismo kickoff sigue en juego', async () => {
    const { admin, groupId } = await setupGroupWithAdmin();
    const playerB = await createFundedUser('slotB');
    cleanup.userIds.push(playerB._id);
    await joinCompetitionGroup({ userId: playerB._id, groupId });

    await activateTournament(groupId, admin._id.toString());
    await enrollUser(playerB._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);

    const dashboard = await startTournament(groupId, admin._id.toString());
    const startedAt = new Date(dashboard.tournament.startedAt);
    const sharedKickoff = new Date(startedAt.getTime() + 60_000);

    const finished = await Match.create({
      externalId: `elim-slot-fin-${Date.now()}`,
      homeTeamId: 't1',
      awayTeamId: 't2',
      homeScore: 1,
      awayScore: 0,
      status: 'finished',
      finishedAt: new Date(startedAt.getTime() + 120_000),
      kickoffAt: sharedKickoff,
    });
    const live = await Match.create({
      externalId: `elim-slot-live-${Date.now()}`,
      homeTeamId: 't3',
      awayTeamId: 't4',
      homeScore: 0,
      awayScore: 0,
      status: 'live',
      kickoffAt: sharedKickoff,
    });
    cleanup.matchIds.push(finished._id, live._id);

    await Prediction.create({
      userId: admin._id,
      matchId: finished._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 4,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
    });

    await processEliminationForGroup(groupId);

    const tournament = await EliminationTournament.findOne({ groupId }).lean();
    expect(tournament.processedMatchIds).toHaveLength(0);
    expect(tournament.eliminated).toHaveLength(0);
  });

  it('dashboard running muestra próximo partido con puntos en cero ordenados por Gdif', async () => {
    const { admin, groupId } = await setupGroupWithAdmin();
    const playerB = await createFundedUser('previewB');
    cleanup.userIds.push(playerB._id);
    await joinCompetitionGroup({ userId: playerB._id, groupId });

    await activateTournament(groupId, admin._id.toString());
    await enrollUser(playerB._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);
    await startTournament(groupId, admin._id.toString());

    const kickoff = new Date(Date.now() + 86_400_000);
    const upcoming = await Match.create({
      externalId: `elim-upcoming-${Date.now()}`,
      homeTeamId: 't1',
      awayTeamId: 't2',
      status: 'upcoming',
      kickoffAt: kickoff,
    });
    cleanup.matchIds.push(upcoming._id);

    await Prediction.create({
      userId: admin._id,
      matchId: upcoming._id,
      homeGoals: 2,
      awayGoals: 1,
      goalDiffHome: 2,
      goalDiffAway: 1,
    });
    await Prediction.create({
      userId: playerB._id,
      matchId: upcoming._id,
      homeGoals: 1,
      awayGoals: 0,
      goalDiffHome: 1,
      goalDiffAway: 0,
    });

    const dash = await getEliminationDashboard(groupId, admin._id.toString());
    expect(dash.currentMatchTable.mode).toBe('preview');
    expect(dash.currentMatchTable.matches).toHaveLength(1);
    expect(dash.currentMatchTable.leaderboard.every((row) => row.totalPoints === 0)).toBe(true);
    expect(dash.currentMatchTable.leaderboard[0].name).toBe(playerB.name);
    expect(dash.currentMatchTable.leaderboard[1].name).toBe(admin.name);
  });
});
