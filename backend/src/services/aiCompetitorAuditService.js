import mongoose from 'mongoose';
import { AiCompetitorPredictionLog } from '../models/AiCompetitorPredictionLog.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import { humanizePromptContext } from './aiPromptHumanizer.js';
import { env } from '../config/env.js';

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

export async function saveAiCompetitorPredictionLog({
  userId,
  matchId,
  predictionId,
  context,
  rawScore,
  finalScore,
}) {
  const promptContext = buildAuditPromptContext(context);
  const doc = await AiCompetitorPredictionLog.create({
    userId,
    matchId,
    predictionId: predictionId ?? null,
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

export async function getAiCompetitorPredictionLogById(id) {
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
    adminNotes: log.adminNotes ?? '',
    promptContext: log.promptContext,
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
