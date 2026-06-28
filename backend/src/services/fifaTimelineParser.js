/** @typedef {'goal' | 'penalty_shootout_kick' | 'yellow_card' | 'red_card' | 'substitution' | 'foul' | 'shot_attempt' | 'goal_disallowed' | 'yellow_card_reassigned' | 'var_decision' | 'hydration_break' | 'period_start' | 'period_end' | 'match_end'} TimelineEventType */

import {
  isFifaShootoutPeriod,
  isInGamePenaltyDescription,
  isShootoutKickDescription,
} from './penaltyShootoutService.js';

export const FIFA_INCLUDED_EVENT_TYPES = new Set([0, 2, 3, 5, 7, 8, 12, 18, 26, 41, 71, 83]);

const INCLUDED_TYPES = FIFA_INCLUDED_EVENT_TYPES;

export const FIFA_NEUTRAL_EVENT_TYPES = new Set([
  'goal_disallowed',
  'yellow_card_reassigned',
  'var_decision',
  'hydration_break',
  'period_start',
  'period_end',
  'match_end',
]);

export const FIFA_EVENT_TYPE_MAP = {
  0: 'goal',
  2: 'yellow_card',
  3: 'red_card',
  5: 'substitution',
  7: 'period_start',
  8: 'period_end',
  18: 'foul',
  12: 'shot_attempt',
  26: 'match_end',
  71: 'var_decision',
  83: 'hydration_break',
};

const TYPE_MAP = FIFA_EVENT_TYPE_MAP;

/** Type 71 es VAR genérico: gol anulado, tarjeta reasignada, etc. */
export function resolveVarEventType(description) {
  const desc = String(description ?? '').trim().toLowerCase();
  if (!desc) return 'var_decision';
  if (desc.includes('goal disallowed') || desc.includes('goal cancelled')) {
    return 'goal_disallowed';
  }
  if (
    desc.includes('yellow card reassigned') ||
    desc.includes('card reassigned') ||
    desc.includes('yellow card rescinded') ||
    desc.includes('card rescinded') ||
    desc.includes('yellow card overturned') ||
    desc.includes('yellow card cancelled') ||
    desc.includes('card cancelled')
  ) {
    return 'yellow_card_reassigned';
  }
  return 'var_decision';
}

export function isNeutralTimelineEvent(type) {
  return FIFA_NEUTRAL_EVENT_TYPES.has(type);
}

export function parseFifaMinute(matchMinute) {
  const raw = String(matchMinute ?? '').trim();
  if (!raw || /^ht$/i.test(raw)) {
    return { minute: null, extraMinute: null, sortKey: Number.POSITIVE_INFINITY };
  }

  const extraMatch = raw.match(/^(\d+)\s*['']?\s*\+\s*(\d+)\s*['']?$/);
  if (extraMatch) {
    const minute = Number(extraMatch[1]);
    const extraMinute = Number(extraMatch[2]);
    return { minute, extraMinute, sortKey: minute + extraMinute / 100 };
  }

  const simpleMatch = raw.match(/^(\d+)\s*['']?$/);
  if (simpleMatch) {
    const minute = Number(simpleMatch[1]);
    return { minute, extraMinute: null, sortKey: minute };
  }

  return { minute: null, extraMinute: null, sortKey: Number.POSITIVE_INFINITY };
}

function localizedDescription(event) {
  return event?.EventDescription?.find((item) => item.Locale === 'en-GB')?.Description ?? '';
}

function extractPlayerName(description, fallback = '') {
  const trimmed = String(description ?? '').trim();
  if (!trimmed) return fallback;

  const patterns = [
    /^(.+?)\s*\([^)]+\)\s+(?:scores!!|scores a goal|is booked|is sent off!|commits a foul\.|attempts an effort on goal)/i,
    /^(.+?)\s*\([^)]+\)\s+(?:scores|misses|successfully converts)/i,
    /^(.+?)\s+scores(?:!!| a goal| for\b| in the penalty shoot-out)/i,
    /^(.+?)\s+(?:misses|successfully converts)/i,
    /^(.+?)\s*\(in\)/i,
    /^(.+?)\s*\(out\)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return fallback;
}

function parseSubstitution(description) {
  const match = String(description ?? '').match(
    /(.+?)\s*\(in\).*?replace\s+(.+?)\s*\(out\)/i
  );
  if (!match) return { playerIn: null, playerOut: null };

  return {
    playerIn: match[1].trim(),
    playerOut: match[2].trim(),
  };
}

function resolveSide(teamId, homeTeamId, awayTeamId) {
  const id = String(teamId ?? '');
  if (id && id === String(homeTeamId)) return 'home';
  if (id && id === String(awayTeamId)) return 'away';
  return null;
}

/** @param {TimelineEventType} type @param {string} description @param {number | null} minute */
export function inferPeriodPhase(type, description, minute) {
  const desc = String(description ?? '').toLowerCase();

  if (
    type === 'hydration_break' ||
    type === 'match_end' ||
    type === 'goal_disallowed' ||
    type === 'yellow_card_reassigned' ||
    type === 'var_decision'
  ) {
    return null;
  }

  if (desc.includes('first')) return 'first';
  if (desc.includes('second')) return 'second';

  if (type === 'period_start') {
    return minute != null && minute >= 45 ? 'second' : 'first';
  }

  if (type === 'period_end') {
    return minute != null && minute > 45 ? 'second' : 'first';
  }

  return null;
}

export function fifaEventDescription(event) {
  return localizedDescription(event);
}

export function extractPlayerNameFromDescription(description, fallback = '') {
  return extractPlayerName(description, fallback);
}

export function parseSubstitutionFromDescription(description) {
  return parseSubstitution(description);
}

export function resolveFifaEventSide(teamId, homeTeamId, awayTeamId) {
  return resolveSide(teamId, homeTeamId, awayTeamId);
}

export function buildFifaTimelineEntry(event, homeTeamId, awayTeamId) {
  if (!INCLUDED_TYPES.has(event.Type)) return null;

  const description = localizedDescription(event);
  const timing = parseFifaMinute(event.MatchMinute);
  const fifaPeriod = event.Period != null ? event.Period : null;
  const shootoutPeriod = isFifaShootoutPeriod(fifaPeriod);
  const shootoutKick =
    shootoutPeriod || (event.Type === 0 && isShootoutKickDescription(description));

  let type = /** @type {TimelineEventType} */ (TYPE_MAP[event.Type]);
  if (event.Type === 41 || (event.Type === 0 && isInGamePenaltyDescription(description))) {
    type = 'goal';
  } else if (shootoutKick) {
    type = 'penalty_shootout_kick';
  } else if (event.Type === 71) {
    type = resolveVarEventType(description);
  }
  const neutral = isNeutralTimelineEvent(type);
  const side = resolveSide(event.IdTeam, homeTeamId, awayTeamId);
  if (!side && !neutral) return null;

  const positionX =
    event.PositionX != null && Number.isFinite(Number(event.PositionX))
      ? Number(event.PositionX)
      : null;
  const positionY =
    event.PositionY != null && Number.isFinite(Number(event.PositionY))
      ? Number(event.PositionY)
      : null;

  const entry = {
    sortKey: timing.sortKey,
    minute: timing.minute,
    extraMinute: timing.extraMinute,
    type,
    side: neutral ? null : side,
    fifaPeriod,
    isShootoutKick: shootoutKick && !neutral,
    phase: inferPeriodPhase(type, description, timing.minute),
    player: null,
    playerIn: null,
    playerOut: null,
    idPlayer: event.IdPlayer != null ? String(event.IdPlayer) : null,
    idPlayerIn: null,
    idPlayerOut: null,
    positionX,
    positionY,
    description,
  };

  if (
    entry.type === 'period_start' &&
    entry.phase === 'second' &&
    entry.minute === 45 &&
    entry.extraMinute == null
  ) {
    // FIFA marca el inicio del 2.º tiempo en 45' aunque el 1.er termine en 45+X
    entry.sortKey = entry.minute + 0.5;
  }

  if (neutral) {
    return entry;
  }

  entry.player = extractPlayerName(description) || null;

  if (type === 'substitution') {
    const { playerIn, playerOut } = parseSubstitution(description);
    entry.playerIn = playerIn;
    entry.playerOut = playerOut;
    entry.player = playerIn ?? playerOut ?? entry.player;
    entry.idPlayerIn = event.IdPlayer != null ? String(event.IdPlayer) : null;
    entry.idPlayerOut = event.IdSubPlayer != null ? String(event.IdSubPlayer) : null;
    if (!entry.playerIn || !entry.playerOut) return entry;
  } else if (!entry.player && type !== 'penalty_shootout_kick' && event.Type !== 41) {
    return entry;
  }

  if (type === 'goal' && (event.Type === 41 || isInGamePenaltyDescription(description))) {
    entry.isPenalty = true;
  }

  if (type === 'penalty_shootout_kick') {
    const desc = description.toLowerCase();
    entry.scored =
      event.Type === 0 &&
      !desc.includes('misses') &&
      !desc.includes('saved') &&
      !desc.includes('not scored');
    if (desc.includes('misses') || desc.includes('saved') || desc.includes('not scored')) {
      entry.scored = false;
    }
  }

  return entry;
}

export function parseFifaTimeline(timelineJson, homeTeamId, awayTeamId) {
  const events = timelineJson?.Event ?? [];
  const parsed = [];

  for (const event of events) {
    const entry = buildFifaTimelineEntry(event, homeTeamId, awayTeamId);
    if (!entry) continue;

    if (isNeutralTimelineEvent(entry.type)) {
      if (entry.type === 'period_start' && entry.phase === 'first' && entry.minute === 0) {
        continue;
      }
      parsed.push(entry);
      continue;
    }

    if (entry.type === 'substitution' && (!entry.playerIn || !entry.playerOut)) continue;

    if (entry.type === 'penalty_shootout_kick') {
      parsed.push(entry);
      continue;
    }

    parsed.push(entry);
  }

  return parsed.sort((a, b) => a.sortKey - b.sortKey);
}

/** FIFA type 26 = fin de partido (independiente de worldcup26). */
export function fifaRawTimelineHasMatchEnd(timelineJson) {
  const events = timelineJson?.Event ?? [];
  return events.some((event) => Number(event?.Type) === 26);
}

export function parsedTimelineHasMatchEnd(timeline = []) {
  return timeline.some((event) => event?.type === 'match_end');
}

function normalizePlayerNameForSlot(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Identidad de slot para deduplicar eventos (prioriza idPlayer sobre nombre). */
export function timelineSlotIdentity(entry) {
  const slot = [
    entry?.type ?? '',
    entry?.side ?? '',
    entry?.minute ?? '',
    entry?.extraMinute ?? '',
  ].join('|');
  const playerKey =
    entry?.idPlayer ??
    entry?.idPlayerIn ??
    entry?.idPlayerOut ??
    normalizePlayerNameForSlot(entry?.player ?? entry?.playerIn ?? entry?.playerOut ?? '');
  return `${slot}|${playerKey}`;
}

/** Elimina eventos duplicados por slot (p. ej. mismo tiro con distinto casing del nombre). */
export function dedupeTimelineBySlot(timeline = []) {
  const seen = new Set();
  const deduped = [];
  for (const event of timeline) {
    const key = timelineSlotIdentity(event);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  return deduped;
}

function shotAttemptIdentity(entry) {
  const playerKey = entry?.idPlayer
    ? String(entry.idPlayer)
    : normalizePlayerNameForSlot(entry?.player);
  return [entry.side, entry.minute, entry.extraMinute, playerKey].join('|');
}

/** Incorpora tiros (FIFA type 12) desde rawEvents si el timeline guardado aún no los tiene. */
export function mergeShotAttemptsFromRawEvents(timeline = [], rawEvents = [], homeTeamId, awayTeamId) {
  const merged = [...timeline];
  const seen = new Set(
    merged
      .filter((event) => event.type === 'shot_attempt')
      .map((event) => shotAttemptIdentity(event))
  );

  for (const rawEvent of rawEvents) {
    if (rawEvent?.Type !== 12) continue;
    const entry = buildFifaTimelineEntry(rawEvent, homeTeamId, awayTeamId);
    if (!entry || entry.type !== 'shot_attempt') continue;

    const key = shotAttemptIdentity(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return dedupeTimelineBySlot(
    merged.sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0))
  );
}
