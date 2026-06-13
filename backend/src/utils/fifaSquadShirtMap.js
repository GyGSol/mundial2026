import { buildFifaTimelineEntry } from '../services/fifaTimelineParser.js';

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

/** @param {Record<string, unknown>} liveJson */
export function buildShirtByPlayerId(liveJson) {
  /** @type {Record<string, number>} */
  const map = {};

  for (const side of ['HomeTeam', 'AwayTeam']) {
    for (const player of liveJson?.[side]?.Players ?? []) {
      const id = player?.IdPlayer;
      const shirt = player?.ShirtNumber;
      if (id == null || shirt == null || !Number.isFinite(Number(shirt))) continue;
      map[String(id)] = Number(shirt);
    }
  }

  return map;
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

/** @param {Array<Record<string, unknown>>} timeline @param {Record<string, number>} shirtByPlayerId */
export function applyShirtNumbersToTimeline(timeline, shirtByPlayerId = {}) {
  if (!Array.isArray(timeline) || timeline.length === 0) return timeline;
  if (!shirtByPlayerId || !Object.keys(shirtByPlayerId).length) return timeline;

  const shirtFor = (id) => {
    if (id == null) return null;
    const num = shirtByPlayerId[String(id)];
    return num != null && Number.isFinite(Number(num)) ? Number(num) : null;
  };

  return timeline.map((event) => {
    const next = { ...event };
    const main = shirtFor(event.idPlayer);
    const playerIn = shirtFor(event.idPlayerIn);
    const playerOut = shirtFor(event.idPlayerOut);

    if (main != null) next.playerShirtNumber = main;
    if (playerIn != null) next.playerInShirtNumber = playerIn;
    if (playerOut != null) next.playerOutShirtNumber = playerOut;

    return next;
  });
}
