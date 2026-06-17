import mongoose from 'mongoose';
import { PrizePool } from '../models/PrizePool.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { DEFAULT_PRIZE_SPLITS, computePrizeDistributionPercents } from '../config/economy.js';
import { getLeaderboard } from './leaderboardService.js';
import { getTreasury, getLiquidFubols } from './fubolService.js';
import { env } from '../config/env.js';

export async function getOrCreatePrizePool(groupId, session = null) {
  const oid =
    typeof groupId === 'string' ? new mongoose.Types.ObjectId(groupId) : groupId;

  let query = PrizePool.findOne({ groupId: oid });
  if (session) query = query.session(session);
  let pool = await query;

  if (pool) return pool;

  const createOpts = session ? { session } : undefined;
  const created = await PrizePool.create(
    [
      {
        groupId: oid,
        totalFubols: 0,
        distributionPercents: [...DEFAULT_PRIZE_SPLITS],
        status: 'open',
      },
    ],
    createOpts
  );
  return Array.isArray(created) ? created[0] : created;
}

export async function syncPrizePoolDistribution(groupId, winnersCount) {
  const percents = computePrizeDistributionPercents(winnersCount);
  const pool = await getOrCreatePrizePool(groupId);
  pool.distributionPercents = [...percents];
  await pool.save();
  return pool;
}

export async function projectPrizeDistribution(groupId) {
  const group = await CompetitionGroup.findById(groupId).select('prizesWinnersCount').lean();
  const winnersCount = group?.prizesWinnersCount ?? 0;
  const pool = await getOrCreatePrizePool(groupId);
  const expectedPercents = computePrizeDistributionPercents(winnersCount);

  if (winnersCount > 0) {
    const needsSync =
      pool.distributionPercents?.length !== expectedPercents.length ||
      expectedPercents.some((p, i) => pool.distributionPercents[i] !== p);
    if (needsSync) {
      pool.distributionPercents = [...expectedPercents];
      await pool.save();
    }
  }

  const percents =
    winnersCount > 0 && pool.distributionPercents?.length
      ? pool.distributionPercents
      : winnersCount > 0
        ? expectedPercents
        : [];
  const total = pool.totalFubols || 0;
  if (percents.length === 0) {
    return {
      groupId: String(groupId),
      totalFubols: total,
      status: pool.status,
      distributionPercents: [],
      distribution: [],
      houseRetention: 0,
    };
  }

  const leaderboard = await getLeaderboard(groupId, percents.length);

  let houseRetention = 0;
  const distribution = percents.map((percent, index) => {
    const rank = index + 1;
    const fubols = Math.floor((total * percent) / 100);
    const entry = leaderboard[index];

    if (entry?.isAiUser) {
      houseRetention += fubols;
      return {
        rank,
        userId: entry.id,
        name: entry.name,
        percent,
        fubols: 0,
        retainedByHouse: fubols,
        isAiUser: true,
      };
    }

    if (entry) {
      return {
        rank,
        userId: entry.id,
        name: entry.name,
        percent,
        fubols,
        retainedByHouse: 0,
        isAiUser: false,
      };
    }

    return {
      rank,
      userId: null,
      name: null,
      percent,
      fubols,
      retainedByHouse: 0,
      isAiUser: false,
    };
  });

  return {
    groupId: String(groupId),
    totalFubols: total,
    status: pool.status,
    distributionPercents: [...percents],
    distribution,
    houseRetention,
  };
}

/** Adjunta premios proyectados (top 3) a filas del ranking. */
export function attachProjectedFubolsToLeaderboard(leaderboard, projection) {
  if (!projection?.distribution?.length || !Array.isArray(leaderboard)) {
    return leaderboard;
  }

  const slotByUserId = new Map(
    projection.distribution
      .filter((slot) => slot.userId)
      .map((slot) => [String(slot.userId), slot])
  );

  return leaderboard.map((row) => {
    const slot = slotByUserId.get(String(row.id));
    if (!slot) return row;
    return {
      ...row,
      projectedFubols: slot.fubols,
      fubolsRetainedByHouse: slot.retainedByHouse || 0,
      prizePercent: slot.percent,
    };
  });
}

export async function findAiBankStatusForGroup(groupId) {
  const leaderboard = await getLeaderboard(groupId, 100);
  const aiEntry = leaderboard.find((row) => row.isAiUser);
  if (!aiEntry) {
    return { aiRank: null, aiName: null, custodiedFubols: 0 };
  }

  const projection = await projectPrizeDistribution(groupId);
  const aiSlot = projection.distribution.find((slot) => slot.isAiUser);
  const custodiedFubols = aiSlot?.retainedByHouse ?? 0;

  return {
    aiRank: aiEntry.rank,
    aiName: aiEntry.name,
    custodiedFubols,
  };
}

export async function getEconomyOverview() {
  const [treasury, liquidFubols, groups] = await Promise.all([
    getTreasury(),
    getLiquidFubols(),
    CompetitionGroup.find().sort({ name: 1 }).lean(),
  ]);

  const groupSummaries = await Promise.all(
    groups.map(async (group) => {
      const groupId = group._id.toString();
      const [projection, bankStatus] = await Promise.all([
        projectPrizeDistribution(groupId),
        findAiBankStatusForGroup(groupId),
      ]);
      return {
        groupId,
        groupName: group.name,
        prizePoolTotal: projection.totalFubols,
        projection,
        bankStatus,
      };
    })
  );

  const aiEmail = env.aiUserEmail;
  let globalAiRank = null;
  let globalCustodied = 0;
  for (const summary of groupSummaries) {
    if (summary.bankStatus.aiRank != null) {
      globalAiRank = summary.bankStatus.aiRank;
      globalCustodied += summary.bankStatus.custodiedFubols;
    }
  }

  return {
    treasury: {
      houseBalanceFubols: treasury.houseBalanceFubols || 0,
      totalDepositedFubols: treasury.totalDepositedFubols || 0,
      totalWithdrawnFubols: treasury.totalWithdrawnFubols || 0,
      liquidFubols,
    },
    bankAlert: {
      aiEmail,
      aiRank: globalAiRank,
      custodiedFubols: globalCustodied,
      message:
        globalAiRank != null
          ? `Estado de la Banca: La IA ocupa el puesto ${globalAiRank}. Fondos en custodia: ${globalCustodied} Fubols.`
          : 'Estado de la Banca: La IA no figura en puestos premiados proyectados.',
    },
    groups: groupSummaries,
  };
}
