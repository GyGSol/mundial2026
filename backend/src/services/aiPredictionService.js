import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Player } from '../models/Player.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { isPredictionLocked } from './predictionLockService.js';
import { computeGroupStandings } from './worldCupStatsService.js';
import {
  buildUserPredictedMatchContext,
  isOfficialKnockoutMatch,
} from './predictedMatchContextService.js';
import { notifyMatchesUpdated } from './websocketService.js';

const MAX_GOALS = 10;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const AI_REASONING_MAX_LEN = 500;
const AI_FOLLOWUP_MAX_LEN = 1200;
const AI_FOLLOWUP_QUESTION_MAX_LEN = 500;

/** Partido en ventana T-90 ± window si kickoff cae en [now+lead-window, now+lead+window]. */
export function isInAiPredictionWindow(match, now = Date.now()) {
  if (!match?.kickoffAt || match.status !== 'upcoming') return false;
  const kickoffMs = new Date(match.kickoffAt).getTime();
  const lead = env.aiPredictLeadMs;
  const window = env.aiPredictWindowMs;
  const minKickoff = now + lead - window;
  const maxKickoff = now + lead + window;
  return kickoffMs >= minKickoff && kickoffMs <= maxKickoff;
}

export function parseGeminiJsonResponse(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        return null;
      }
    }

    const braceMatch = trimmed.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function clampGoals(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 0 || rounded > MAX_GOALS) return null;
  return rounded;
}

function standingRowForTeam(standingsByGroup, team) {
  if (!team?.group) return null;
  const teamId = team.externalId ?? team.teamId;
  if (!teamId) return null;
  const groupTable = standingsByGroup.find(
    (g) => g.group === String(team.group).toUpperCase()
  );
  return groupTable?.standings?.find((row) => row.teamId === teamId) ?? null;
}

function avgGoalsPerMatch(row) {
  const played = Number(row?.played ?? 0);
  if (played <= 0) return { for: 1.1, against: 1.1 };
  return {
    for: Number(row.goalsFor ?? 0) / played,
    against: Number(row.goalsAgainst ?? 0) / played,
  };
}

/** Fallback Poisson simplificado a partir de promedios de grupo. */
export function computeHeuristicScore(context) {
  const homeRow = standingRowForTeam(context.groupStandings, context.homeTeam);
  const awayRow = standingRowForTeam(context.groupStandings, context.awayTeam);

  const homeAvg = avgGoalsPerMatch(homeRow);
  const awayAvg = avgGoalsPerMatch(awayRow);

  const homeExpected = homeAvg.for * 0.55 + awayAvg.against * 0.45;
  const awayExpected = awayAvg.for * 0.55 + homeAvg.against * 0.45;

  let homeGoals = clampGoals(Math.round(homeExpected)) ?? 1;
  let awayGoals = clampGoals(Math.round(awayExpected)) ?? 1;

  if (homeGoals === 0 && awayGoals === 0) {
    homeGoals = 1;
    awayGoals = 1;
  }

  return {
    homeGoals,
    awayGoals,
    reasoning: 'Heurística local (promedios de grupo)',
    source: 'heuristic',
  };
}

export async function getAiUser() {
  const email = env.aiUserEmail;
  if (!email) return null;
  return User.findOne({ email, isAiUser: true });
}

async function countInjuredPlayers(teamExternalId) {
  if (!teamExternalId) return 0;
  return Player.countDocuments({
    teamExternalId,
    healthStatus: { $in: ['injured', 'doubt'] },
  });
}

export async function buildPromptContext(match, aiUserId) {
  const [homeTeam, awayTeam, teams, allMatches, groups] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
    Team.find({ group: { $exists: true, $ne: '' } }).lean(),
    Match.find().sort({ kickoffAt: 1 }).lean(),
    Group.find().lean(),
  ]);

  const groupStandings = computeGroupStandings(teams, allMatches, groups);
  const isKnockout = isOfficialKnockoutMatch(match);

  let resolvedHome = homeTeam;
  let resolvedAway = awayTeam;

  if (isKnockout && aiUserId) {
    const ctx = await buildUserPredictedMatchContext(aiUserId);
    const resolved = ctx.resolvedKnockoutByExternalId?.get(String(match.externalId));
    if (resolved?.homeTeam?.externalId) {
      resolvedHome =
        ctx.teamMap[resolved.homeTeam.externalId] ??
        (await Team.findOne({ externalId: resolved.homeTeam.externalId }).lean()) ??
        homeTeam;
    }
    if (resolved?.awayTeam?.externalId) {
      resolvedAway =
        ctx.teamMap[resolved.awayTeam.externalId] ??
        (await Team.findOne({ externalId: resolved.awayTeam.externalId }).lean()) ??
        awayTeam;
    }
  }

  const [homeInjuries, awayInjuries] = await Promise.all([
    countInjuredPlayers(resolvedHome?.externalId),
    countInjuredPlayers(resolvedAway?.externalId),
  ]);

  const relevantGroup = match.group
    ? groupStandings.find((g) => g.group === String(match.group).toUpperCase())
    : null;

  return {
    matchExternalId: match.externalId,
    phase: isKnockout ? 'knockout' : 'group',
    group: match.group ?? null,
    matchday: match.matchday ?? null,
    kickoffAt: match.kickoffAt?.toISOString?.() ?? match.kickoffAt,
    homeTeam: resolvedHome
      ? {
          externalId: resolvedHome.externalId,
          name: resolvedHome.nameEn,
          code: resolvedHome.fifaCode,
          group: resolvedHome.group,
        }
      : { externalId: match.homeTeamId, name: match.homeTeamId, code: null, group: null },
    awayTeam: resolvedAway
      ? {
          externalId: resolvedAway.externalId,
          name: resolvedAway.nameEn,
          code: resolvedAway.fifaCode,
          group: resolvedAway.group,
        }
      : { externalId: match.awayTeamId, name: match.awayTeamId, code: null, group: null },
    groupStandings: relevantGroup
      ? relevantGroup.standings.map((row) => ({
          rank: row.rank,
          team: row.nameEn ?? row.teamId,
          played: row.played,
          points: row.points,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
        }))
      : [],
    injuries: {
      home: homeInjuries,
      away: awayInjuries,
    },
  };
}

function buildAiPredictionPrompt(context) {
  return `Sos un analista de fútbol para el Mundial FIFA 2026. Predecí el marcador final del partido.

Respondé ÚNICAMENTE con JSON válido (sin markdown):
{"homeGoals": <entero 0-10>, "awayGoals": <entero 0-10>, "reasoning": "<breve explicación en español>"}

Contexto del partido:
${JSON.stringify(context, null, 2)}`;
}

function parseAiScoreResponse(text, source) {
  const parsed = parseGeminiJsonResponse(text);
  const homeGoals = clampGoals(parsed?.homeGoals);
  const awayGoals = clampGoals(parsed?.awayGoals);

  if (homeGoals === null || awayGoals === null) {
    throw new Error(`${source} devolvió JSON inválido`);
  }

  return {
    homeGoals,
    awayGoals,
    reasoning: String(parsed?.reasoning ?? '').slice(0, AI_REASONING_MAX_LEN),
    source,
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGroqForScore(context, { fetchImpl = fetch } = {}) {
  const apiKey = env.groqApiKey;
  if (!apiKey) {
    return null;
  }

  const body = {
    model: env.aiGroqModel,
    messages: [{ role: 'user', content: buildAiPredictionPrompt(context) }],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  };

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 && attempt < 2) {
        await sleep(1000 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Groq HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      return parseAiScoreResponse(text, 'groq');
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await sleep(800 * (attempt + 1));
      }
    }
  }

  console.warn('AI prediction Groq failed:', lastError?.message ?? lastError);
  return null;
}

export async function callGeminiForScore(context, { fetchImpl = fetch } = {}) {
  const apiKey = env.googleAiApiKey;
  if (!apiKey) {
    const groqScore = await callGroqForScore(context, { fetchImpl });
    return groqScore ?? computeHeuristicScore(context);
  }

  const url = `${GEMINI_API_BASE}/${env.aiGeminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: buildAiPredictionPrompt(context) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  };

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 429 && attempt < 2) {
        await sleep(1000 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Gemini HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
      return parseAiScoreResponse(text, 'gemini');
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await sleep(800 * (attempt + 1));
      }
    }
  }

  console.warn('AI prediction Gemini failed, trying Groq:', lastError?.message ?? lastError);
  const groqScore = await callGroqForScore(context, { fetchImpl });
  if (groqScore) return groqScore;

  return computeHeuristicScore(context);
}

function aiModelForScoreSource(source) {
  if (source === 'gemini') return env.aiGeminiModel;
  if (source === 'groq') return env.aiGroqModel;
  return 'heuristic';
}

export function hasAiProvider() {
  return Boolean(env.googleAiApiKey || env.groqApiKey);
}

function normalizeFollowUpHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => entry && typeof entry.content === 'string')
    .slice(-8)
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.content.trim().slice(0, AI_FOLLOWUP_MAX_LEN),
    }))
    .filter((entry) => entry.content);
}

function buildFollowUpPrompt(context, insight, question, history = []) {
  const historyBlock = history.length
    ? `\nConversación previa:\n${history
        .map((entry) => `${entry.role === 'user' ? 'Usuario' : 'IA'}: ${entry.content}`)
        .join('\n')}\n`
    : '';

  return `Sos un analista de fútbol para el Mundial FIFA 2026. Ya predijiste este partido.

Contexto del partido:
${JSON.stringify(context, null, 2)}

Tu predicción: ${insight.homeGoals}-${insight.awayGoals}
Tu razonamiento: ${insight.reasoning}
${historyBlock}
Pregunta del usuario: ${question}

Respondé en español, de forma clara y breve (máximo 3 párrafos cortos). No cambies el marcador salvo que te lo pidan explícitamente.`;
}

async function callGroqForText(prompt, { fetchImpl = fetch } = {}) {
  const apiKey = env.groqApiKey;
  if (!apiKey) return null;

  const body = {
    model: env.aiGroqModel,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
  };

  const response = await fetchImpl(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Groq HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('Groq devolvió respuesta vacía');
  return { text: text.slice(0, AI_FOLLOWUP_MAX_LEN), source: 'groq' };
}

async function callGeminiForText(prompt, { fetchImpl = fetch } = {}) {
  const apiKey = env.googleAiApiKey;
  if (!apiKey) return null;

  const url = `${GEMINI_API_BASE}/${env.aiGeminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5 },
  };

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = String(data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '').trim();
  if (!text) throw new Error('Gemini devolvió respuesta vacía');
  return { text: text.slice(0, AI_FOLLOWUP_MAX_LEN), source: 'gemini' };
}

export async function callAiForText(prompt, { fetchImpl = fetch } = {}) {
  if (env.googleAiApiKey) {
    try {
      const gemini = await callGeminiForText(prompt, { fetchImpl });
      if (gemini) return gemini;
    } catch (err) {
      console.warn('AI follow-up Gemini failed, trying Groq:', err.message);
      if (env.groqApiKey) {
        return callGroqForText(prompt, { fetchImpl });
      }
      throw err;
    }
  }

  if (env.groqApiKey) {
    return callGroqForText(prompt, { fetchImpl });
  }

  throw new Error('IA no configurada');
}

export function formatMatchAiInsight(score) {
  return {
    homeGoals: score.homeGoals,
    awayGoals: score.awayGoals,
    reasoning: score.reasoning,
    source: score.source,
    model: aiModelForScoreSource(score.source),
  };
}

export async function getMatchAiInsightForUser(matchId, userId, { fetchImpl = fetch } = {}) {
  if (!hasAiProvider()) {
    throw new Error('IA no configurada');
  }

  const match = await Match.findById(matchId).lean();
  if (!match) {
    throw new Error('Match not found');
  }
  if (match.status !== 'upcoming') {
    throw new Error('La consulta IA solo está disponible para partidos próximos');
  }

  const context = await buildPromptContext(match, userId);
  const score = await callGeminiForScore(context, { fetchImpl });
  return formatMatchAiInsight(score);
}

export async function askMatchAiFollowUp(
  matchId,
  userId,
  { question, history = [], insight },
  { fetchImpl = fetch } = {}
) {
  if (!hasAiProvider()) {
    throw new Error('IA no configurada');
  }

  const trimmedQuestion = String(question ?? '').trim();
  if (!trimmedQuestion) {
    throw new Error('Escribí una pregunta');
  }
  if (trimmedQuestion.length > AI_FOLLOWUP_QUESTION_MAX_LEN) {
    throw new Error('La pregunta es demasiado larga');
  }

  const homeGoals = clampGoals(insight?.homeGoals);
  const awayGoals = clampGoals(insight?.awayGoals);
  const reasoning = String(insight?.reasoning ?? '').trim();
  if (homeGoals === null || awayGoals === null || !reasoning) {
    throw new Error('Predicción IA inválida');
  }

  const match = await Match.findById(matchId).lean();
  if (!match) {
    throw new Error('Match not found');
  }
  if (match.status !== 'upcoming') {
    throw new Error('La consulta IA solo está disponible para partidos próximos');
  }

  const context = await buildPromptContext(match, userId);
  const prompt = buildFollowUpPrompt(
    context,
    { homeGoals, awayGoals, reasoning },
    trimmedQuestion,
    normalizeFollowUpHistory(history)
  );

  const result = await callAiForText(prompt, { fetchImpl });
  return {
    answer: result.text,
    source: result.source,
    model: aiModelForScoreSource(result.source),
  };
}

export async function submitAiPrediction(userId, matchId, { homeGoals, awayGoals, aiModel, aiReasoning }) {
  const match = await Match.findById(matchId);
  if (!match) {
    throw new Error('Match not found');
  }
  if (isPredictionLocked(match)) {
    throw new Error('Prediction window closed');
  }

  const prediction = await Prediction.findOneAndUpdate(
    { userId, matchId: match._id },
    {
      homeGoals,
      awayGoals,
      userSubmitted: true,
      pointsEarned: null,
      pointsBreakdown: null,
      predictionSource: 'ai',
      aiModel: aiModel ?? env.aiGeminiModel,
      aiReasoning: aiReasoning?.slice(0, AI_REASONING_MAX_LEN) ?? null,
    },
    { upsert: true, new: true }
  );

  notifyMatchesUpdated({
    reason: 'ai_prediction_saved',
    matchId: match._id.toString(),
    userId: userId.toString(),
  });

  return prediction;
}

export async function findMatchesDueForAiPrediction(aiUserId, now = Date.now()) {
  const upcoming = await Match.find({
    status: 'upcoming',
    kickoffAt: { $ne: null },
  }).lean();

  const inWindow = upcoming.filter((match) => {
    if (isPredictionLocked(match)) return false;
    return isInAiPredictionWindow(match, now);
  });

  if (!inWindow.length) return [];

  const matchIds = inWindow.map((m) => m._id);
  const existing = await Prediction.find({
    userId: aiUserId,
    matchId: { $in: matchIds },
    userSubmitted: true,
  }).select('matchId');

  const submittedIds = new Set(existing.map((p) => p.matchId.toString()));
  return inWindow.filter((m) => !submittedIds.has(m._id.toString()));
}

export async function runAiPredictionTick({ now = Date.now(), fetchImpl = fetch } = {}) {
  if (!env.aiPredictionsEnabled) {
    return { processed: 0, skipped: 0, errors: [] };
  }

  const aiUser = await getAiUser();
  if (!aiUser) {
    return { processed: 0, skipped: 0, errors: ['AI user not found or not marked isAiUser'] };
  }

  const dueMatches = await findMatchesDueForAiPrediction(aiUser._id, now);
  let processed = 0;
  let skipped = 0;
  const errors = [];

  for (const match of dueMatches) {
    try {
      const context = await buildPromptContext(match, aiUser._id);
      const score = await callGeminiForScore(context, { fetchImpl });
      await submitAiPrediction(aiUser._id, match._id, {
        homeGoals: score.homeGoals,
        awayGoals: score.awayGoals,
        aiModel: aiModelForScoreSource(score.source),
        aiReasoning: score.reasoning,
      });

      const homeCode = context.homeTeam?.code ?? '?';
      const awayCode = context.awayTeam?.code ?? '?';
      console.log(
        `AI prediction: ${homeCode} ${score.homeGoals}-${score.awayGoals} ${awayCode} (match ${match.externalId}, ${score.source})`
      );
      processed += 1;
    } catch (err) {
      errors.push(`${match.externalId}: ${err.message}`);
      console.error(`AI prediction error (${match.externalId}):`, err.message);
    }
  }

  skipped = dueMatches.length - processed - errors.length;
  return { processed, skipped, errors };
}
