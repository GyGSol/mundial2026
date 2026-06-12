/** Eventos visibles en cronología (sin faltas: ocultan goles en el scroll). */
export const TIMELINE_DISPLAY_TYPES = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'substitution',
  'goal_disallowed',
]);

export function filterTimelineForDisplay(events = []) {
  return (events ?? []).filter((event) => TIMELINE_DISPLAY_TYPES.has(event.type));
}
