/**
 * Paleta amplia para series de jugadores: tonos espaciados en el círculo cromático
 * para distinguir líneas en gráficos con muchos participantes (fondo oscuro).
 */
export const PLAYER_CHART_COLORS = [
  'hsl(0 78% 58%)',
  'hsl(28 92% 56%)',
  'hsl(48 96% 52%)',
  'hsl(68 78% 46%)',
  'hsl(95 62% 44%)',
  'hsl(128 58% 42%)',
  'hsl(158 72% 40%)',
  'hsl(178 76% 42%)',
  'hsl(200 88% 52%)',
  'hsl(218 84% 58%)',
  'hsl(238 78% 64%)',
  'hsl(258 72% 62%)',
  'hsl(278 68% 60%)',
  'hsl(300 70% 58%)',
  'hsl(322 76% 58%)',
  'hsl(344 78% 56%)',
  'hsl(12 65% 48%)',
  'hsl(38 80% 44%)',
  'hsl(110 45% 52%)',
  'hsl(190 55% 36%)',
  'hsl(230 55% 48%)',
  'hsl(285 50% 46%)',
];

export function hashUserIdToIndex(userId) {
  const str = String(userId ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PLAYER_CHART_COLORS.length;
}

export function getPlayerChartColor(userId) {
  return PLAYER_CHART_COLORS[hashUserIdToIndex(userId)];
}

/** Un color distinto por jugador (hasta agotar la paleta), estable por id. */
export function assignPlayerChartColors(userIds) {
  const sorted = [...userIds].map(String).sort((a, b) => a.localeCompare(b));
  return new Map(
    sorted.map((userId, index) => [
      userId,
      PLAYER_CHART_COLORS[index % PLAYER_CHART_COLORS.length],
    ])
  );
}
