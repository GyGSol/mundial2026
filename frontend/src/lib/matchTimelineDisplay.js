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
      if (/red card given/i.test(desc)) return 'Tarjeta roja (VAR)';
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
