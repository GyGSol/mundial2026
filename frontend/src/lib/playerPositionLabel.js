/** Posición táctica en español para cronología y UI. */

const COARSE_FALLBACK = {
  GK: 'POR',
  DEF: 'DFC',
  MID: 'MD',
  FWD: 'DC',
};

export function inferTacticalPosition({ position, positionX, positionY }) {
  const coarse = String(position ?? '')
    .trim()
    .toUpperCase();

  if (coarse === 'GK') return 'POR';

  const x = positionX != null ? Number(positionX) : null;
  const y = positionY != null ? Number(positionY) : null;
  const hasPitch =
    x != null && Number.isFinite(x) && y != null && Number.isFinite(y);

  if (hasPitch) {
    const band = coarse || inferCoarseBandFromPitch(x);
    return tacticalFromPitchBand(x, y, band);
  }

  if (COARSE_FALLBACK[coarse]) return COARSE_FALLBACK[coarse];
  return coarse || null;
}

function inferCoarseBandFromPitch(x) {
  if (x < 28) return 'DEF';
  if (x < 72) return 'MID';
  return 'FWD';
}

function tacticalFromPitchBand(x, y, coarse) {
  const yLeft = y <= 30;
  const yRight = y >= 70;

  switch (coarse) {
    case 'GK':
      return 'POR';
    case 'DEF':
      if (yRight) return 'LD';
      if (yLeft) return 'LI';
      return 'DFC';
    case 'MID':
      if (yRight) return 'MC';
      if (yLeft) return 'MI';
      if (x < 40) return 'MCD';
      if (x > 60) return 'MCO';
      return 'MD';
    case 'FWD':
      if (yRight) return 'ED';
      if (yLeft) return 'EI';
      return 'DC';
    default:
      return COARSE_FALLBACK[coarse] ?? 'MD';
  }
}

export function formatPlayerEventLabel({
  name,
  position,
  positionX,
  positionY,
  shirtNumber,
} = {}) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '';

  const tag = inferTacticalPosition({ position, positionX, positionY });
  const num =
    shirtNumber != null && Number.isFinite(Number(shirtNumber))
      ? Number(shirtNumber)
      : null;

  const prefix = [tag, num != null ? String(num) : null].filter(Boolean).join(' ');
  return prefix ? `${prefix} · ${trimmed}` : trimmed;
}

/** @param {Record<string, unknown>} event */
export function formatTimelinePlayer(event, role = 'player') {
  const suffix = role === 'player' ? '' : role === 'in' ? 'In' : 'Out';
  const nameKey = role === 'player' ? 'player' : `player${suffix}`;
  const positionKey = role === 'player' ? 'playerPosition' : `player${suffix}Position`;
  const shirtKey = role === 'player' ? 'playerShirtNumber' : `player${suffix}ShirtNumber`;
  const xKey = role === 'player' ? 'positionX' : `player${suffix}PositionX`;
  const yKey = role === 'player' ? 'positionY' : `player${suffix}PositionY`;

  return formatPlayerEventLabel({
    name: event?.[nameKey],
    position: event?.[positionKey],
    positionX: event?.[xKey],
    positionY: event?.[yKey],
    shirtNumber: event?.[shirtKey],
  });
}

/** @param {{ name?: string, position?: string | null, shirtNumber?: number | null, positionX?: number | null, positionY?: number | null }} entry */
export function formatSummaryPlayer(entry) {
  return formatPlayerEventLabel({
    name: entry?.name ?? entry?.player,
    position: entry?.position,
    positionX: entry?.positionX,
    positionY: entry?.positionY,
    shirtNumber: entry?.shirtNumber,
  });
}
