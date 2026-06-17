import mongoose from 'mongoose';
import { AiCompetitorPredictionLog } from '../models/AiCompetitorPredictionLog.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { humanizePromptContext, briefAiReasoning } from './aiPromptHumanizer.js';
import { formatPostMatchReviewRowMeta } from './aiPostMatchLearningService.js';
import { env } from '../config/env.js';
import { goalDiffScore } from './goalDiffStats.js';
import { isPredictionLocked } from './predictionLockService.js';
import { compareMatchesBySchedule } from './matchSortService.js';
import { recalculateMatchScores } from './syncService.js';
import { notifyLeaderboardUpdated, notifyMatchesUpdated } from './websocketService.js';

const MAX_CONTEXT_BYTES = 512_000;

function modelForSource(source) {
  if (source === 'cerebras') return env.aiCerebrasModel;
  if (source === 'gemini') return env.aiGeminiModel;
  if (source === 'groq') return env.aiGroqModel;
  if (source === 'heuristic-xg' || source === 'heuristic-odds') return source;
  return 'heuristic';
}

function stripInternalContextFields(context) {
  if (!context || typeof context !== 'object') return context;
  const { _calibrationStats, externalIntel, ...rest } = context;
  return rest;
}

export function buildAuditPromptContext(context) {
  const stripped = stripInternalContextFields(context);
  const humanized = humanizePromptContext(stripped);
  const json = JSON.stringify(humanized);
  if (json.length <= MAX_CONTEXT_BYTES) return humanized;

  return {
    ...humanized,
    _truncated: true,
    _originalBytes: json.length,
    _note: 'Contexto recortado por tamaño; revisá logs del servidor si necesitás el payload completo.',
  };
}

function slimContextForAuditLog(context) {
  if (!context?._lightContext) return context;
  return {
    matchExternalId: context.matchExternalId,
    phase: context.phase,
    group: context.group,
    kickoffAt: context.kickoffAt,
    homeTeam: context.homeTeam,
    awayTeam: context.awayTeam,
    headToHead2026: context.headToHead2026,
    venue: context.venue,
    groupStandings: context.groupStandings,
    mercadoYxG: context.mercadoYxG,
    calibracionReciente: context.calibracionReciente,
    _lightContext: true,
  };
}

export async function saveAiCompetitorPredictionLog({
  userId,
  matchId,
  predictionId,
  context,
  rawScore,
  finalScore,
  isSimulation = false,
}) {
  const promptContext = buildAuditPromptContext(slimContextForAuditLog(context));
  const doc = await AiCompetitorPredictionLog.create({
    userId,
    matchId,
    predictionId: predictionId ?? null,
    isSimulation: Boolean(isSimulation),
    homeGoals: finalScore.homeGoals,
    awayGoals: finalScore.awayGoals,
    aiModel: modelForSource(finalScore.source),
    aiSource: finalScore.source ?? null,
    calibrationApplied: Boolean(finalScore.calibrationApplied),
    promptContext,
    rawResponse: rawScore
      ? {
          homeGoals: rawScore.homeGoals,
          awayGoals: rawScore.awayGoals,
          reasoning: rawScore.reasoning ?? null,
          source: rawScore.source ?? null,
        }
      : null,
    finalResponse: {
      homeGoals: finalScore.homeGoals,
      awayGoals: finalScore.awayGoals,
      reasoning: finalScore.reasoning ?? null,
      source: finalScore.source ?? null,
      calibrationApplied: Boolean(finalScore.calibrationApplied),
    },
  });

  return doc;
}

function teamLabel(team, fallbackId) {
  if (team?.nameEs) return team.nameEs;
  if (team?.nameEn) return team.nameEn;
  if (team?.fifaCode) return team.fifaCode;
  return fallbackId ?? '—';
}

async function resolveAiUser() {
  const email = env.aiUserEmail;
  if (!email) return null;
  return User.findOne({ email, isAiUser: true }).lean();
}

function classifyPredictionState(match, prediction) {
  if (prediction?.userSubmitted) return 'predicha';
  if (match?.status === 'upcoming' && !isPredictionLocked(match)) return 'pendiente';
  return 'faltante';
}

export function buildAiCompetitorStats(scoredPredictions, stateCounts, partidosTotales) {
  let difGl = 0;
  let difGv = 0;
  let totalPts = 0;
  let paHits = 0;
  let glHits = 0;
  let gvHits = 0;
  let gtHits = 0;

  for (const p of scoredPredictions) {
    totalPts += p.pointsEarned ?? 0;
    difGl += p.goalDiffHome ?? 0;
    difGv += p.goalDiffAway ?? 0;
    const b = p.pointsBreakdown ?? {};
    if ((b.winner ?? 0) > 0) paHits += 1;
    if ((b.homeGoals ?? 0) > 0) glHits += 1;
    if ((b.awayGoals ?? 0) > 0) gvHits += 1;
    if ((b.totalGoals ?? 0) > 0) gtHits += 1;
  }

  const n = scoredPredictions.length;

  return {
    partidosTotales,
    predichas: stateCounts.predicha ?? 0,
    faltantes: stateCounts.faltante ?? 0,
    pendientes: stateCounts.pendiente ?? 0,
    partidosPuntuados: n,
    puntosTotales: totalPts,
    promedioPuntos: n ? Number((totalPts / n).toFixed(2)) : null,
    gdifCombinado: n ? Number(goalDiffScore(difGl, difGv, n).toFixed(3)) : null,
    gdifObjetivo: 0,
    aciertos: {
      pa: paHits,
      gl: glHits,
      gv: gvHits,
      gt: gtHits,
    },
    tasaAciertoPa: n ? Number(((paHits / n) * 100).toFixed(1)) : null,
  };
}

export async function getAiCompetitorOverview({
  status,
  group,
  matchNumber,
  predictionFilter,
} = {}) {
  const aiUser = await resolveAiUser();
  if (!aiUser) {
    const error = new Error('Usuario IA no configurado');
    error.status = 503;
    throw error;
  }

  const [allMatches, allPredictions] = await Promise.all([
    Match.find({ kickoffAt: { $ne: null } }).lean(),
    Prediction.find({ userId: aiUser._id }).lean(),
  ]);
  allMatches.sort(compareMatchesBySchedule);

  const allPredByMatch = new Map(allPredictions.map((p) => [p.matchId.toString(), p]));
  const globalStateCounts = { predicha: 0, faltante: 0, pendiente: 0 };
  for (const match of allMatches) {
    const state = classifyPredictionState(match, allPredByMatch.get(match._id.toString()) ?? null);
    globalStateCounts[state] = (globalStateCounts[state] ?? 0) + 1;
  }
  const globalScored = allPredictions.filter((p) => p.pointsEarned != null);
  const stats = buildAiCompetitorStats(globalScored, globalStateCounts, allMatches.length);

  const matches = allMatches.filter((match) => {
    if (status && match.status !== status) return false;
    if (group && String(match.group ?? '').toUpperCase() !== String(group).toUpperCase()) return false;
    if (matchNumber && String(match.externalId) !== String(matchNumber)) return false;
    return true;
  });

  if (!matches.length) {
    return {
      stats,
      matches: [],
      aiUserId: aiUser._id.toString(),
    };
  }

  const matchIds = matches.map((m) => m._id);

  const [predictions, logs, teams] = await Promise.all([
    Prediction.find({ userId: aiUser._id, matchId: { $in: matchIds } }).lean(),
    AiCompetitorPredictionLog.find({ userId: aiUser._id, matchId: { $in: matchIds } })
      .sort({ createdAt: -1 })
      .lean(),
    Team.find({
      externalId: {
        $in: matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter(Boolean),
      },
    }).lean(),
  ]);

  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));
  const predByMatch = new Map(predictions.map((p) => [p.matchId.toString(), p]));
  const latestLogByMatch = new Map();
  const latestOfficialLogByMatch = new Map();
  const latestSimulationLogByMatch = new Map();
  for (const log of logs) {
    const key = log.matchId.toString();
    if (!latestLogByMatch.has(key)) latestLogByMatch.set(key, log);
    if (!log.isSimulation && !latestOfficialLogByMatch.has(key)) {
      latestOfficialLogByMatch.set(key, log);
    }
    if (log.isSimulation && !latestSimulationLogByMatch.has(key)) {
      latestSimulationLogByMatch.set(key, log);
    }
  }

  const rows = [];
  for (const match of matches) {
    const key = match._id.toString();
    const prediction = predByMatch.get(key) ?? null;
    const state = classifyPredictionState(match, prediction);

    if (predictionFilter && predictionFilter !== 'all' && state !== predictionFilter) {
      continue;
    }

    const homeTeam = teamMap[match.homeTeamId];
    const awayTeam = teamMap[match.awayTeamId];
    const officialLog = latestOfficialLogByMatch.get(key) ?? null;
    const simulationLog = latestSimulationLogByMatch.get(key) ?? null;
    const displayLog = officialLog ?? latestLogByMatch.get(key) ?? null;
    const predictedAt =
      officialLog?.createdAt ??
      (prediction?.userSubmitted ? prediction.updatedAt ?? prediction.createdAt : null) ??
      null;

    rows.push({
      matchId: key,
      match: matchSnapshot(match, homeTeam, awayTeam),
      predictionState: state,
      prediction: prediction
        ? {
            id: prediction._id.toString(),
            homeGoals: prediction.homeGoals,
            awayGoals: prediction.awayGoals,
            userSubmitted: Boolean(prediction.userSubmitted),
            predictionSource: prediction.predictionSource ?? null,
            pointsEarned: prediction.pointsEarned,
            goalDiffHome: prediction.goalDiffHome,
            goalDiffAway: prediction.goalDiffAway,
            pointsBreakdown: prediction.pointsBreakdown ?? null,
            aiModel: prediction.aiModel ?? null,
            aiCalibrationApplied: Boolean(prediction.aiCalibrationApplied),
            aiReasoning: prediction.aiReasoning ?? null,
          }
        : null,
      predictionReasoning: briefAiReasoning(
        prediction?.aiReasoning ?? officialLog?.finalResponse?.reasoning ?? null
      ),
      postMatchReview: formatPostMatchReviewRowMeta(match, prediction),
      latestLogId: displayLog?._id?.toString() ?? null,
      latestOfficialLogId: officialLog?._id?.toString() ?? null,
      latestSimulationLogId: simulationLog?._id?.toString() ?? null,
      predictedAt: predictedAt ? new Date(predictedAt).toISOString() : null,
      simulationAt: simulationLog?.createdAt
        ? new Date(simulationLog.createdAt).toISOString()
        : null,
      simulationPrediction: simulationLog
        ? { homeGoals: simulationLog.homeGoals, awayGoals: simulationLog.awayGoals }
        : null,
      logCount: logs.filter((l) => l.matchId.toString() === key).length,
      canSimulate: match.status === 'upcoming',
    });
  }

  return {
    stats,
    matches: rows,
    aiUserId: aiUser._id.toString(),
  };
}

export async function upsertAiCompetitorPrediction(matchId, { homeGoals, awayGoals } = {}) {
  const aiUser = await resolveAiUser();
  if (!aiUser) {
    const error = new Error('Usuario IA no configurado');
    error.status = 503;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(matchId)) {
    const error = new Error('matchId inválido');
    error.status = 400;
    throw error;
  }

  const home = Math.floor(Number(homeGoals));
  const away = Math.floor(Number(awayGoals));
  if (!Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0) {
    const error = new Error('homeGoals y awayGoals deben ser números >= 0');
    error.status = 400;
    throw error;
  }

  const match = await Match.findById(matchId);
  if (!match) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }

  const userId = new mongoose.Types.ObjectId(aiUser._id);
  const matchObjectId = match._id;

  let prediction = await Prediction.findOne({ userId, matchId: matchObjectId });
  if (prediction) {
    prediction.homeGoals = home;
    prediction.awayGoals = away;
    prediction.userSubmitted = true;
    prediction.predictionSource = 'admin';
    await prediction.save();
  } else {
    prediction = await Prediction.create({
      userId,
      matchId: matchObjectId,
      homeGoals: home,
      awayGoals: away,
      userSubmitted: true,
      predictionSource: 'admin',
      pointsEarned: null,
      bonusPoint: 0,
      bonusReason: null,
      pointsBreakdown: null,
      goalDiffHome: null,
      goalDiffAway: null,
    });
  }

  if (match.status === 'finished' || match.status === 'live') {
    await recalculateMatchScores(match._id);
    prediction = await Prediction.findById(prediction._id);
  }

  notifyMatchesUpdated({
    reason: 'admin_ai_competitor_prediction',
    matchId: match._id.toString(),
    userId: aiUser._id.toString(),
  });
  notifyLeaderboardUpdated({ reason: 'admin_ai_competitor_prediction' });

  return {
    predictionId: prediction._id.toString(),
    matchId: match._id.toString(),
    homeGoals: prediction.homeGoals,
    awayGoals: prediction.awayGoals,
    userSubmitted: true,
    predictionSource: prediction.predictionSource,
    pointsEarned: prediction.pointsEarned,
    goalDiffHome: prediction.goalDiffHome,
    goalDiffAway: prediction.goalDiffAway,
    pointsBreakdown: prediction.pointsBreakdown ?? null,
  };
}

function emptyOverviewStats() {
  return {
    partidosTotales: 0,
    predichas: 0,
    faltantes: 0,
    pendientes: 0,
    partidosPuntuados: 0,
    puntosTotales: 0,
    promedioPuntos: null,
    gdifCombinado: null,
    gdifObjetivo: 0,
    aciertos: { pa: 0, gl: 0, gv: 0, gt: 0 },
    tasaAciertoPa: null,
  };
}

function matchSnapshot(match, homeTeam, awayTeam) {
  if (!match) return null;
  return {
    id: match._id?.toString(),
    externalId: match.externalId ?? null,
    group: match.group ?? null,
    status: match.status ?? null,
    kickoffAt: match.kickoffAt ?? null,
    homeScore: match.homeScore ?? null,
    awayScore: match.awayScore ?? null,
    label: `${teamLabel(homeTeam, match.homeTeamId)} vs ${teamLabel(awayTeam, match.awayTeamId)}`,
  };
}

export async function listAiCompetitorPredictionLogs({
  matchId,
  matchNumber,
  status,
  limit = 50,
} = {}) {
  const filter = {};

  if (matchId) {
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      const error = new Error('matchId inválido');
      error.status = 400;
      throw error;
    }
    filter.matchId = matchId;
  } else if (matchNumber) {
    const match = await Match.findOne({ externalId: String(matchNumber) }).select('_id').lean();
    if (!match) return [];
    filter.matchId = match._id;
  } else if (status) {
    const matches = await Match.find({ status }).select('_id').lean();
    const ids = matches.map((m) => m._id);
    if (!ids.length) return [];
    filter.matchId = { $in: ids };
  }

  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const logs = await AiCompetitorPredictionLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(capped)
    .lean();

  if (!logs.length) return [];

  const matchIds = [...new Set(logs.map((l) => l.matchId?.toString()).filter(Boolean))];
  const predictionIds = [...new Set(logs.map((l) => l.predictionId?.toString()).filter(Boolean))];

  const [matches, predictions] = await Promise.all([
    Match.find({ _id: { $in: matchIds } }).lean(),
    predictionIds.length
      ? Prediction.find({ _id: { $in: predictionIds } })
          .select('pointsEarned goalDiffHome goalDiffAway pointsBreakdown')
          .lean()
      : [],
  ]);

  const teamIds = new Set();
  for (const m of matches) {
    if (m.homeTeamId) teamIds.add(m.homeTeamId);
    if (m.awayTeamId) teamIds.add(m.awayTeamId);
  }
  const teams = teamIds.size
    ? await Team.find({ externalId: { $in: [...teamIds] } }).lean()
    : [];
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));
  const matchMap = Object.fromEntries(matches.map((m) => [m._id.toString(), m]));
  const predictionMap = Object.fromEntries(predictions.map((p) => [p._id.toString(), p]));

  return logs.map((log) => {
    const match = matchMap[log.matchId?.toString()];
    const homeTeam = match ? teamMap[match.homeTeamId] : null;
    const awayTeam = match ? teamMap[match.awayTeamId] : null;
    const prediction = log.predictionId
      ? predictionMap[log.predictionId.toString()]
      : null;

    return {
      id: log._id.toString(),
      matchId: log.matchId?.toString(),
      predictionId: log.predictionId?.toString() ?? null,
      homeGoals: log.homeGoals,
      awayGoals: log.awayGoals,
      aiModel: log.aiModel,
      aiSource: log.aiSource,
      calibrationApplied: log.calibrationApplied,
      isSimulation: Boolean(log.isSimulation),
      adminNotes: log.adminNotes ?? '',
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
      match: matchSnapshot(match, homeTeam, awayTeam),
      scoring: prediction
        ? {
            pointsEarned: prediction.pointsEarned,
            goalDiffHome: prediction.goalDiffHome,
            goalDiffAway: prediction.goalDiffAway,
            pointsBreakdown: prediction.pointsBreakdown ?? null,
          }
        : null,
    };
  });
}

export async function getAiCompetitorPredictionLogById(id, { includePromptContext = true } = {}) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Log no encontrado');
    error.status = 404;
    throw error;
  }

  const log = await AiCompetitorPredictionLog.findById(id).lean();
  if (!log) {
    const error = new Error('Log no encontrado');
    error.status = 404;
    throw error;
  }

  const [match, prediction] = await Promise.all([
    Match.findById(log.matchId).lean(),
    log.predictionId ? Prediction.findById(log.predictionId).lean() : null,
  ]);

  const teams = match
    ? await Team.find({
        externalId: { $in: [match.homeTeamId, match.awayTeamId].filter(Boolean) },
      }).lean()
    : [];
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  return {
    id: log._id.toString(),
    matchId: log.matchId?.toString(),
    predictionId: log.predictionId?.toString() ?? null,
    homeGoals: log.homeGoals,
    awayGoals: log.awayGoals,
    aiModel: log.aiModel,
    aiSource: log.aiSource,
    calibrationApplied: log.calibrationApplied,
    isSimulation: Boolean(log.isSimulation),
    adminNotes: log.adminNotes ?? '',
    ...(includePromptContext ? { promptContext: log.promptContext } : {}),
    rawResponse: log.rawResponse,
    finalResponse: log.finalResponse,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    match: matchSnapshot(
      match,
      match ? teamMap[match.homeTeamId] : null,
      match ? teamMap[match.awayTeamId] : null
    ),
    scoring: prediction
      ? {
          pointsEarned: prediction.pointsEarned,
          goalDiffHome: prediction.goalDiffHome,
          goalDiffAway: prediction.goalDiffAway,
          pointsBreakdown: prediction.pointsBreakdown ?? null,
        }
      : null,
  };
}

export async function updateAiCompetitorPredictionLogNotes(id, adminNotes) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Log no encontrado');
    error.status = 404;
    throw error;
  }

  const notes = String(adminNotes ?? '').trim().slice(0, 4000);
  const log = await AiCompetitorPredictionLog.findByIdAndUpdate(
    id,
    { $set: { adminNotes: notes } },
    { new: true }
  ).lean();

  if (!log) {
    const error = new Error('Log no encontrado');
    error.status = 404;
    throw error;
  }

  return { id: log._id.toString(), adminNotes: log.adminNotes ?? '' };
}
