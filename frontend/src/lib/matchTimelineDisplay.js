/** Eventos visibles en cronología (sin faltas: ocultan goles en el scroll). */
export const TIMELINE_DISPLAY_TYPES = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'substitution',
  'goal_disallowed',
  'hydration_break',
  'period_start',
  'period_end',
  'match_end',
]);

export function filterTimelineForDisplay(events = []) {
  return (events ?? []).filter((event) => TIMELINE_DISPLAY_TYPES.has(event.type));
}

export function formatNeutralTimelineLabel(event) {
  switch (event?.type) {
    case 'goal_disallowed':
      return 'Gol anulado';
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
