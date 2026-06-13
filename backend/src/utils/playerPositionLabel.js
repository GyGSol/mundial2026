/** Posición táctica en español para cronología y UI. */

const COARSE_FALLBACK = {
  GK: 'POR',
  DEF: 'DFC',
  MID: 'MD',
  FWD: 'DC',
};

/**
 * @param {{ position?: string | null, positionX?: number | null, positionY?: number | null }} params
 */
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

/**
 * @param {{
 *   name?: string | null,
 *   position?: string | null,
 *   positionX?: number | null,
 *   positionY?: number | null,
 *   shirtNumber?: number | null,
 * }} player
 */
export function formatPlayerEventLabel(player) {
  const name = String(player?.name ?? '').trim();
  if (!name) return '';

  const tag = inferTacticalPosition({
    position: player?.position,
    positionX: player?.positionX,
    positionY: player?.positionY,
  });

  const shirt = player?.shirtNumber;
  const num =
    shirt != null && Number.isFinite(Number(shirt)) ? Number(shirt) : null;

  const prefix = [tag, num != null ? String(num) : null].filter(Boolean).join(' ');
  return prefix ? `${prefix} · ${name}` : name;
}
