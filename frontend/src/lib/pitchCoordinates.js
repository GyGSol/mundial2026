/** Márgenes del contenedor de cancha (alineados con PitchFormation). */
export const PITCH_MARGIN_X = 4;
export const PITCH_SPAN_X = 92;
export const PITCH_MARGIN_Y = 8;
export const PITCH_SPAN_Y = 84;

/** Mitad de cancha para alineaciones (gridX/gridY por equipo). */
export const LINEUP_DEPTH_EDGE = 6;
export const LINEUP_DEPTH_SPAN = 88;
export const LINEUP_LATERAL_EDGE = 10;
export const LINEUP_LATERAL_SPAN = 80;

function clampFifaCoord(value) {
  return Math.min(100, Math.max(0, Number(value)));
}

/** Perspectiva del equipo → eje lateral de la cancha fija (0 = arriba, 100 = abajo). */
export function teamLateralToStadiumY(y, side) {
  const lateral = clampFifaCoord(y);
  if (side === 'away') return 100 - lateral;
  return lateral;
}

/**
 * gridX/gridY tácticos (perspectiva del equipo) → posición % dentro de su mitad.
 * gridX: 0 = arco propio, 100 = línea de medio campo.
 * gridY: 0 = banda izquierda del equipo, 100 = banda derecha.
 * El visitante invierte gridY en pantalla (derecha arriba, izquierda abajo).
 */
export function lineupGridToHalfPitchPercent(gridX, gridY, side) {
  const depth = clampFifaCoord(gridX ?? 50);
  const lateral = teamLateralToStadiumY(gridY ?? 50, side);

  const top = LINEUP_LATERAL_EDGE + (lateral / 100) * LINEUP_LATERAL_SPAN;
  const alongHalf = LINEUP_DEPTH_EDGE + (depth / 100) * LINEUP_DEPTH_SPAN;
  const left = side === 'home' ? alongHalf : 100 - alongHalf;

  return { left: `${left}%`, top: `${top}%` };
}

/** Goles y tiros: coords FIFA relativas al ataque → orientación fija local/visitante. */
const ATTACK_RELATIVE_EVENT_TYPES = new Set(['shot_attempt', 'goal']);

/** Faltas/tarjetas: X absoluto de estadio; Y se normaliza por equipo en getPitchEventFifaCoords. */
export const ABSOLUTE_PITCH_EVENT_TYPES = new Set(['foul', 'yellow_card', 'red_card']);

/**
 * Convierte profundidad FIFA (relativa al ataque, alto X ≈ arco rival) a la cancha fija.
 * El eje lateral (Y) se normaliza aparte con teamLateralToStadiumY.
 */
export function normalizeTeamEventDepthToStadium(x, side) {
  if (side === 'home') {
    return x >= 50 ? x : 100 - x;
  }
  if (side === 'away') {
    return x >= 50 ? 100 - x : x;
  }
  return x;
}

/** @deprecated Alias de normalizeTeamEventDepthToStadium + teamLateralToStadiumY en getPitchEventFifaCoords */
export function normalizeTeamEventToStadiumPitch(x, y, side) {
  const stadiumX = normalizeTeamEventDepthToStadium(x, side);
  const stadiumY = side ? teamLateralToStadiumY(y, side) : y;
  return { x: stadiumX, y: stadiumY };
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
    coords = {
      x: clampFifaCoord(normalizeTeamEventDepthToStadium(coords.x, event.side)),
      y: coords.y,
    };
  }

  if (event?.side) {
    coords = {
      ...coords,
      y: clampFifaCoord(teamLateralToStadiumY(coords.y, event.side)),
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
