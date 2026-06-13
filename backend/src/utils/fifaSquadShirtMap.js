import { buildFifaTimelineEntry } from '../services/fifaTimelineParser.js';
import { normalizeName } from './playerNameMatch.js';

function timelineIdentityKey(event) {
  return [
    event.type,
    event.side ?? '',
    event.minute ?? '',
    event.extraMinute ?? '',
    event.player ?? '',
    event.playerIn ?? '',
    event.playerOut ?? '',
  ].join('|');
}

function localizedPlayerName(player) {
  return (
    player?.PlayerName?.find((item) => item.Locale === 'en-GB')?.Description ??
    player?.ShortName?.find((item) => item.Locale === 'en-GB')?.Description ??
    ''
  );
}

/** @param {Record<string, unknown>} liveJson */
export function buildShirtLookups(liveJson) {
  /** @type {Record<string, number>} */
  const shirtByPlayerId = {};
  /** @type {{ home: Record<string, number>, away: Record<string, number> }} */
  const shirtBySideName = { home: {}, away: {} };

  for (const [teamKey, side] of [
    ['HomeTeam', 'home'],
    ['AwayTeam', 'away'],
  ]) {
    for (const player of liveJson?.[teamKey]?.Players ?? []) {
      const id = player?.IdPlayer;
      const shirt = player?.ShirtNumber;
      if (id == null || shirt == null || !Number.isFinite(Number(shirt))) continue;

      const shirtNumber = Number(shirt);
      shirtByPlayerId[String(id)] = shirtNumber;

      const name = localizedPlayerName(player);
      const normalized = normalizeName(name);
      if (normalized) shirtBySideName[side][normalized] = shirtNumber;

      const lastName = normalized.split(/\s+/).pop();
      if (lastName && shirtBySideName[side][lastName] == null) {
        shirtBySideName[side][lastName] = shirtNumber;
      }
    }
  }

  return { shirtByPlayerId, shirtBySideName };
}

/** @param {Record<string, unknown>} liveJson */
export function buildShirtByPlayerId(liveJson) {
  return buildShirtLookups(liveJson).shirtByPlayerId;
}

function shirtForId(id, shirtByPlayerId = {}) {
  if (id == null) return null;
  const num = shirtByPlayerId[String(id)];
  return num != null && Number.isFinite(Number(num)) ? Number(num) : null;
}

function shirtForName(name, side, shirtBySideName = {}) {
  const sideMap = shirtBySideName?.[side];
  if (!name || !sideMap) return null;

  const normalized = normalizeName(name);
  if (sideMap[normalized] != null) return sideMap[normalized];

  const lastName = normalized.split(/\s+/).pop();
  if (lastName && sideMap[lastName] != null) return sideMap[lastName];

  for (const [key, num] of Object.entries(sideMap)) {
    if (key.includes(normalized) || normalized.includes(key)) return num;
  }

  return null;
}

/** @param {Array<Record<string, unknown>>} timeline */
export function attachTimelinePlayerIds(timeline, rawEvents, homeTeamId, awayTeamId) {
  if (!Array.isArray(timeline) || timeline.length === 0) return timeline;
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) return timeline;
  if (!homeTeamId || !awayTeamId) return timeline;

  const idsByKey = new Map();
  for (const rawEvent of rawEvents) {
    const entry = buildFifaTimelineEntry(rawEvent, homeTeamId, awayTeamId);
    if (!entry?.idPlayer && !entry?.idPlayerIn && !entry?.idPlayerOut) continue;
    idsByKey.set(timelineIdentityKey(entry), {
      idPlayer: entry.idPlayer ?? null,
      idPlayerIn: entry.idPlayerIn ?? null,
      idPlayerOut: entry.idPlayerOut ?? null,
    });
  }

  if (idsByKey.size === 0) return timeline;

  return timeline.map((event) => {
    if (event.idPlayer || event.idPlayerIn || event.idPlayerOut) return event;
    const ids = idsByKey.get(timelineIdentityKey(event));
    if (!ids) return event;
    return { ...event, ...ids };
  });
}

/**
 * @param {Array<Record<string, unknown>>} timeline
 * @param {{ shirtByPlayerId?: Record<string, number>, shirtBySideName?: { home?: Record<string, number>, away?: Record<string, number> } }} lookups
 */
export function applyShirtNumbersToTimeline(
  timeline,
  { shirtByPlayerId = {}, shirtBySideName = {} } = {}
) {
  if (!Array.isArray(timeline) || timeline.length === 0) return timeline;
  const hasIds = Object.keys(shirtByPlayerId).length > 0;
  const hasNames =
    Object.keys(shirtBySideName.home ?? {}).length > 0 ||
    Object.keys(shirtBySideName.away ?? {}).length > 0;
  if (!hasIds && !hasNames) return timeline;

  return timeline.map((event) => {
    const next = { ...event };
    const side = event.side;

    const main =
      shirtForId(event.idPlayer, shirtByPlayerId) ??
      shirtForName(event.player, side, shirtBySideName);
    const playerIn =
      shirtForId(event.idPlayerIn, shirtByPlayerId) ??
      shirtForName(event.playerIn, side, shirtBySideName);
    const playerOut =
      shirtForId(event.idPlayerOut, shirtByPlayerId) ??
      shirtForName(event.playerOut, side, shirtBySideName);

    if (main != null) next.playerShirtNumber = main;
    if (playerIn != null) next.playerInShirtNumber = playerIn;
    if (playerOut != null) next.playerOutShirtNumber = playerOut;

    return next;
  });
}
