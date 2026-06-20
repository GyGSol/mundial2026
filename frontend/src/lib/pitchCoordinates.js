/** Márgenes del contenedor de cancha (alineados con PitchFormation). */
export const PITCH_MARGIN_X = 4;
export const PITCH_SPAN_X = 92;
export const PITCH_MARGIN_Y = 8;
export const PITCH_SPAN_Y = 84;

/**
 * Convierte coordenadas FIFA absolutas (0–100) a posición % en la cancha completa.
 * positionX: profundidad arco izquierdo → arco derecho.
 * positionY: banda superior → banda inferior.
 */
export function fifaEventToPitchPercent(event) {
  const x = Number(event?.positionX);
  const y = Number(event?.positionY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const clampedX = Math.min(100, Math.max(0, x));
  const clampedY = Math.min(100, Math.max(0, y));

  return {
    left: `${PITCH_MARGIN_X + (clampedX / 100) * PITCH_SPAN_X}%`,
    top: `${PITCH_MARGIN_Y + (clampedY / 100) * PITCH_SPAN_Y}%`,
  };
}

export function eventHasPitchCoords(event) {
  return (
    event?.positionX != null &&
    event?.positionY != null &&
    Number.isFinite(Number(event.positionX)) &&
    Number.isFinite(Number(event.positionY))
  );
}

export const EVENT_PIN_COLORS = {
  goal: 'bg-emerald-400 ring-emerald-200',
  yellow_card: 'bg-yellow-400 ring-yellow-200',
  red_card: 'bg-red-500 ring-red-200',
  shot_attempt: 'bg-sky-300 ring-sky-100',
  foul: 'bg-orange-400 ring-orange-200',
  substitution: 'bg-violet-400 ring-violet-200',
};

export function eventPinColorClass(type) {
  return EVENT_PIN_COLORS[type] ?? 'bg-white/80 ring-white/40';
}

export const HEATMAP_EVENT_TYPES = {
  shots: new Set(['shot_attempt', 'goal']),
  fouls: new Set(['foul', 'yellow_card', 'red_card']),
  goals: new Set(['goal']),
};
