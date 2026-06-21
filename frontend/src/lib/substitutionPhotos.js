import { normalizePlayerNameForMatch } from '@/lib/matchTimelineDisplay.js';

export function namesLikelyMatch(a, b) {
  const left = normalizePlayerNameForMatch(a);
  const right = normalizePlayerNameForMatch(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftLast = left.split(/\s+/).pop();
  const rightLast = right.split(/\s+/).pop();
  return Boolean(leftLast && rightLast && leftLast === rightLast);
}

function substitutionMatchKey({ minute, playerOut, playerIn, playerOutShirtNumber, playerInShirtNumber }) {
  return [
    minute ?? '',
    normalizePlayerNameForMatch(playerOut),
    normalizePlayerNameForMatch(playerIn),
    playerOutShirtNumber ?? '',
    playerInShirtNumber ?? '',
  ].join('|');
}

function findLineupPlayerPhoto(players, name, shirtNumber) {
  if (!players?.length) return null;

  if (name) {
    const byName = players.find((player) => namesLikelyMatch(player.name, name));
    if (byName?.photoUrl) return byName.photoUrl;
  }

  if (shirtNumber != null && name) {
    const byShirt = players.find((player) => Number(player.shirtNumber) === Number(shirtNumber));
    if (byShirt?.photoUrl && namesLikelyMatch(byShirt.name, name)) {
      return byShirt.photoUrl;
    }
  }

  return null;
}

function timelineSubstitutionMap(timeline = [], side) {
  const map = new Map();
  for (const event of timeline) {
    if (event?.type !== 'substitution' || event.side !== side) continue;
    if (!event.playerIn || !event.playerOut) continue;
    map.set(substitutionMatchKey(event), event);
  }
  return map;
}

function findTimelineSubstitution(sub, timelineByKey, timeline, side) {
  const exact = timelineByKey.get(substitutionMatchKey(sub));
  if (exact) return exact;

  return (
    timeline.find(
      (event) =>
        event?.type === 'substitution' &&
        event.side === side &&
        event.minute === sub.minute &&
        namesLikelyMatch(event.playerOut, sub.playerOut) &&
        namesLikelyMatch(event.playerIn, sub.playerIn)
    ) ?? null
  );
}

/**
 * Completa fotos e ids de sustituciones desde cronología enriquecida y alineación inicial.
 */
export function hydrateSubstitutions(substitutions = [], timeline = [], lineupSide = null, side = 'home') {
  const timelineByKey = timelineSubstitutionMap(timeline, side);
  const lineupPlayers = lineupSide?.players ?? [];

  return (substitutions ?? []).map((sub) => {
    const event = findTimelineSubstitution(sub, timelineByKey, timeline, side);
    const playerOutPhotoUrl =
      sub.playerOutPhotoUrl ??
      event?.playerOutPhotoUrl ??
      findLineupPlayerPhoto(lineupPlayers, sub.playerOut, sub.playerOutShirtNumber) ??
      null;
    const playerInPhotoUrl =
      sub.playerInPhotoUrl ??
      event?.playerInPhotoUrl ??
      findLineupPlayerPhoto(lineupPlayers, sub.playerIn, sub.playerInShirtNumber) ??
      null;

    return {
      ...sub,
      playerOut: event?.playerOut ?? sub.playerOut,
      playerIn: event?.playerIn ?? sub.playerIn,
      playerOutPhotoUrl,
      playerInPhotoUrl,
      playerOutMongoId: sub.playerOutMongoId ?? event?.playerOutMongoId ?? null,
      playerInMongoId: sub.playerInMongoId ?? event?.playerInMongoId ?? null,
      playerOutExternalId: sub.playerOutExternalId ?? event?.playerOutExternalId ?? null,
      playerInExternalId: sub.playerInExternalId ?? event?.playerInExternalId ?? null,
      playerOutPosition: sub.playerOutPosition ?? event?.playerOutPosition ?? null,
      playerInPosition: sub.playerInPosition ?? event?.playerInPosition ?? null,
    };
  });
}

/** Extrae sustituciones de la cronología cuando el match no trae listas enriquecidas. */
export function substitutionsFromTimeline(timeline = [], side = 'home') {
  return (timeline ?? [])
    .filter(
      (event) =>
        event?.type === 'substitution' &&
        event.side === side &&
        event.playerIn &&
        event.playerOut
    )
    .map((event) => ({
      minute: event.minute ?? null,
      playerOut: String(event.playerOut).trim(),
      playerIn: String(event.playerIn).trim(),
      playerOutPosition: event.playerOutPosition ?? null,
      playerInPosition: event.playerInPosition ?? null,
      playerOutShirtNumber: event.playerOutShirtNumber ?? null,
      playerInShirtNumber: event.playerInShirtNumber ?? null,
      playerOutPositionX: event.playerOutPositionX ?? event.positionX ?? null,
      playerOutPositionY: event.playerOutPositionY ?? event.positionY ?? null,
      playerInPositionX: event.playerInPositionX ?? event.positionX ?? null,
      playerInPositionY: event.playerInPositionY ?? event.positionY ?? null,
      playerOutPhotoUrl: event.playerOutPhotoUrl ?? null,
      playerInPhotoUrl: event.playerInPhotoUrl ?? null,
      playerOutMongoId: event.playerOutMongoId ?? null,
      playerInMongoId: event.playerInMongoId ?? null,
      playerOutExternalId: event.playerOutExternalId ?? null,
      playerInExternalId: event.playerInExternalId ?? null,
      idPlayerOut: event.idPlayerOut ?? null,
      idPlayerIn: event.idPlayerIn ?? null,
    }));
}

export function resolveSubstitutionsForSide({
  substitutions = [],
  timeline = [],
  lineupSide = null,
  side = 'home',
} = {}) {
  const source = substitutions?.length
    ? substitutions
    : substitutionsFromTimeline(timeline, side);
  return hydrateSubstitutions(source, timeline, lineupSide, side);
}

export function shortPlayerName(fullName) {
  const parts = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1];
}
