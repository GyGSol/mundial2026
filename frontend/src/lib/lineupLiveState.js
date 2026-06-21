import { normalizePlayerNameForMatch, timelineEventIdentity } from '@/lib/matchTimelineDisplay.js';
import {
  assignPlayersToFormation,
  resolveFormation,
  resolvePlayerPool,
} from '@/lib/formationLayout.js';
import { namesLikelyMatch } from '@/lib/substitutionPhotos.js';

const MAX_XI = 11;

function playerKeyFromParts({ mongoId, externalId, idPlayer, shirtNumber, name, side }) {
  if (mongoId) return `mongo:${mongoId}`;
  if (externalId) return `ext:${externalId}`;
  if (idPlayer) return `fifa:${side}:${idPlayer}`;
  if (shirtNumber != null && side) return `shirt:${side}:${shirtNumber}`;
  const normalized = normalizePlayerNameForMatch(name);
  if (normalized && side) return `name:${side}:${normalized}`;
  return null;
}

export function playerKeyFromLineupPlayer(player, side) {
  return playerKeyFromParts({
    mongoId: player?.mongoId,
    externalId: player?.externalId,
    idPlayer: player?.fifaPlayerId ?? player?.idPlayer,
    shirtNumber: player?.shirtNumber,
    name: player?.name,
    side,
  });
}

export function playerKeyFromTimelineEvent(event, role = 'primary') {
  const side = event?.side;
  if (!side) return null;

  if (role === 'in') {
    return playerKeyFromParts({
      mongoId: event?.playerInMongoId,
      externalId: event?.playerInExternalId,
      idPlayer: event?.idPlayerIn,
      shirtNumber: event?.playerInShirtNumber,
      name: event?.playerIn,
      side,
    });
  }

  if (role === 'out') {
    return playerKeyFromParts({
      mongoId: event?.playerOutMongoId,
      externalId: event?.playerOutExternalId,
      idPlayer: event?.idPlayerOut,
      shirtNumber: event?.playerOutShirtNumber,
      name: event?.playerOut,
      side,
    });
  }

  return playerKeyFromParts({
    mongoId: event?.playerMongoId,
    externalId: event?.playerExternalId,
    idPlayer: event?.idPlayer,
    shirtNumber: event?.playerShirtNumber,
    name: event?.player,
    side,
  });
}

export function matchPlayerToTimeline(player, event, side) {
  const playerKey = playerKeyFromLineupPlayer(player, side);
  if (!playerKey) return false;

  const keys = [
    playerKeyFromTimelineEvent(event, 'primary'),
    playerKeyFromTimelineEvent(event, 'in'),
    playerKeyFromTimelineEvent(event, 'out'),
  ].filter(Boolean);

  return keys.includes(playerKey);
}

/** Resalta jugador en Normal cuando la clave viene del timeline (evento o jugador). */
export function playerMatchesPitchHighlight(player, side, highlightKey, timeline = []) {
  if (!highlightKey) return false;
  const playerKey = playerKeyFromLineupPlayer(player, side);
  if (playerKey && playerKey === highlightKey) return true;

  for (const event of timeline) {
    if (event?.side !== side) continue;
    if (timelineEventIdentity(event) !== highlightKey) continue;
    return matchPlayerToTimeline(player, event, side);
  }

  return false;
}

/** Resumen de eventos por jugador para badges en la cancha. */
export function buildPlayerEventSummary(timeline = [], side) {
  const summary = new Map();

  const bump = (key, patch) => {
    if (!key) return;
    const prev = summary.get(key) ?? {
      goals: 0,
      yellow: 0,
      red: 0,
      subOffMinute: null,
      subInMinute: null,
    };
    summary.set(key, { ...prev, ...patch });
  };

  for (const event of timeline) {
    if (event?.side !== side) continue;

    switch (event.type) {
      case 'goal': {
        const key = playerKeyFromTimelineEvent(event);
        const prev = summary.get(key) ?? { goals: 0 };
        bump(key, { goals: (prev.goals ?? 0) + 1 });
        break;
      }
      case 'yellow_card':
        bump(playerKeyFromTimelineEvent(event), { yellow: 1 });
        break;
      case 'red_card':
        bump(playerKeyFromTimelineEvent(event), { red: 1 });
        break;
      case 'substitution': {
        bump(playerKeyFromTimelineEvent(event, 'out'), {
          subOffMinute: event.minute ?? null,
        });
        bump(playerKeyFromTimelineEvent(event, 'in'), {
          subInMinute: event.minute ?? null,
        });
        break;
      }
      default:
        break;
    }
  }

  return summary;
}

function findPlayerIndex(players, subPlayer, side) {
  const targetKey = playerKeyFromParts({
    mongoId: subPlayer?.mongoId,
    externalId: subPlayer?.externalId,
    idPlayer: subPlayer?.idPlayer,
    shirtNumber: subPlayer?.shirtNumber,
    name: subPlayer?.name ?? subPlayer?.player,
    side,
  });
  if (targetKey) {
    const byKey = players.findIndex((player) => playerKeyFromLineupPlayer(player, side) === targetKey);
    if (byKey >= 0) return byKey;
  }

  const name = subPlayer?.name ?? subPlayer?.player;
  const shirtNumber = subPlayer?.shirtNumber;

  if (name) {
    const byName = players.findIndex((player) => namesLikelyMatch(player.name, name));
    if (byName >= 0) return byName;
  }

  if (shirtNumber != null) {
    return players.findIndex((player) => Number(player.shirtNumber) === Number(shirtNumber));
  }

  return -1;
}

function dedupeSubstitutions(substitutions = []) {
  const seen = new Set();
  return substitutions.filter((sub) => {
    const key = [
      sub.minute ?? '',
      normalizePlayerNameForMatch(sub.playerOut),
      normalizePlayerNameForMatch(sub.playerIn),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function playerWasSubbedOut(player, substitutions) {
  if (player?.subbedIn) return false;
  return substitutions.some((sub) => {
    if (
      sub.playerOutShirtNumber != null &&
      player.shirtNumber != null &&
      Number(sub.playerOutShirtNumber) !== Number(player.shirtNumber)
    ) {
      return false;
    }
    return namesLikelyMatch(player.name, sub.playerOut);
  });
}

function dedupeLineupPlayers(players, side) {
  const byKey = new Map();

  for (const player of players) {
    const key =
      playerKeyFromLineupPlayer(player, side) ??
      `fallback:${side}:${player.shirtNumber ?? ''}:${normalizePlayerNameForMatch(player.name)}`;

    const prev = byKey.get(key);
    if (!prev || (player.subbedIn && !prev.subbedIn)) {
      byKey.set(key, player);
    }
  }

  return [...byKey.values()];
}

function finalizeLiveXi(players, side, substitutions) {
  const withoutSubbedOut = players.filter((player) => !playerWasSubbedOut(player, substitutions));
  const unique = dedupeLineupPlayers(withoutSubbedOut, side);
  return unique.slice(0, MAX_XI);
}

function mergePlayerMeta(reassigned, original, side) {
  const byKey = new Map(
    original.map((player) => [playerKeyFromLineupPlayer(player, side), player])
  );

  return reassigned.map((player) => {
    const key = playerKeyFromLineupPlayer(player, side);
    const prev = key ? byKey.get(key) : null;
    if (!prev) return player;
    return {
      ...player,
      subbedIn: prev.subbedIn ?? player.subbedIn,
      subMinute: prev.subMinute ?? player.subMinute,
      photoUrl: prev.photoUrl ?? player.photoUrl,
      mongoId: prev.mongoId ?? player.mongoId,
      externalId: prev.externalId ?? player.externalId,
      idPlayer: prev.idPlayer ?? prev.fifaPlayerId ?? player.idPlayer,
    };
  });
}

function shouldRecalculateFormation(outPlayer, incomingPosition, incomingCoords) {
  if (!outPlayer) return true;

  const outPool = resolvePlayerPool(outPlayer);
  const inPool = resolvePlayerPool({
    position: incomingPosition,
    positionX: incomingCoords?.x,
    positionY: incomingCoords?.y,
  });

  return outPool !== inPool;
}

/**
 * Aplica sustituciones al XI mostrado. Si el suplente juega otra línea táctica,
 * recalcula la formación en cancha; si no, hereda el slot del titular que sale.
 */
export function applySubstitutionsToLineup(lineupSide, substitutionsForSide = [], side = 'home') {
  let players = [...(lineupSide?.players ?? [])];
  const substitutions = dedupeSubstitutions(substitutionsForSide);
  if (!players.length || !substitutions.length) {
    return { ...lineupSide, players };
  }

  let needsFormationRecalc = false;

  for (const sub of substitutions) {
    const outIndex = findPlayerIndex(
      players,
      {
        mongoId: sub.playerOutMongoId,
        externalId: sub.playerOutExternalId,
        idPlayer: sub.idPlayerOut,
        shirtNumber: sub.playerOutShirtNumber,
        name: sub.playerOut ?? sub.player,
      },
      side
    );

    const outPlayer = outIndex >= 0 ? players[outIndex] : null;
    const incomingPosition = sub.playerInPosition ?? outPlayer?.position ?? 'MID';

    const incoming = {
      playerId: sub.playerInMongoId ?? sub.playerInExternalId ?? `sub-in-${sub.minute}`,
      mongoId: sub.playerInMongoId ?? null,
      externalId: sub.playerInExternalId ?? null,
      idPlayer: sub.idPlayerIn ?? null,
      fifaPlayerId: sub.idPlayerIn ?? null,
      name: sub.playerIn ?? sub.player ?? 'Suplente',
      shirtNumber: sub.playerInShirtNumber ?? null,
      photoUrl: sub.playerInPhotoUrl ?? null,
      position: incomingPosition,
      positionDetail: sub.playerInPosition ?? incomingPosition,
      positionX: sub.playerInPositionX ?? null,
      positionY: sub.playerInPositionY ?? null,
      gridX: outPlayer?.gridX ?? 50,
      gridY: outPlayer?.gridY ?? 50,
      subbedIn: true,
      subMinute: sub.minute ?? null,
    };

    const recalc = shouldRecalculateFormation(outPlayer, incomingPosition, {
      x: sub.playerInPositionX,
      y: sub.playerInPositionY,
    });
    if (recalc) needsFormationRecalc = true;

    if (outIndex >= 0) {
      players.splice(outIndex, 1, incoming);
    } else {
      players.push(incoming);
    }
  }

  players = finalizeLiveXi(players, side, substitutions);

  if (needsFormationRecalc) {
    const tagged = players.map((player) => ({ ...player, side }));
    const formation = resolveFormation(tagged, lineupSide?.formation);
    const reassigned = assignPlayersToFormation(tagged, formation, {
      includeLeftovers: false,
    });
    players = finalizeLiveXi(mergePlayerMeta(reassigned, tagged, side), side, substitutions);
    return { ...lineupSide, formation, players };
  }

  return { ...lineupSide, players };
}

export function applyLiveSubstitutions(lineup, homeSubstitutions = [], awaySubstitutions = []) {
  if (!lineup) return lineup;
  return {
    ...lineup,
    home: applySubstitutionsToLineup(lineup.home, homeSubstitutions, 'home'),
    away: applySubstitutionsToLineup(lineup.away, awaySubstitutions, 'away'),
  };
}
