import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(__dirname, '../data/worldCupHistory.json');

let cachedHistory = null;
let cachedHistoryMtime = null;

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadHistoryFile() {
  const stat = await import('fs/promises').then((fs) => fs.stat(HISTORY_PATH));
  if (cachedHistory && cachedHistoryMtime === stat.mtimeMs) {
    return cachedHistory;
  }
  const raw = await readFile(HISTORY_PATH, 'utf8');
  cachedHistory = JSON.parse(raw);
  cachedHistoryMtime = stat.mtimeMs;
  return cachedHistory;
}

export async function getWorldCupHistory() {
  return loadHistoryFile();
}

/**
 * Goleadores históricos de la Copa del Mundo que están en planteles 2026.
 */
export async function matchHistoryScorersToSquadPlayers(allTimeTopScorers) {
  const players = await Player.find().lean();
  const byName = new Map();
  for (const player of players) {
    byName.set(normalizeName(player.fullName), player);
  }

  return allTimeTopScorers
    .map((scorer) => {
      const match = byName.get(normalizeName(scorer.playerName));
      if (!match) return null;
      return {
        playerId: match._id.toString(),
        externalId: match.externalId,
        fullName: match.fullName,
        fifaCode: match.fifaCode,
        careerWorldCupGoals: scorer.goals,
        careerRank: scorer.rank,
        careerTournaments: scorer.tournaments ?? [],
      };
    })
    .filter(Boolean);
}

/**
 * Estadísticas del torneo 2026 por jugador convocado (goles en partidos del Mundial).
 * Por ahora solo goles; asistencias cuando la API los exponga en match.raw.
 */
export async function buildWorldCup2026PlayerStats() {
  const [players, teams, finishedMatches] = await Promise.all([
    Player.find().lean(),
    Team.find().lean(),
    Match.find({ status: 'finished' }).lean(),
  ]);

  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));
  const statsByPlayerId = new Map(
    players.map((p) => [
      p._id.toString(),
      {
        playerId: p._id.toString(),
        externalId: p.externalId,
        fullName: p.fullName,
        fifaCode: p.fifaCode,
        teamName: teamMap[p.teamExternalId]?.nameEn ?? '',
        flag: teamMap[p.teamExternalId]?.flag ?? '',
        goals: 0,
        assists: 0,
        matchesPlayed: 0,
      },
    ])
  );

  for (const match of finishedMatches) {
    const raw = match.raw ?? {};
    const events =
      raw.events ??
      raw.goal_scorers ??
      raw.goalScorers ??
      raw.scorers ??
      raw.lineups?.events ??
      [];

    if (!Array.isArray(events) || events.length === 0) continue;

    for (const event of events) {
      const type = String(event.type ?? event.event ?? '').toLowerCase();
      if (type && !type.includes('goal')) continue;

      const playerName = event.player ?? event.player_name ?? event.scorer ?? event.name;
      if (!playerName) continue;

      const normalized = normalizeName(playerName);
      const player = players.find((p) => normalizeName(p.fullName) === normalized);
      if (!player) continue;

      const row = statsByPlayerId.get(player._id.toString());
      if (!row) continue;
      row.goals += 1;
    }
  }

  const leaders = [...statsByPlayerId.values()]
    .filter((row) => row.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.fullName.localeCompare(b.fullName));

  return {
    totalPlayers: players.length,
    leaders,
    note:
      leaders.length === 0
        ? 'Los goleadores del Mundial 2026 se actualizarán cuando haya partidos finalizados con datos de goleadores.'
        : null,
  };
}

export async function buildWorldCupHistoryOverview() {
  const history = await getWorldCupHistory();
  const [squadLegends, tournament2026] = await Promise.all([
    matchHistoryScorersToSquadPlayers(history.allTimeTopScorers ?? []),
    buildWorldCup2026PlayerStats(),
  ]);

  return {
    ...history,
    squadLegends,
    tournament2026PlayerStats: tournament2026,
  };
}
