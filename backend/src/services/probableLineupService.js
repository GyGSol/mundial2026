import { Player, POSITIONS } from '../models/Player.js';
import {
  assignFormationGrid,
  mapFootballDataPositionText,
  assignPlayersToFormation,
} from '../utils/formationLayout.js';
import { MIN_CONFIRMED_STARTERS_PER_TEAM } from './aiLineupContextService.js';

export const MAX_STARTERS = 11;
export const LINE_ORDER = ['GK', 'DEF', 'MID', 'FWD'];
export const STARTER_SLOTS = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
export const DEFAULT_PROBABLE_FORMATION = '4-3-3';

export function starterPriority(player) {
  if (player.lineupStatus === 'starter') return 0;
  if (player.isStarter === true) return 1;
  if (player.isStarter === false) return 4;
  const num = Number(player.shirtNumber);
  if (Number.isFinite(num) && num >= 1 && num <= 11) return 2;
  return 3;
}

/** Heurística 1-4-3-3: prioriza titulares confirmados, dorsales 1–11 y salud. */
export function pickProbableStarters(players) {
  const available = players.filter(
    (p) => p.healthStatus !== 'injured' && !p.suspended
  );
  const byPosition = Object.fromEntries(POSITIONS.map((p) => [p, []]));
  for (const player of available) {
    if (player.position && byPosition[player.position]) {
      byPosition[player.position].push(player);
    }
  }

  const picked = [];
  for (const pos of LINE_ORDER) {
    const slots = STARTER_SLOTS[pos] ?? 1;
    const sorted = [...byPosition[pos]].sort((a, b) => {
      const diff = starterPriority(a) - starterPriority(b);
      if (diff !== 0) return diff;
      const aNum = Number(a.shirtNumber) || 99;
      const bNum = Number(b.shirtNumber) || 99;
      return aNum - bNum;
    });
    for (const player of sorted.slice(0, slots)) {
      picked.push(player);
    }
  }

  return picked.slice(0, MAX_STARTERS);
}

function serializeProbablePlayer(player) {
  return {
    playerId: player.externalId ?? null,
    name: player.fullName,
    shirtNumber: player.shirtNumber ?? null,
    position: player.position ?? 'MID',
    isStarter: true,
  };
}

export async function buildProbableSide(teamExternalId, formation = DEFAULT_PROBABLE_FORMATION) {
  if (!teamExternalId) {
    return { formation, players: [], coach: null };
  }

  const roster = await Player.find({ teamExternalId }).lean();
  const starters = pickProbableStarters(roster);
  const players = assignPlayersToFormation(
    starters.map(serializeProbablePlayer),
    formation
  );

  return { formation, players, coach: null };
}

export function isConfirmedSnapshot(snapshot) {
  const homeCount = snapshot?.home?.players?.length ?? 0;
  const awayCount = snapshot?.away?.players?.length ?? 0;
  return (
    homeCount >= MIN_CONFIRMED_STARTERS_PER_TEAM &&
    awayCount >= MIN_CONFIRMED_STARTERS_PER_TEAM
  );
}

export function serializeFdLineupPlayer(entry) {
  return {
    playerId: entry.id ? `fd-${entry.id}` : null,
    footballDataPersonId: entry.id ? Number(entry.id) : null,
    name: entry.name ?? '',
    shirtNumber: entry.shirtNumber ?? null,
    position: mapFootballDataPositionText(entry.position),
    positionDetail: entry.position ?? null,
    isStarter: true,
  };
}
