import { Prediction } from '../models/Prediction.js';
import { Match } from '../models/Match.js';
import { TrainingBuffer } from '../models/TrainingBuffer.js';
import { AiCompetitorPredictionLog } from '../models/AiCompetitorPredictionLog.js';
import { getAiUser } from './aiPredictionService.js';
import { computeScoreMse } from './trainingBufferService.js';
import { goalDiffScore } from './goalDiffStats.js';
import { loadAiCalibrationStats } from './aiPredictionCalibrationService.js';
import { aggregateMatchPredictions } from './aiCrowdPredictionContextService.js';

const ROLLING_WINDOW = 5;
const MSE_HISTOGRAM_BUCKETS = [
  { label: '0', min: 0, max: 0.001 },
  { label: '0-2', min: 0.001, max: 2 },
  { label: '2-5', min: 2, max: 5 },
  { label: '5-10', min: 5, max: 10 },
  { label: '10-20', min: 10, max: 20 },
  { label: '20+', min: 20, max: Infinity },
];

export function matchPhase(match) {
  const type = String(match?.type ?? 'group').toLowerCase();
  return type === 'group' ? 'group' : 'knockout';
}

export function buildMseHistogram(values = []) {
  const counts = Object.fromEntries(MSE_HISTOGRAM_BUCKETS.map((b) => [b.label, 0]));
  for (const v of values) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    const bucket = MSE_HISTOGRAM_BUCKETS.find((b) => n >= b.min && n < b.max);
    if (bucket) counts[bucket.label] += 1;
  }
  return MSE_HISTOGRAM_BUCKETS.map((b) => ({ bucket: b.label, count: counts[b.label] }));
}

export function rollingHitRates(rows, windowSize = ROLLING_WINDOW) {
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const slice = rows.slice(Math.max(0, i - windowSize + 1), i + 1);
    const n = slice.length;
    const pct = (key) =>
      n ? Number(((slice.filter((r) => r[key]).length / n) * 100).toFixed(1)) : 0;
    out.push({
      matchIndex: i + 1,
      externalId: rows[i].externalId,
      window: Math.min(windowSize, n),
      paPct: pct('paHit'),
      glPct: pct('glHit'),
      gvPct: pct('gvHit'),
      gtPct: pct('gtHit'),
    });
  }
  return out;
}

export function buildCumulativeSeries(rows, valueKey) {
  let sum = 0;
  return rows.map((row, idx) => {
    sum += Number(row[valueKey] ?? 0);
    return {
      matchIndex: idx + 1,
      externalId: row.externalId,
      value: Number(sum.toFixed(4)),
    };
  });
}

export function buildErrorCurvePoints(rows) {
  let cumulativeMse = 0;
  return rows.map((row, idx) => {
    cumulativeMse += row.mse;
    const count = idx + 1;
    return {
      matchId: row.matchId,
      externalId: row.externalId,
      kickoffAt: row.kickoffAt,
      label: row.label,
      group: row.group,
      predictedScore: row.predictedScore,
      actualScore: row.actualScore,
      mseError: Number(row.mse.toFixed(3)),
      gdifCombined: row.gdif,
      cumulativeAvgMse: Number((cumulativeMse / count).toFixed(4)),
      matchIndex: count,
    };
  });
}

export function buildErrorCurveSummary(points) {
  if (!points.length) return null;
  const last = points[points.length - 1];
  return {
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
  };
}

export function buildRollingBiasSeries(rows) {
  let sumH = 0;
  let sumA = 0;
  return rows.map((row, idx) => {
    sumH += row.biasHome ?? 0;
    sumA += row.biasAway ?? 0;
    const n = idx + 1;
    return {
      matchIndex: n,
      externalId: row.externalId,
      avgBiasHome: Number((sumH / n).toFixed(3)),
      avgBiasAway: Number((sumA / n).toFixed(3)),
    };
  });
}

function hitFromBreakdown(breakdown, key) {
  return (breakdown?.[key] ?? 0) > 0;
}

function weekKeyFromDate(date) {
  if (!date) return 'unknown';
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function getAiCompetitorAnalytics({ tournamentYear = 2026 } = {}) {
  const aiUser = await getAiUser();
  if (!aiUser) {
    return {
      summary: null,
      errorCurve: { points: [], summary: null },
      performance: emptyPerformance(),
      calibration: emptyCalibration(),
      training: emptyTraining(),
      pipeline: emptyPipeline(),
      scatter: { predictedVsActual: [] },
    };
  }

  const yearStart = new Date(`${tournamentYear}-01-01`);
  const yearEnd = new Date(`${tournamentYear + 1}-01-01`);

  const [predictions, bufferRows, logs, calibration] = await Promise.all([
    Prediction.find({
      userId: aiUser._id,
      predictionSource: 'ai',
      goalDiffHome: { $ne: null },
    })
      .select(
        'matchId homeGoals awayGoals goalDiffHome goalDiffAway pointsEarned pointsBreakdown aiCalibrationApplied aiPostMatchReview updatedAt'
      )
      .lean(),
    TrainingBuffer.find().sort({ createdAt: 1 }).lean(),
    AiCompetitorPredictionLog.find({ userId: aiUser._id, isSimulation: { $ne: true } })
      .sort({ createdAt: -1 })
      .select('matchId aiSource calibrationApplied createdAt')
      .lean(),
    loadAiCalibrationStats(aiUser._id),
  ]);

  const matchIds = [...new Set(predictions.map((p) => String(p.matchId)))];
  const matches = await Match.find({
    _id: { $in: matchIds },
    status: 'finished',
    kickoffAt: { $gte: yearStart, $lt: yearEnd },
    homeScore: { $ne: null },
    awayScore: { $ne: null },
  })
    .select('_id externalId kickoffAt homeScore awayScore homeTeamId awayTeamId group type')
    .lean();

  const matchById = Object.fromEntries(matches.map((m) => [String(m._id), m]));
  const predByMatch = Object.fromEntries(predictions.map((p) => [String(p.matchId), p]));

  const scoredRows = [];
  for (const match of matches) {
    const pred = predByMatch[String(match._id)];
    if (!pred) continue;

    const mse = computeScoreMse(
      { home: pred.homeGoals, away: pred.awayGoals },
      { home: match.homeScore, away: match.awayScore }
    );
    const gdif = Number(goalDiffScore(pred.goalDiffHome ?? 0, pred.goalDiffAway ?? 0, 1).toFixed(4));
    const breakdown = pred.pointsBreakdown ?? {};
    const hint = pred.aiPostMatchReview?.calibrationHint ?? {};

    scoredRows.push({
      matchId: String(match._id),
      externalId: match.externalId,
      kickoffAt: match.kickoffAt,
      label: `${match.homeTeamId} vs ${match.awayTeamId}`,
      group: match.group ?? null,
      phase: matchPhase(match),
      predictedScore: [pred.homeGoals, pred.awayGoals],
      actualScore: [match.homeScore, match.awayScore],
      points: pred.pointsEarned ?? 0,
      mse,
      gdif,
      goalDiffHome: pred.goalDiffHome ?? 0,
      goalDiffAway: pred.goalDiffAway ?? 0,
      paHit: hitFromBreakdown(breakdown, 'winner'),
      glHit: hitFromBreakdown(breakdown, 'homeGoals'),
      gvHit: hitFromBreakdown(breakdown, 'awayGoals'),
      gtHit: hitFromBreakdown(breakdown, 'totalGoals'),
      biasHome: hint.biasHome ?? pred.homeGoals - match.homeScore,
      biasAway: hint.biasAway ?? pred.awayGoals - match.awayScore,
      observedHome: hint.observedBiasHome ?? pred.homeGoals - match.homeScore,
      observedAway: hint.observedBiasAway ?? pred.awayGoals - match.awayScore,
      calibrationApplied: Boolean(pred.aiCalibrationApplied),
    });
  }

  scoredRows.sort((a, b) => {
    const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
    const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a.externalId).localeCompare(String(b.externalId), undefined, { numeric: true });
  });

  const errorCurvePoints = buildErrorCurvePoints(scoredRows);
  const errorCurveSummary = buildErrorCurveSummary(errorCurvePoints);

  let cumulativeGdifGl = 0;
  let cumulativeGdifGv = 0;
  const cumulativeGdif = scoredRows.map((row, idx) => {
    cumulativeGdifGl += row.goalDiffHome;
    cumulativeGdifGv += row.goalDiffAway;
    const n = idx + 1;
    return {
      matchIndex: n,
      externalId: row.externalId,
      value: Number(goalDiffScore(cumulativeGdifGl, cumulativeGdifGv, n).toFixed(4)),
    };
  });

  const groupAgg = new Map();
  const phaseAgg = new Map();
  for (const row of scoredRows) {
    const gKey = row.group ? String(row.group).toUpperCase() : '?';
    if (!groupAgg.has(gKey)) groupAgg.set(gKey, { mseSum: 0, ptsSum: 0, count: 0 });
    const g = groupAgg.get(gKey);
    g.mseSum += row.mse;
    g.ptsSum += row.points;
    g.count += 1;

    const pKey = row.phase;
    if (!phaseAgg.has(pKey)) phaseAgg.set(pKey, { mseSum: 0, count: 0 });
    const p = phaseAgg.get(pKey);
    p.mseSum += row.mse;
    p.count += 1;
  }

  const humanPreds = await Prediction.find({
    matchId: { $in: matches.map((m) => m._id) },
    userSubmitted: true,
  })
    .populate('userId', 'isAiUser')
    .select('matchId homeGoals awayGoals userId')
    .lean();

  const humansByMatch = new Map();
  for (const p of humanPreds) {
    if (p.userId?.isAiUser) continue;
    const key = String(p.matchId);
    if (!humansByMatch.has(key)) humansByMatch.set(key, []);
    humansByMatch.get(key).push(p);
  }

  const humanVsAi = [];
  for (const row of scoredRows) {
    const humans = humansByMatch.get(row.matchId);
    if (!humans?.length) continue;
    const agg = aggregateMatchPredictions(humans);
    if (agg.mediana?.local == null || agg.mediana?.visitante == null) continue;
    humanVsAi.push({
      externalId: row.externalId,
      aiHome: row.predictedScore[0],
      aiAway: row.predictedScore[1],
      humanMedianHome: agg.mediana.local,
      humanMedianAway: agg.mediana.visitante,
      deltaHome: Number((row.predictedScore[0] - agg.mediana.local).toFixed(2)),
      deltaAway: Number((row.predictedScore[1] - agg.mediana.visitante).toFixed(2)),
    });
  }

  const bufferByWeek = new Map();
  for (const row of bufferRows) {
    const week = row.weekBucket ?? weekKeyFromDate(row.createdAt);
    if (!bufferByWeek.has(week)) {
      bufferByWeek.set(week, { weekBucket: week, count: 0, exported: 0, pending: 0 });
    }
    const entry = bufferByWeek.get(week);
    entry.count += 1;
    if (row.exportedAt) entry.exported += 1;
    else entry.pending += 1;
  }

  const sourceCounts = new Map();
  let calibrationAppliedCount = 0;
  const calibrationByWeek = new Map();
  const seenMatchLogs = new Set();

  for (const log of logs) {
    const matchKey = String(log.matchId);
    if (seenMatchLogs.has(matchKey)) continue;
    seenMatchLogs.add(matchKey);

    const source = log.aiSource ?? 'unknown';
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);

    if (log.calibrationApplied) calibrationAppliedCount += 1;

    const week = weekKeyFromDate(log.createdAt);
    if (!calibrationByWeek.has(week)) {
      calibrationByWeek.set(week, { week, applied: 0, total: 0 });
    }
    const cw = calibrationByWeek.get(week);
    cw.total += 1;
    if (log.calibrationApplied) cw.applied += 1;
  }

  const totalLogs = seenMatchLogs.size;
  const sourceBreakdown = [...sourceCounts.entries()]
    .map(([source, count]) => ({
      source,
      count,
      pct: totalLogs ? Number(((count / totalLogs) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const simulationCount = await AiCompetitorPredictionLog.countDocuments({
    userId: aiUser._id,
    isSimulation: true,
  });

  const n = scoredRows.length;
  let totalPts = 0;
  let paHits = 0;
  for (const row of scoredRows) {
    totalPts += row.points;
    if (row.paHit) paHits += 1;
  }

  return {
    summary: n
      ? {
          partidos: n,
          msePromedio: errorCurveSummary?.msePromedio ?? null,
          gdifCombinado: cumulativeGdif.length ? cumulativeGdif[cumulativeGdif.length - 1].value : null,
          puntosTotales: totalPts,
          promedioPuntos: Number((totalPts / n).toFixed(2)),
          tasaPa: Number(((paHits / n) * 100).toFixed(1)),
          tendencia: errorCurveSummary?.tendencia ?? 'estable',
        }
      : null,
    errorCurve: {
      points: errorCurvePoints,
      summary: errorCurveSummary,
    },
    performance: {
      byMatch: scoredRows.map((row) => ({
        externalId: row.externalId,
        kickoffAt: row.kickoffAt,
        points: row.points,
        mse: Number(row.mse.toFixed(3)),
        gdif: row.gdif,
        paHit: row.paHit,
        glHit: row.glHit,
        gvHit: row.gvHit,
        gtHit: row.gtHit,
        group: row.group,
        phase: row.phase,
      })),
      cumulativeGdif,
      cumulativePoints: buildCumulativeSeries(scoredRows, 'points'),
      hitRatesRolling: rollingHitRates(scoredRows),
      byGroup: [...groupAgg.entries()]
        .map(([group, stats]) => ({
          group,
          avgMse: Number((stats.mseSum / stats.count).toFixed(3)),
          avgPoints: Number((stats.ptsSum / stats.count).toFixed(2)),
          count: stats.count,
        }))
        .sort((a, b) => a.group.localeCompare(b.group)),
      byPhase: [...phaseAgg.entries()].map(([phase, stats]) => ({
        phase,
        avgMse: Number((stats.mseSum / stats.count).toFixed(3)),
        count: stats.count,
      })),
    },
    calibration: {
      biasSeries: scoredRows.map((row) => ({
        externalId: row.externalId,
        kickoffAt: row.kickoffAt,
        biasHome: Number((row.biasHome ?? 0).toFixed(2)),
        biasAway: Number((row.biasAway ?? 0).toFixed(2)),
        observedHome: Number((row.observedHome ?? 0).toFixed(2)),
        observedAway: Number((row.observedAway ?? 0).toFixed(2)),
      })),
      humanVsAi,
      rollingBias: buildRollingBiasSeries(scoredRows),
      current: calibration,
    },
    training: {
      bufferGrowth: [...bufferByWeek.values()].sort((a, b) =>
        a.weekBucket.localeCompare(b.weekBucket)
      ),
      mseHistogram: buildMseHistogram(scoredRows.map((r) => r.mse)),
      recentSamples: bufferRows.slice(-20).map((row) => ({
        matchId: String(row.matchId),
        predictedScore: row.predictedScore,
        actualScore: row.actualScore,
        mseError: row.mseError,
        exportedAt: row.exportedAt,
        createdAt: row.createdAt,
      })),
    },
    pipeline: {
      sourceBreakdown,
      calibrationRate: [...calibrationByWeek.values()]
        .sort((a, b) => a.week.localeCompare(b.week))
        .map((w) => ({
          ...w,
          ratePct: w.total ? Number(((w.applied / w.total) * 100).toFixed(1)) : 0,
        })),
      simulationVsOfficial: {
        official: totalLogs,
        simulation: simulationCount,
      },
    },
    scatter: {
      predictedVsActual: scoredRows.map((row) => ({
        externalId: row.externalId,
        predHome: row.predictedScore[0],
        predAway: row.predictedScore[1],
        actualHome: row.actualScore[0],
        actualAway: row.actualScore[1],
        predTotal: row.predictedScore[0] + row.predictedScore[1],
        actualTotal: row.actualScore[0] + row.actualScore[1],
      })),
    },
  };
}

function emptyPerformance() {
  return {
    byMatch: [],
    cumulativeGdif: [],
    cumulativePoints: [],
    hitRatesRolling: [],
    byGroup: [],
    byPhase: [],
  };
}

function emptyCalibration() {
  return { biasSeries: [], humanVsAi: [], rollingBias: [], current: null };
}

function emptyTraining() {
  return { bufferGrowth: [], mseHistogram: [], recentSamples: [] };
}

function emptyPipeline() {
  return {
    sourceBreakdown: [],
    calibrationRate: [],
    simulationVsOfficial: { official: 0, simulation: 0 },
  };
}
