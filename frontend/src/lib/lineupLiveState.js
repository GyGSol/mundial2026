import { normalizePlayerNameForMatch } from '@/lib/matchTimelineDisplay.js';

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
  if (!targetKey) return -1;

  return players.findIndex((player) => playerKeyFromLineupPlayer(player, side) === targetKey);
}

/**
 * Aplica sustituciones al XI mostrado: sale el titular, entra el suplente en su posición táctica.
 */
export function applySubstitutionsToLineup(lineupSide, substitutionsForSide = [], side = 'home') {
  const players = [...(lineupSide?.players ?? [])];
  if (!players.length || !substitutionsForSide.length) {
    return { ...lineupSide, players };
  }

  for (const sub of substitutionsForSide) {
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
    const incoming = {
      playerId: sub.playerInMongoId ?? sub.playerInExternalId ?? `sub-in-${sub.minute}`,
      mongoId: sub.playerInMongoId ?? null,
      externalId: sub.playerInExternalId ?? null,
      idPlayer: sub.idPlayerIn ?? null,
      name: sub.playerIn ?? sub.player ?? 'Suplente',
      shirtNumber: sub.playerInShirtNumber ?? null,
      photoUrl: sub.playerInPhotoUrl ?? null,
      position: sub.playerInPosition ?? outPlayer?.position ?? 'MID',
      gridX: outPlayer?.gridX ?? 50,
      gridY: outPlayer?.gridY ?? 50,
      subbedIn: true,
      subMinute: sub.minute ?? null,
    };

    if (outIndex >= 0) {
      players.splice(outIndex, 1, incoming);
    } else {
      players.push(incoming);
    }
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
