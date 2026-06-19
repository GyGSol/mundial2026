function patchMatchEntry(match, matchId, prediction) {
  if (!match || match.id !== matchId) return match;
  return {
    ...match,
    hasPrediction: true,
    prediction: {
      ...match.prediction,
      homeGoals: prediction.homeGoals,
      awayGoals: prediction.awayGoals,
      userSubmitted: true,
      pointsEarned: prediction.pointsEarned ?? match.prediction?.pointsEarned ?? null,
      updatedAt: prediction.updatedAt ?? new Date().toISOString(),
    },
  };
}

function patchMatchList(list, matchId, prediction) {
  if (!Array.isArray(list)) return list;
  return list.map((match) => patchMatchEntry(match, matchId, prediction));
}

/** Aplica una predicción guardada al payload de /predictions/matches. */
export function patchMatchPrediction(data, matchId, prediction) {
  if (!data || !matchId || !prediction) return data;

  return {
    ...data,
    matches: patchMatchList(data.matches, matchId, prediction),
    liveMatches: patchMatchList(data.liveMatches, matchId, prediction),
    recentFinishedMatches: patchMatchList(data.recentFinishedMatches, matchId, prediction),
  };
}

/** Busca un partido en cualquiera de las listas del payload de predicciones. */
export function findMatchInPredictionsPayload(data, matchId) {
  if (!data || !matchId) return null;

  for (const list of [data.liveMatches, data.recentFinishedMatches, data.matches]) {
    const found = list?.find((match) => match.id === matchId);
    if (found) return found;
  }

  return null;
}
