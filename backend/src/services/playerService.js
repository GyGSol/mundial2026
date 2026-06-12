import { Player, POSITIONS, HEALTH_STATUSES } from '../models/Player.js';
import { Team } from '../models/Team.js';
import {
  fetchPersonMatches,
  hasToken,
} from './footballDataApiClient.js';
import { enrichClubFields } from './clubMetaService.js';

const POSITION_LABELS = {
  GK: 'Portero',
  DEF: 'Defensa',
  MID: 'Mediocampista',
  FWD: 'Delantero',
};

const HEALTH_LABELS = {
  available: 'Disponible',
  injured: 'Lesionado',
  doubt: 'Duda',
};

function serializePlayer(player, teamMap) {
  const team = teamMap.get(player.teamExternalId);
  const club = enrichClubFields(player);

  return {
    id: player._id.toString(),
    externalId: player.externalId,
    fullName: player.fullName,
    teamExternalId: player.teamExternalId,
    teamName: team?.nameEn ?? '',
    fifaCode: player.fifaCode || team?.fifaCode || '',
    flag: team?.flag ?? '',
    position: player.position,
    positionLabel: POSITION_LABELS[player.position] || player.position,
    currentClub: club.currentClub,
    clubCountry: club.clubCountry,
    clubCrestUrl: club.clubCrestUrl,
    leagueName: club.leagueName,
    leagueEmblemUrl: club.leagueEmblemUrl,
    age: player.age ?? null,
    shirtNumber: player.shirtNumber ?? null,
    healthStatus: player.healthStatus,
    healthLabel: HEALTH_LABELS[player.healthStatus] || player.healthStatus,
    injuryInfo: player.injuryInfo || '',
    lineupStatus: player.lineupStatus || null,
    isStarter: player.lineupStatus === 'starter',
    recentMatches: player.recentMatches ?? [],
  };
}

async function buildTeamMap() {
  const teams = await Team.find().lean();
  return new Map(teams.map((t) => [t.externalId, t]));
}

const STATUS_FILTERS = new Set(['priority', 'all', 'alert', ...HEALTH_STATUSES]);

function buildListPipeline(filter, { status, skip, limit }) {
  const pipeline = [{ $match: filter }];

  if (status === 'priority') {
    pipeline.push({
      $addFields: {
        healthSort: {
          $switch: {
            branches: [
              { case: { $eq: ['$healthStatus', 'injured'] }, then: 0 },
              { case: { $eq: ['$healthStatus', 'doubt'] }, then: 1 },
            ],
            default: 2,
          },
        },
        starterSort: {
          $cond: [{ $eq: ['$lineupStatus', 'starter'] }, 0, 1],
        },
      },
    });
    pipeline.push({ $sort: { healthSort: 1, starterSort: 1, fullName: 1 } });
  } else {
    pipeline.push({ $sort: { fullName: 1 } });
  }

  pipeline.push({ $skip: skip }, { $limit: limit });
  return pipeline;
}

export async function listPlayers({
  page = 1,
  limit = 24,
  team = '',
  position = '',
  status = 'priority',
  q = '',
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const safeStatus = STATUS_FILTERS.has(status) ? status : 'priority';
  const filter = {};

  if (team) {
    const teams = await Team.find({
      $or: [{ fifaCode: team.toUpperCase() }, { externalId: team }],
    }).lean();
    const ids = teams.map((t) => t.externalId);
    if (ids.length) filter.teamExternalId = { $in: ids };
    else filter.fifaCode = team.toUpperCase();
  }

  if (position && POSITIONS.includes(position)) {
    filter.position = position;
  }

  if (safeStatus === 'alert') {
    filter.healthStatus = { $in: ['injured', 'doubt'] };
  } else if (HEALTH_STATUSES.includes(safeStatus)) {
    filter.healthStatus = safeStatus;
  }

  const trimmed = String(q).trim();
  if (trimmed) {
    filter.fullName = { $regex: trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const skip = (safePage - 1) * safeLimit;
  const pipeline = buildListPipeline(filter, { status: safeStatus, skip, limit: safeLimit });

  const [items, total] = await Promise.all([
    Player.aggregate(pipeline),
    Player.countDocuments(filter),
  ]);

  const teamMap = await buildTeamMap();

  return {
    players: items.map((p) => serializePlayer(p, teamMap)),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    status: safeStatus,
  };
}

export async function getPlayerById(id, { skipExternalMatches = false } = {}) {
  const player = await Player.findById(id).lean();
  if (!player) return null;

  if (
    !skipExternalMatches &&
    hasToken() &&
    player.footballDataPersonId &&
    (!player.recentMatches || player.recentMatches.length === 0)
  ) {
    try {
      const recentMatches = await fetchPersonMatches(player.footballDataPersonId);
      if (recentMatches.length) {
        await Player.findByIdAndUpdate(player._id, { $set: { recentMatches } });
        player.recentMatches = recentMatches;
      }
    } catch (err) {
      console.warn(`Person matches skip ${player.externalId}:`, err.message);
    }
  }

  const teamMap = await buildTeamMap();
  return serializePlayer(player, teamMap);
}
