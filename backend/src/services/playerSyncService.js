import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { SyncMeta } from '../models/SyncMeta.js';
import {
  fetchTeamWithSquad,
  fetchWorldCupTeams,
  hasToken,
  normalizeFootballDataPerson,
} from './footballDataApiClient.js';
import { notifyPlayersUpdated } from './websocketService.js';
import { resolveFifaCode } from '../data/teamFifaAliases.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');

async function loadJson(filename) {
  try {
    const raw = await readFile(join(DATA_DIR, filename), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeSeedPlayer(entry, team) {
  const fifaCode = entry.fifaCode || team?.fifaCode || '';
  const externalId =
    entry.externalId ||
    `${fifaCode}-${slugify(entry.fullName)}` ||
    `${team?.externalId}-${slugify(entry.fullName)}`;

  return {
    externalId,
    footballDataPersonId: entry.footballDataPersonId,
    fullName: entry.fullName,
    teamExternalId: entry.teamExternalId || team?.externalId || '',
    fifaCode,
    position: entry.position || 'MID',
    currentClub: entry.currentClub || '',
    age: entry.age,
    shirtNumber: entry.shirtNumber,
    nationality: entry.nationality || fifaCode,
    healthStatus: entry.healthStatus || 'available',
    injuryInfo: entry.injuryInfo || '',
    dataSources: {
      structural: entry.dataSources?.structural || 'seed',
      injuries: entry.dataSources?.injuries || '',
    },
    raw: entry.raw,
  };
}

async function upsertPlayer(doc) {
  const { externalId, ...rest } = doc;
  await Player.findOneAndUpdate(
    { externalId },
    { $set: { ...rest, externalId } },
    { upsert: true, new: true }
  );
}

async function syncFootballDataTeamMap() {
  if (!hasToken()) return 0;

  const wcTeams = await fetchWorldCupTeams();
  let mapped = 0;

  for (const wcTeam of wcTeams) {
    const tla = wcTeam.tla || wcTeam.shortName;
    const team = await Team.findOne({
      $or: [{ fifaCode: tla }, { nameEn: new RegExp(`^${wcTeam.name}$`, 'i') }],
    });

    if (team && wcTeam.id) {
      await Team.findByIdAndUpdate(team._id, {
        $set: { footballDataTeamId: Number(wcTeam.id) },
      });
      mapped += 1;
    }
  }

  return mapped;
}

async function syncSquadsFromFootballData() {
  if (!hasToken()) return 0;

  const teams = await Team.find({ footballDataTeamId: { $exists: true, $ne: null } }).lean();
  let count = 0;

  for (const team of teams) {
    try {
      const detail = await fetchTeamWithSquad(team.footballDataTeamId);
      const squad = detail?.squad ?? [];
      for (const person of squad) {
        const doc = normalizeFootballDataPerson(person, {
          externalId: team.externalId,
          fifaCode: team.fifaCode,
        });
        await upsertPlayer(doc);
        count += 1;
      }
    } catch (err) {
      console.warn(`FD squad skip ${team.nameEn}:`, err.message);
    }
  }

  return count;
}

async function syncFromSeed() {
  const seed = await loadJson('playersSeed.json');
  if (!seed?.players?.length) return 0;

  const teams = await Team.find().lean();
  const teamByCode = new Map();
  for (const t of teams) {
    if (t.fifaCode) teamByCode.set(t.fifaCode.toUpperCase(), t);
  }
  const teamByExternal = new Map(teams.map((t) => [t.externalId, t]));

  let count = 0;
  for (const entry of seed.players) {
    const code = resolveFifaCode(entry.fifaCode);
    const team =
      teamByCode.get(code) ||
      teamByExternal.get(entry.teamExternalId) ||
      teams.find((t) => t.nameEn === entry.teamName);
    const doc = normalizeSeedPlayer({ ...entry, fifaCode: code }, team);
    if (!doc.teamExternalId) continue;
    await upsertPlayer(doc);
    count += 1;
  }

  return count;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function mergeInjuriesSeed() {
  const injuries = await loadJson('playerInjuriesSeed.json');
  if (!injuries?.entries?.length) return 0;

  let count = 0;
  for (const entry of injuries.entries) {
    const code = resolveFifaCode(entry.fifaCode);
    let filter = null;

    if (entry.externalId) {
      filter = { externalId: entry.externalId };
    } else if (entry.fullName && code) {
      filter = {
        fifaCode: code,
        fullName: new RegExp(`^${escapeRegex(entry.fullName)}$`, 'i'),
      };
    }

    if (!filter) continue;

    const update = {
      healthStatus: entry.healthStatus || 'injured',
      injuryInfo: entry.injuryInfo || '',
      'dataSources.injuries': 'transfermarkt',
    };
    if (entry.position) update.position = entry.position;
    if (entry.currentClub) update.currentClub = entry.currentClub;

    const result = await Player.updateOne(filter, { $set: update });
    if (result.matchedCount > 0) count += 1;
  }

  return count;
}

export async function runPlayerSync() {
  let fdMapped = 0;
  let fdPlayers = 0;
  let seedPlayers = 0;
  let injuriesMerged = 0;
  let error = null;

  try {
    if (hasToken()) {
      fdMapped = await syncFootballDataTeamMap();
      fdPlayers = await syncSquadsFromFootballData();
    }

    if (fdPlayers === 0) {
      seedPlayers = await syncFromSeed();
    } else {
      seedPlayers = await syncFromSeed();
    }

    injuriesMerged = await mergeInjuriesSeed();

    const playerCount = await Player.countDocuments();

    await SyncMeta.findOneAndUpdate(
      { key: 'players' },
      {
        lastSyncAt: new Date(),
        lastSyncError: null,
        playerCount,
        fdMapped,
        fdPlayers,
        seedPlayers,
        injuriesMerged,
      },
      { upsert: true }
    );

    notifyPlayersUpdated({ playerCount, fdPlayers, seedPlayers });

    console.log(
      `Player sync OK: ${playerCount} total (FD squads: ${fdPlayers}, seed: ${seedPlayers}, injuries: ${injuriesMerged})`
    );

    return { playerCount, fdMapped, fdPlayers, seedPlayers, injuriesMerged };
  } catch (err) {
    error = err.message;
    await SyncMeta.findOneAndUpdate(
      { key: 'players' },
      { lastSyncError: error },
      { upsert: true }
    );
    throw err;
  }
}

export async function getPlayerSyncMeta() {
  const meta = await SyncMeta.findOne({ key: 'players' });
  return {
    lastSyncAt: meta?.lastSyncAt ?? null,
    lastSyncError: meta?.lastSyncError ?? null,
    playerCount: meta?.playerCount ?? 0,
  };
}
