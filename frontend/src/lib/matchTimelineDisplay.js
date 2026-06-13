/** Eventos visibles en cronología del partido en vivo. */
export const TIMELINE_DISPLAY_TYPES = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'substitution',
  'foul',
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

export function filterTimelineForDisplay(events = []) {
  return (events ?? []).filter(
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
