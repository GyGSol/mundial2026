import { Match } from '../models/Match.js';
import { Stadium } from '../models/Stadium.js';
import { Team } from '../models/Team.js';
import { AiConsultation } from '../models/AiConsultation.js';
import { GROUP_LETTERS } from '../services/simulationTournamentService.js';
import { buildUserPredictedMatchContext } from './predictedMatchContextService.js';
import {
  aiModelForScoreSource,
  AI_QUESTION_MAX_LEN,
  buildPromptContext,
  buildVenueContextForPrompt,
  callAiForScore,
  callAiForText,
  enrichVenueWithWeather,
  formatMatchAiInsight,
  hasAiProvider,
  WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS,
} from './aiPredictionService.js';
import { formatStadiumForClient } from './stadiumPayload.js';
import {
  getVenueWeatherForStadium,
  formatWeatherForPrompt,
  formatWeatherForClient,
  buildMatchWeatherPredictionContext,
} from './weatherService.js';
import { assessVenueWeatherRisk, formatWeatherRiskForClient } from './weatherRiskService.js';
import { buildLiveScheduleContext } from './liveScheduleOverlapService.js';
import { serializeWeatherOpsForClient } from './matchWeatherOpsRules.js';

const AI_HISTORY_FOR_PROMPT = 20;
const AI_MESSAGES_STORED_MAX = 80;

export const AI_TOPIC_TYPES = ['match', 'group', 'round_of_16'];

export function normalizeTopicKey(topicType, topicKey) {
  const raw = String(topicKey ?? '').trim();
  if (topicType === 'group') return raw.toUpperCase();
  if (topicType === 'round_of_16') return 'round_of_16';
  return raw;
}

export function isValidTopic(topicType, topicKey) {
  if (!AI_TOPIC_TYPES.includes(topicType)) return false;
  const key = normalizeTopicKey(topicType, topicKey);
  if (topicType === 'group') return GROUP_LETTERS.includes(key);
  if (topicType === 'round_of_16') return key === 'round_of_16';
  return Boolean(key);
}

function trimMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-AI_MESSAGES_STORED_MAX);
}

function historyForPrompt(thread) {
  const entries = [];

  if (thread.initialInsight?.reasoning) {
    const { homeGoals, awayGoals, reasoning } = thread.initialInsight;
    entries.push({
      role: 'assistant',
      content: `Predicción inicial: ${homeGoals}-${awayGoals}. ${reasoning}`,
    });
  }

  for (const msg of thread.messages ?? []) {
    entries.push({ role: msg.role, content: msg.content });
  }

  return entries
    .filter((entry) => entry.content?.trim())
    .slice(-AI_HISTORY_FOR_PROMPT);
}

async function resolveMatchTitle(match) {
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);
  const home = homeTeam?.fifaCode ?? homeTeam?.nameEn ?? match.homeTeamId;
  const away = awayTeam?.fifaCode ?? awayTeam?.nameEn ?? match.awayTeamId;
  return `${home} vs ${away}`;
}

export async function buildTopicTitle(topicType, topicKey) {
  const key = normalizeTopicKey(topicType, topicKey);
  if (topicType === 'group') return `Grupo ${key}`;
  if (topicType === 'round_of_16') return 'Clasificación a 16avos';

  const match = await Match.findById(key).lean();
  if (!match) return 'Partido';
  return resolveMatchTitle(match);
}

export function formatThreadResponse(doc) {
  if (!doc) return null;
  const thread = doc.toObject ? doc.toObject() : doc;
  return {
    id: thread._id?.toString?.() ?? thread.id,
    topicType: thread.topicType,
    topicKey: thread.topicKey,
    title: thread.title,
    initialInsight: thread.initialInsight ?? null,
    messages: (thread.messages ?? []).map((msg) => ({
      id: msg._id?.toString?.(),
      role: msg.role,
      content: msg.content,
      source: msg.source ?? null,
      model: msg.model ?? null,
      createdAt: msg.createdAt,
    })),
    updatedAt: thread.updatedAt,
    createdAt: thread.createdAt,
  };
}

export async function buildMatchVenueContext(matchId, { fetchImpl = fetch } = {}) {
  const match = await Match.findById(matchId).lean();
  if (!match) return null;

  const stadium = match.stadiumId
    ? await Stadium.findOne({ externalId: match.stadiumId }).lean()
    : null;

  const weatherRaw = await getVenueWeatherForStadium(stadium, {
    kickoffAt: match.kickoffAt,
    fetchImpl,
  });
  const venue = buildVenueContextForPrompt(match, stadium);
  const matchWeather = buildMatchWeatherPredictionContext(weatherRaw);
  const weatherRisk = formatWeatherRiskForClient(
    await assessVenueWeatherRisk(stadium, { weather: weatherRaw, kickoffAt: match.kickoffAt, fetchImpl })
  );
  const allMatches = await Match.find().select('_id group matchday kickoffAt status weatherOps homeTeamId awayTeamId').lean();
  const liveScheduleContext = buildLiveScheduleContext(match, allMatches);

  return {
    kickoffAt: match.kickoffAt?.toISOString?.() ?? match.kickoffAt ?? null,
    stadium: formatStadiumForClient(stadium),
    weatherOps: serializeWeatherOpsForClient(match.weatherOps),
    weatherRisk,
    liveScheduleContext,
    venue: {
      ...venue,
      analysisHints:
        matchWeather.status === 'ok'
          ? [
              'Clima del partido: usar venue.matchWeather.kickoffForecast (panel Sede y clima).',
              'Evaluar aclimatación según temperatura, humedad, viento y lluvia del kickoff.',
            ]
          : venue.analysisHints,
      weather: formatWeatherForPrompt(weatherRaw),
      matchWeather,
    },
    weather: formatWeatherForClient(weatherRaw),
  };
}

export async function getConsultationThread(userId, topicType, topicKey) {
  if (!isValidTopic(topicType, topicKey)) {
    throw new Error('Tema de consulta inválido');
  }

  const key = normalizeTopicKey(topicType, topicKey);
  const thread = await AiConsultation.findOne({ userId, topicType, topicKey: key });
  const matchVenue =
    topicType === 'match' ? await buildMatchVenueContext(key) : null;
  return {
    thread: formatThreadResponse(thread),
    matchVenue,
  };
}

export async function listConsultationThreads(userId, { limit = 30 } = {}) {
  const threads = await AiConsultation.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return threads.map((thread) => ({
    id: thread._id.toString(),
    topicType: thread.topicType,
    topicKey: thread.topicKey,
    title: thread.title,
    messageCount: thread.messages?.length ?? 0,
    hasInsight: Boolean(thread.initialInsight?.reasoning),
    lastMessageAt:
      thread.messages?.length > 0
        ? thread.messages[thread.messages.length - 1].createdAt
        : thread.updatedAt,
    updatedAt: thread.updatedAt,
  }));
}

async function getOrCreateThread(userId, topicType, topicKey) {
  const key = normalizeTopicKey(topicType, topicKey);
  let thread = await AiConsultation.findOne({ userId, topicType, topicKey: key });
  if (!thread) {
    const title = await buildTopicTitle(topicType, key);
    thread = await AiConsultation.create({
      userId,
      topicType,
      topicKey: key,
      title,
      messages: [],
    });
  } else if (!thread.title) {
    thread.title = await buildTopicTitle(topicType, key);
    await thread.save();
  }
  return thread;
}

async function buildGroupContext(userId, groupLetter) {
  const ctx = await buildUserPredictedMatchContext(userId);
  const groupEntry = ctx.groups.find((g) => g.group === groupLetter);
  const groupMatches = (await Match.find({ group: groupLetter }).sort({ kickoffAt: 1 }).lean()).map(
    (match) => ({
      externalId: match.externalId,
      status: match.status,
      kickoffAt: match.kickoffAt,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    })
  );

  const standings = groupEntry?.standings ?? [];
  return {
    topic: `Grupo ${groupLetter}`,
    projectedStandings: standings,
    projectedQualifiers: standings
      .filter((row) => row.qualificationZone && row.qualificationZone !== 'third_possible')
      .map((row) => ({
        rank: row.rank,
        team: row.nameEn ?? row.teamId,
        zone: row.qualificationZone,
      })),
    fixtures: groupMatches,
    userKnockoutProgress: ctx.knockout?.progress ?? null,
  };
}

async function buildRoundOf16Context(userId) {
  const ctx = await buildUserPredictedMatchContext(userId);
  return {
    topic: 'Clasificación a dieciseisavos de final',
    groups: ctx.groups.map((g) => ({
      group: g.group,
      standings: g.standings,
      projectedQualifiers: (g.standings ?? [])
        .filter((row) => row.qualificationZone && row.qualificationZone !== 'third_possible')
        .map((row) => ({
          rank: row.rank,
          team: row.nameEn ?? row.teamId,
          zone: row.qualificationZone,
        })),
    })),
    bestThirdPlaces: ctx.thirdPlaceRanked?.ranked ?? [],
    thirdPlaceCombinationKey: ctx.thirdPlaceRanked?.combinationKey ?? null,
    knockoutPhases: (ctx.knockout?.phases ?? []).map((phase) => ({
      key: phase.key,
      label: phase.label,
      matches: phase.matches.map((m) => ({
        externalId: m.externalId,
        label: m.label,
        homeTeam: m.homeTeam?.fifaCode ?? m.homeTeamSlotLabel,
        awayTeam: m.awayTeam?.fifaCode ?? m.awayTeamSlotLabel,
      })),
    })),
  };
}

async function buildTopicContext(userId, topicType, topicKey) {
  const key = normalizeTopicKey(topicType, topicKey);
  if (topicType === 'match') {
    const match = await Match.findById(key).lean();
    if (!match) throw new Error('Partido no encontrado');
    return buildPromptContext(match, userId);
  }
  if (topicType === 'group') return buildGroupContext(userId, key);
  if (topicType === 'round_of_16') return buildRoundOf16Context(userId);
  throw new Error('Tema de consulta inválido');
}

function topicInstructions(topicType) {
  if (topicType === 'match') {
    return `${WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS}

Analizá el partido según el contexto, la sede del estadio y venue.matchWeather (panel Sede y clima). Para el pronóstico y el clima en tus respuestas, usá venue.matchWeather.kickoffForecast cuando status=ok. Usá weatherOps, weatherRisk y liveScheduleContext: si hay demora NOAA (pre_kickoff_delay/suspended) o integrityWarning en parejas de grupo, mencionarlo. Si ya diste una predicción inicial, mantené coherencia salvo que te pidan cambiarla.`;
  }
  if (topicType === 'group') {
    return 'Proyectá resultados del grupo completo según las predicciones del usuario y el fixture restante. Podés estimar la tabla final y quién clasifica.';
  }
  return 'Explicá quién clasifica a los dieciseisavos (1° y 2° de cada grupo y mejores terceros) según las predicciones del usuario. Sé concreto con equipos y cruces.';
}

function buildConsultationPrompt(topicType, context, thread, question) {
  const history = historyForPrompt(thread);
  const historyBlock = history.length
    ? `\nConversación previa:\n${history
        .map((entry) => `${entry.role === 'user' ? 'Usuario' : 'IA'}: ${entry.content}`)
        .join('\n')}\n`
    : '';

  return `Sos un analista de fútbol para el Mundial FIFA 2026.

${topicInstructions(topicType)}

Contexto:
${JSON.stringify(context, null, 2)}
${historyBlock}
Pregunta del usuario: ${question}

Respondé en español, claro y completo. Usá markdown ligero cuando ayude (negritas, listas, tablas). No uses HTML ni bloques de código. Usá datos del contexto y la conversación previa.`;
}

function formatInsightMessage(insight) {
  return `Mi predicción: ${insight.homeGoals}-${insight.awayGoals}\n\n${insight.reasoning}`;
}

async function appendExchange(thread, question, answer) {
  const now = new Date();
  thread.messages.push(
    { role: 'user', content: question, createdAt: now },
    {
      role: 'assistant',
      content: answer.text,
      source: answer.source,
      model: answer.model,
      createdAt: new Date(),
    }
  );
  thread.messages = trimMessages(thread.messages);
  await thread.save();
}

export async function generateMatchInsight(userId, matchId, { fetchImpl = fetch } = {}) {
  if (!hasAiProvider()) throw new Error('IA no configurada');

  const match = await Match.findById(matchId).lean();
  if (!match) throw new Error('Partido no encontrado');

  const thread = await getOrCreateThread(userId, 'match', matchId);
  const isUpdate = Boolean(thread.initialInsight?.reasoning);

  const context = await buildPromptContext(match, userId);
  const score = await callAiForScore(context, { fetchImpl });
  const insight = formatMatchAiInsight(score);

  thread.initialInsight = {
    ...insight,
    predictedAt: new Date(),
  };
  thread.title = await resolveMatchTitle(match);
  const insightText = isUpdate
    ? `Predicción actualizada:\n\n${formatInsightMessage(insight)}`
    : formatInsightMessage(insight);
  thread.messages.push({
    role: 'assistant',
    content: insightText,
    source: insight.source,
    model: insight.model,
    createdAt: new Date(),
  });
  thread.messages = trimMessages(thread.messages);
  await thread.save();

  const matchVenue = await buildMatchVenueContext(matchId, { fetchImpl });
  return {
    thread: formatThreadResponse(thread),
    matchVenue,
  };
}

export async function askConsultation(
  userId,
  { topicType, topicKey, question, action },
  { fetchImpl = fetch } = {}
) {
  if (!hasAiProvider()) throw new Error('IA no configurada');
  if (!isValidTopic(topicType, topicKey)) throw new Error('Tema de consulta inválido');

  const key = normalizeTopicKey(topicType, topicKey);

  if (topicType === 'match' && action === 'insight') {
    return generateMatchInsight(userId, key, { fetchImpl });
  }

  const trimmedQuestion = String(question ?? '').trim();
  if (!trimmedQuestion) {
    throw new Error('Escribí una pregunta');
  }
  if (trimmedQuestion.length > AI_QUESTION_MAX_LEN) {
    throw new Error('La pregunta es demasiado larga');
  }

  const thread = await getOrCreateThread(userId, topicType, key);
  const context = await buildTopicContext(userId, topicType, key);
  const prompt = buildConsultationPrompt(topicType, context, thread, trimmedQuestion);
  const result = await callAiForText(prompt, { fetchImpl });

  await appendExchange(thread, trimmedQuestion, {
    text: result.text,
    source: result.source,
    model: aiModelForScoreSource(result.source),
  });

  const updated = await AiConsultation.findById(thread._id);
  const matchVenue =
    topicType === 'match' ? await buildMatchVenueContext(key, { fetchImpl }) : null;
  return {
    thread: formatThreadResponse(updated),
    matchVenue,
    reply: {
      answer: result.text,
      source: result.source,
      model: updated.messages[updated.messages.length - 1]?.model ?? null,
    },
  };
}
