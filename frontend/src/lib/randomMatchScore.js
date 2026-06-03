/** Máximo de goles por equipo en predicciones y en el generador al azar. */
export const MAX_GOALS_PER_TEAM = 10;

/**
 * Pesos por cantidad de goles (0–10). Fuerte preferencia por marcadores bajos/medios.
 * El índice es la cantidad de goles.
 */
const GOAL_WEIGHTS = [
  28, 22, 18, 14, 9, 5, 2.2, 0.9, 0.35, 0.12, 0.03,
];

function pickWeightedGoal() {
  const total = GOAL_WEIGHTS.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let goals = 0; goals <= MAX_GOALS_PER_TEAM; goals += 1) {
    roll -= GOAL_WEIGHTS[goals];
    if (roll <= 0) return goals;
  }
  return 0;
}

/**
 * Evita goleadas poco realistas (10-0, 9-0, 8-1, etc.) manteniendo el tope de 10.
 */
export function isRealisticScore(homeGoals, awayGoals) {
  const max = Math.max(homeGoals, awayGoals);
  const min = Math.min(homeGoals, awayGoals);
  const diff = max - min;

  if (max > MAX_GOALS_PER_TEAM || min < 0) return false;
  if (diff >= 5) return false;
  if (min === 0 && max >= 5) return false;
  if (min <= 1 && max >= 6) return false;
  if (max >= 8) return false;
  if (max >= 7 && min <= 2) return false;

  return true;
}

/**
 * Resultado aleatorio para un partido: 0–10 por equipo, sin goleadas extremas.
 */
export function randomMatchScore() {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const homeGoals = pickWeightedGoal();
    const awayGoals = pickWeightedGoal();
    if (isRealisticScore(homeGoals, awayGoals)) {
      return { homeGoals, awayGoals };
    }
  }

  const safe = [
    { homeGoals: 1, awayGoals: 1 },
    { homeGoals: 2, awayGoals: 1 },
    { homeGoals: 1, awayGoals: 2 },
    { homeGoals: 2, awayGoals: 2 },
    { homeGoals: 0, awayGoals: 0 },
    { homeGoals: 3, awayGoals: 2 },
    { homeGoals: 2, awayGoals: 3 },
  ];
  return safe[Math.floor(Math.random() * safe.length)];
}
