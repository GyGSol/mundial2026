import { Prediction } from '../models/Prediction.js';
import { Match } from '../models/Match.js';
import { getAiUser } from './aiPredictionService.js';
import { computeScoreMse } from './trainingBufferService.js';
import { goalDiffScore } from './goalDiffStats.js';

/**
 * Serie temporal de error del Oracle para partidos finalizados del Mundial 2026.
 */
export async function getOracleErrorCurve({ tournamentYear = 2026 } = {}) {
  const aiUser = await getAiUser();
  if (!aiUser) return { points: [], summary: null };

  const predictions = await Prediction.find({
    userId: aiUser._id,
    predictionSource: 'ai',
    goalDiffHome: { $ne: null },
    goalDiffAway: { $ne: null },
  })
    .sort({ updatedAt: 1 })
    .select('matchId homeGoals awayGoals goalDiffHome goalDiffAway updatedAt')
    .lean();

  if (!predictions.length) {
    return { points: [], summary: null };
  }

  const matchIds = predictions.map((p) => p.matchId);
  const matches = await Match.find({
    _id: { $in: matchIds },
    status: 'finished',
    kickoffAt: {
      $gte: new Date(`${tournamentYear}-01-01`),
      $lt: new Date(`${tournamentYear + 1}-01-01`),
    },
  })
    .select('_id externalId kickoffAt homeScore awayScore homeTeamId awayTeamId group')
    .lean();

  const matchById = Object.fromEntries(matches.map((m) => [String(m._id), m]));

  let cumulativeMse = 0;
  let count = 0;
  const points = [];

  for (const pred of predictions) {
    const match = matchById[String(pred.matchId)];
    if (!match || match.homeScore == null || match.awayScore == null) continue;

    const mseError = computeScoreMse(
      { home: pred.homeGoals, away: pred.awayGoals },
      { home: match.homeScore, away: match.awayScore }
    );
    const gdifCombined = goalDiffScore(pred.goalDiffHome ?? 0, pred.goalDiffAway ?? 0, 1);

    count += 1;
    cumulativeMse += mseError;

    points.push({
      matchId: String(match._id),
      externalId: match.externalId,
      kickoffAt: match.kickoffAt,
      label: `${match.homeTeamId} vs ${match.awayTeamId}`,
      group: match.group ?? null,
      predictedScore: [pred.homeGoals, pred.awayGoals],
      actualScore: [match.homeScore, match.awayScore],
      mseError: Number(mseError.toFixed(3)),
      gdifCombined: Number(gdifCombined.toFixed(4)),
      cumulativeAvgMse: Number((cumulativeMse / count).toFixed(4)),
      matchIndex: count,
    });
  }

  const last = points[points.length - 1];
  const summary = points.length
    ? {
        partidos: points.length,
        msePromedio: last.cumulativeAvgMse,
        ultimoMse: last.mseError,
        ultimoGdif: last.gdifCombined,
        tendencia:
          points.length >= 2 && last.cumulativeAvgMse < points[0].mseError
            ? 'mejorando'
            : points.length >= 2 && last.cumulativeAvgMse > points[0].mseError
              ? 'empeorando'
              : 'estable',
      }
    : null;

  return { points, summary };
}
