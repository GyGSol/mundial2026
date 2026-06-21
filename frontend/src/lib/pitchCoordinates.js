/** Márgenes del contenedor de cancha (alineados con PitchFormation). */
export const PITCH_MARGIN_X = 4;
export const PITCH_SPAN_X = 92;
export const PITCH_MARGIN_Y = 8;
export const PITCH_SPAN_Y = 84;

function clampFifaCoord(value) {
  return Math.min(100, Math.max(0, Number(value)));
}

/** Goles y tiros: coords FIFA relativas al ataque → orientación fija local/visitante. */
const ATTACK_RELATIVE_EVENT_TYPES = new Set(['shot_attempt', 'goal']);

/** Faltas/tarjetas: coords absolutas (x=0 arco local, x=100 arco visitante). */
export const ABSOLUTE_PITCH_EVENT_TYPES = new Set(['foul', 'yellow_card', 'red_card']);

/**
 * Convierte coords FIFA (relativas al ataque, alto X ≈ arco rival) a la cancha fija:
 * - x=0 → arco del local (etiqueta abajo-izquierda)
 * - x=100 → arco del visitante (etiqueta abajo-derecha)
 * - Local: acciones hacia la derecha (ej. gol de Alemania cerca del arco visitante)
 * - Visitante: acciones hacia la izquierda (arco local)
 *
 * La vista no rota en el descanso: siempre se lee “local ataca a la derecha”.
 */
export function normalizeTeamEventToStadiumPitch(x, y, side) {
  if (side === 'home') {
    return x >= 50 ? { x, y } : { x: 100 - x, y };
  }
  if (side === 'away') {
    return x >= 50 ? { x: 100 - x, y } : { x, y };
  }
  return { x, y };
}

/** Zona ofensiva en cancha fija (para faltas en el mapa de ataque Normal). */
export function isInAttackingThird(side, stadiumX) {
  const x = Number(stadiumX);
  if (!Number.isFinite(x)) return false;
  if (side === 'home') return x >= 55;
  if (side === 'away') return x <= 45;
  return false;
}

/**
 * Coordenadas absolutas en la cancha (0–100) para pins y mapas de calor.
 */
export function getPitchEventFifaCoords(event) {
  const x = Number(event?.positionX);
  const y = Number(event?.positionY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let coords = { x: clampFifaCoord(x), y: clampFifaCoord(y) };

  if (ATTACK_RELATIVE_EVENT_TYPES.has(event?.type) && event?.side) {
    coords = normalizeTeamEventToStadiumPitch(coords.x, coords.y, event.side);
    coords = {
      x: clampFifaCoord(coords.x),
      y: clampFifaCoord(coords.y),
    };
  }

  return coords;
}

function coordsToPitchPercent(x, y) {
  return {
    left: `${PITCH_MARGIN_X + (x / 100) * PITCH_SPAN_X}%`,
    top: `${PITCH_MARGIN_Y + (y / 100) * PITCH_SPAN_Y}%`,
  };
}

/**
 * Convierte coordenadas FIFA absolutas (0–100) a posición % en la cancha completa.
 * positionX: profundidad arco izquierdo → arco derecho.
 * positionY: banda superior → banda inferior.
 */
export function fifaEventToPitchPercent(event) {
  const coords = getPitchEventFifaCoords(event);
  if (!coords) return null;
  return coordsToPitchPercent(coords.x, coords.y);
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
