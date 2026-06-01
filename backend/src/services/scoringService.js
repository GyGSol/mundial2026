function getOutcome({ home, away }) {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'draw';
}

/**
 * @param {{ home: number, away: number }} prediction
 * @param {{ home: number, away: number }} actual
 */
export function calculatePoints(prediction, actual) {
  const breakdown = {
    winner: 0,
    homeGoals: 0,
    awayGoals: 0,
    totalGoals: 0,
  };

  if (getOutcome(prediction) === getOutcome(actual)) {
    breakdown.winner = 3;
  }

  if (prediction.home === actual.home) {
    breakdown.homeGoals = 1;
  }

  if (prediction.away === actual.away) {
    breakdown.awayGoals = 1;
  }

  const predTotal = prediction.home + prediction.away;
  const actualTotal = actual.home + actual.away;
  if (predTotal === actualTotal) {
    breakdown.totalGoals = 1;
  }

  const total =
    breakdown.winner +
    breakdown.homeGoals +
    breakdown.awayGoals +
    breakdown.totalGoals;

  return { total, breakdown };
}
