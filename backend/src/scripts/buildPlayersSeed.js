/**
 * Genera playersSeed.json con el máximo de datos disponibles:
 * 1) Football-Data.org (si FOOTBALL_DATA_API_TOKEN está configurado)
 * 2) Plantillas embebidas en embedSquads.js
 * 3) Mapeo a teamExternalId desde MongoDB (requiere npm run sync previo)
 */
import { writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Team } from '../models/Team.js';
import { EMBED_SQUADS } from '../data/embedSquads.js';
import { resolveFifaCode } from '../data/teamFifaAliases.js';
import {
  fetchTeamWithSquad,
  fetchWorldCupTeams,
  hasToken,
  mapFootballDataPosition,
} from '../services/footballDataApiClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../data/playersSeed.json');

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toSeedPlayer(entry, team) {
  const fifaCode = team.fifaCode || entry.fifaCode;
  return {
    externalId: entry.externalId || `${fifaCode}-${slugify(entry.fullName)}`,
    fullName: entry.fullName,
    fifaCode,
    teamExternalId: team.externalId,
    teamName: team.nameEn,
    position: entry.position || 'MID',
    currentClub: entry.currentClub || '',
    age: entry.age,
    shirtNumber: entry.shirtNumber,
    nationality: entry.nationality || fifaCode,
    healthStatus: entry.healthStatus || 'available',
    dataSources: { structural: entry.source || 'seed', injuries: '' },
  };
}

async function fetchFromFootballData(teamsByCode) {
  if (!hasToken()) return [];

  const players = [];
  const wcTeams = await fetchWorldCupTeams();
  const fdByTla = new Map(wcTeams.map((t) => [t.tla, t]));

  for (const [code, team] of teamsByCode) {
    const fdTeam = fdByTla.get(code);
    if (!fdTeam?.id) continue;

    try {
      const detail = await fetchTeamWithSquad(fdTeam.id);
      for (const person of detail.squad ?? []) {
        const fullName = person.name ?? '';
        players.push(
          toSeedPlayer(
            {
              externalId: person.id ? `fd-${person.id}` : undefined,
              fullName,
              position: mapFootballDataPosition(person.position),
              currentClub: person.nationality ?? '',
              age: person.dateOfBirth
                ? Math.floor(
                    (Date.now() - new Date(person.dateOfBirth).getTime()) /
                      (365.25 * 24 * 60 * 60 * 1000)
                  )
                : undefined,
              shirtNumber: person.shirtNumber,
              source: 'football-data.org',
            },
            team
          )
        );
      }
      console.log(`FD: ${code} → ${detail.squad?.length ?? 0} jugadores`);
    } catch (err) {
      console.warn(`FD skip ${code}:`, err.message);
    }
  }

  return players;
}

async function fetchFromWikipedia(teamsByCode) {
  const raw = await loadJson('wikipediaSquads.json');
  if (!raw?.teams?.length) return [];

  const players = [];
  for (const team of raw.teams) {
    const dbTeam = teamsByCode.get(team.fifaCode);
    if (!dbTeam) continue;
    for (const p of team.players) {
      players.push(
        toSeedPlayer(
          {
            fullName: p.fullName,
            position: p.position,
            currentClub: p.currentClub,
            age: p.age,
            shirtNumber: p.shirtNumber,
            isCaptain: p.isCaptain,
            source: 'wikipedia-squads',
            raw: { internationalCaps: p.caps, internationalGoals: p.goals },
          },
          dbTeam
        )
      );
    }
    console.log(`Wikipedia: ${team.fifaCode} → ${team.players.length} jugadores`);
  }
  return players;
}

function fetchFromEmbed(teamsByCode) {
  const players = [];
  for (const [rawCode, squad] of Object.entries(EMBED_SQUADS)) {
    const code = resolveFifaCode(rawCode);
    const team = teamsByCode.get(code);
    if (!team || !squad?.length) continue;
    for (const entry of squad) {
      players.push(toSeedPlayer({ ...entry, source: 'embed-squads' }, team));
    }
    console.log(`Embed: ${code} → ${squad.length} jugadores`);
  }
  return players;
}

async function main() {
  await connectDb();
  const teams = await Team.find().lean();
  const teamsByCode = new Map(
    teams.filter((t) => t.fifaCode).map((t) => [t.fifaCode.toUpperCase(), t])
  );

  if (!teamsByCode.size) {
    console.error('No hay equipos en MongoDB. Ejecutá npm run sync primero.');
    process.exit(1);
  }

  const [fdPlayers, wikiPlayers, embedPlayers] = await Promise.all([
    fetchFromFootballData(teamsByCode),
    fetchFromWikipedia(teamsByCode),
    Promise.resolve(fetchFromEmbed(teamsByCode)),
  ]);

  const byKey = new Map();
  for (const p of [...embedPlayers, ...fdPlayers, ...wikiPlayers]) {
    byKey.set(p.externalId, p);
  }

  const players = [...byKey.values()].sort((a, b) =>
    a.fifaCode.localeCompare(b.fifaCode) || a.fullName.localeCompare(b.fullName)
  );

  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sources: [
          'wikipediaSquads.json',
          'embedSquads.js',
          hasToken() ? 'football-data.org' : null,
        ].filter(Boolean),
        playerCount: players.length,
        players,
      },
      null,
      2
    )
  );

  console.log(`playersSeed.json escrito: ${players.length} jugadores → ${OUT_PATH}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
