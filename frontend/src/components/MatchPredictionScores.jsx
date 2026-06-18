function ScoreValue({ value, label }) {
  return (
    <div className="w-16 text-center md:w-20 lg:w-24">
      {label ? (
        <span className="mb-0.5 block text-[10px] font-normal uppercase tracking-wide text-muted-foreground md:text-xs">
          {label}
        </span>
      ) : null}
      <p className="text-xl font-bold tabular-nums text-foreground md:text-2xl lg:text-3xl">{value}</p>
    </div>
  );
}

/**
 * Marcador real + predicción del usuario (mismo formato que PredictionForm / foto 2).
 */
export default function MatchPredictionScores({ match, showPoints = false }) {
  const prediction = match?.prediction;
  const hasPrediction = Boolean(match?.hasPrediction ?? prediction?.userSubmitted);
  const showActualScores = match?.status !== 'upcoming';

  if (!showActualScores && !hasPrediction) return null;

  const homePrediction = hasPrediction ? prediction?.homeGoals : undefined;
  const awayPrediction = hasPrediction ? prediction?.awayGoals : undefined;

  return (
    <div className="flex w-full flex-col items-center gap-2 md:gap-3">
      {showActualScores ? (
        <div className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-2 md:max-w-sm md:gap-3">
          <div className="flex justify-center">
            <ScoreValue value={match.homeScore ?? 0} label="Resultado" />
          </div>
          <span className="text-lg font-medium text-muted-foreground md:text-xl">-</span>
          <div className="flex justify-center">
            <ScoreValue value={match.awayScore ?? 0} label="Resultado" />
          </div>
        </div>
      ) : null}

      {hasPrediction ? (
        <div className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-2 md:max-w-sm md:gap-3">
          <div className="flex justify-center">
            <ScoreValue
              value={homePrediction}
              label={showActualScores ? 'Tu predicción' : null}
            />
          </div>
          <span className="text-lg font-medium text-muted-foreground md:text-xl">-</span>
          <div className="flex justify-center">
            <ScoreValue
              value={awayPrediction}
              label={showActualScores ? 'Tu predicción' : null}
            />
          </div>
        </div>
      ) : null}

      {showPoints && prediction?.pointsEarned != null ? (
        <p className="text-sm font-medium text-foreground">+{prediction.pointsEarned} pts</p>
      ) : null}
    </div>
  );
}
