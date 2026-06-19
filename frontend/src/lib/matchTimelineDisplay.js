/** Eventos visibles en cronología del partido en vivo. */
export const TIMELINE_DISPLAY_TYPES = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'substitution',
  'foul',
  'shot_attempt',
  'goal_disallowed',
  'yellow_card_reassigned',
  'var_decision',
  'hydration_break',
  'period_start',
  'period_end',
  'match_end',
]);

/** Gol sintético sin minuto ni autor: solo refleja el marcador, no un evento cronológico. */
export function isPlaceholderTimelineGoal(event) {
  return event?.type === 'goal' && event.minute == null && !event.player;
}

function normalizePlayerName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function playersLikelyMatch(shotPlayer, goalPlayer) {
  const shot = normalizePlayerName(shotPlayer);
  const goal = normalizePlayerName(goalPlayer);
  if (!shot || !goal) return true;
  if (shot === goal) return true;
  if (shot.includes(goal) || goal.includes(shot)) return true;

  const shotLast = shot.split(/\s+/).pop();
  const goalLast = goal.split(/\s+/).pop();
  return Boolean(shotLast && goalLast && shotLast === goalLast);
}

function sameTimelineTiming(a, b) {
  return (
    a?.side === b?.side &&
    a?.minute === b?.minute &&
    (a?.extraMinute ?? null) === (b?.extraMinute ?? null)
  );
}

function shotPairsGoal(shot, goal) {
  if (shot?.type !== 'shot_attempt' || goal?.type !== 'goal') return false;
  if (!sameTimelineTiming(shot, goal)) return false;
  return playersLikelyMatch(shot.player, goal.player);
}

/** Oculta tiros que ya figuran como gol en la misma jugada y marca el gol con includesShot. */
export function annotateTimelineForDisplay(events = []) {
  const list = events ?? [];
  const goals = list.filter((event) => event.type === 'goal');
  const absorbedShotIds = new Set();
  const goalIncludesShot = new Set();

  for (const goal of goals) {
    const shot = list.find(
      (event) =>
        event.type === 'shot_attempt' &&
        !absorbedShotIds.has(timelineEventIdentity(event)) &&
        shotPairsGoal(event, goal)
    );
    if (!shot) continue;
    absorbedShotIds.add(timelineEventIdentity(shot));
    goalIncludesShot.add(timelineEventIdentity(goal));
  }

  return list
    .filter(
      (event) => event.type !== 'shot_attempt' || !absorbedShotIds.has(timelineEventIdentity(event))
    )
    .map((event) =>
      event.type === 'goal' && goalIncludesShot.has(timelineEventIdentity(event))
        ? { ...event, includesShot: true }
        : event
    );
}

export function filterTimelineForDisplay(events = []) {
  return annotateTimelineForDisplay(events).filter(
    (event) => TIMELINE_DISPLAY_TYPES.has(event.type) && !isPlaceholderTimelineGoal(event)
  );
}

/** Identidad estable de un evento para keys y detectar cambios reales en la cronología. */
export function timelineEventIdentity(event) {
  const phase = event?.phase ?? '';
  return [
    event?.type ?? '',
    event?.side ?? '',
    event?.minute ?? '',
    event?.extraMinute ?? '',
    phase,
    event?.player ?? '',
    event?.playerIn ?? '',
    event?.playerOut ?? '',
    event?.playerPosition ?? '',
  ].join(':');
}

export function timelineEventsSignature(events = []) {
  return filterTimelineForDisplay(events)
    .map(timelineEventIdentity)
    .join('|');
}

export function formatNeutralTimelineLabel(event) {
  switch (event?.type) {
    case 'goal_disallowed':
      return 'Gol anulado (VAR)';
    case 'yellow_card_reassigned':
      return 'Tarjeta amarilla reasignada (VAR)';
    case 'var_decision': {
      const desc = String(event?.description ?? '').trim();
      if (/yellow card reassigned/i.test(desc)) return 'Tarjeta amarilla reasignada (VAR)';
      if (/goal disallowed/i.test(desc)) return 'Gol anulado (VAR)';
      return desc || 'Decisión VAR';
    }
    case 'hydration_break':
      return 'Pausa hidratación';
    case 'period_end':
      return event?.phase === 'second' ? 'Fin 2.º tiempo' : 'Fin 1.er tiempo';
    case 'period_start':
      return event?.phase === 'second' ? 'Inicio 2.º tiempo' : 'Inicio 1.er tiempo';
    case 'match_end':
      return 'Final del partido';
    default:
      return null;
  }
}

export function timelineSortKey(event) {
  if (event?.sortKey != null) {
    const key = Number(event.sortKey);
    if (Number.isFinite(key)) return key;
  }
  if (event?.minute == null || !Number.isFinite(Number(event.minute))) {
    return Number.NEGATIVE_INFINITY;
  }
  const minute = Number(event.minute);
  const extra = Number(event.extraMinute ?? 0);
  return minute + extra / 100;
}

/** Desempate en el límite del entretiempo (Fin 1.er vs Inicio 2.º). */
export function compareTimelineEntries(a, b) {
  const keyDiff = timelineSortKey(b) - timelineSortKey(a);
  if (keyDiff !== 0) return keyDiff;
  const halftimeOrder = { period_start: 1, period_end: 0 };
  return (halftimeOrder[b?.type] ?? 0) - (halftimeOrder[a?.type] ?? 0);
}

function timelineRowGroupKey(entry) {
  const sk = entry.sortKey ?? timelineSortKey(entry);
  if (Number.isFinite(sk) && sk !== Number.NEGATIVE_INFINITY) {
    return `t:${Number(sk).toFixed(4)}`;
  }
  return `id:${entry.key}`;
}

/**
 * Agrupa entradas de cronología en filas por minuto (sortKey) para alinear
 * las tres columnas (local | acciones | visitante) en la misma escala temporal.
 */
export function buildSynchronizedTimelineRows(entries = []) {
  const sorted = [...entries].sort(compareTimelineEntries);
  const rowMap = new Map();
  const rowOrder = [];

  for (const entry of sorted) {
    const rowKey = timelineRowGroupKey(entry);
    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, {
        key: rowKey,
        sortKey: entry.sortKey ?? timelineSortKey(entry),
        home: [],
        neutral: [],
        away: [],
      });
      rowOrder.push(rowKey);
    }

    const row = rowMap.get(rowKey);
    if (entry.side === 'home') row.home.push(entry);
    else if (entry.side === 'away') row.away.push(entry);
    else row.neutral.push(entry);
  }

  return rowOrder.map((key) => rowMap.get(key));
}
