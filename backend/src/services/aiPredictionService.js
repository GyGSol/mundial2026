import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Stadium } from '../models/Stadium.js';
import { User } from '../models/User.js';
import { resolveStadiumTimezone } from './stadiumTimezones.js';
import { buildMatchTeamsAnalysis } from './aiTeamMatchContextService.js';
import { buildEnrichedMatchContext } from './aiMatchEnrichedContextService.js';
import { env } from '../config/env.js';
import { isPredictionLocked } from './predictionLockService.js';
import { computeGroupStandings } from './worldCupStatsService.js';
import {
  buildUserPredictedMatchContext,
  isOfficialKnockoutMatch,
} from './predictedMatchContextService.js';
import { notifyMatchesUpdated } from './websocketService.js';
import { getVenueWeatherForStadium, formatWeatherForPrompt, buildMatchWeatherPredictionContext } from './weatherService.js';
import { assessVenueWeatherRisk, formatWeatherRiskForClient } from './weatherRiskService.js';
import { buildLiveScheduleContext } from './liveScheduleOverlapService.js';
import { serializeWeatherOpsForClient } from './matchWeatherOpsRules.js';
import {
  humanizePromptContext,
  sanitizeAiUserFacingText,
  WORLD_CUP_USER_FACING_LANGUAGE_RULES,
} from './aiPromptHumanizer.js';
import { buildMatchHistoryContext } from './aiMatchHistoryContextService.js';
import {
  buildMatchStakesContext,
  buildTablaYClasificacionContext,
} from './aiMatchStakesContextService.js';
import {
  buildCrowdContextForCompetitor,
  pickFocusGroupId,
} from './aiCrowdPredictionContextService.js';
import { buildPrizeRaceContext } from './aiPrizeRaceContextService.js';
import {
  applyCalibrationNudge,
  buildCalibrationPromptBlock,
  loadAiCalibrationStats,
} from './aiPredictionCalibrationService.js';
import { saveAiCompetitorPredictionLog } from './aiCompetitorAuditService.js';
import {
  fetchExternalMatchIntel,
  formatExternalIntelForPrompt,
  scoreFromExternalIntel,
} from './externalMatchIntelService.js';
import { refreshTeamPlayerIntel } from './aiPlayerIntelService.js';

const MAX_GOALS = 10;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Máximo de caracteres en preguntas del usuario (no aplica a respuestas de la IA). */
export const AI_QUESTION_MAX_LEN = 146;

/** Instrucciones compartidas: local/visitante en el Mundial es solo fixture, no sede del equipo. */
export const WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS = `IMPORTANTE — Copa del Mundo FIFA 2026:
- "Local" y "visitante" (home/away) son SOLO la posición en el fixture; NO indican sede nacional del equipo ni ventaja de localía de clubes o ligas.
- No asumas que el "local" juega en su país. Ambos seleccionados son visitantes en el país/ciudad donde se disputa el partido.
- Analizá el partido según la sede real: estadio, ciudad, país anfitrión y horario local del kickoff.
- Para el clima del partido usá EXCLUSIVAMENTE venue.matchWeather (panel Sede y clima, Open-Meteo). Si status=ok, el pronóstico al kickoff es la fuente autoritativa: temperatura, humedad, viento y lluvia del horario del partido.
- NO estimes ni inventes clima cuando venue.matchWeather.status=ok. NO uses clima típico de junio-julio ni reemplaces por morale.venueClimate heurístico si hay kickoffForecast.
- El factor sede aplica por ubicación del estadio (desplazamiento, aclimatación, calor, altura), no por quién figura como "local" en el fixture.
- Usá ranking FIFA, resultados previos del torneo 2026, poder ofensivo/defensivo, historial en Mundiales y enfrentamientos directos del contexto cuando estén disponibles.
- Usá nationContext: historial Wikipedia (wikiRecords, finalHighlights), población, liga doméstica, talentPoolIndex y factores anímicos (morale).
- Usá análisisPlantilla (o squadAnalysis en contexto crudo): titulares probables, lesionados, en duda, suspendidos y riesgo de tarjetas.
- Usá duelosPorPuesto (o positionMatchups): compará portería, defensa, mediocampo y delantera para ponderar el marcador.
- Usá venue.matchWeather.kickoffForecast para ponderar ritmo, desgaste, errores técnicos y adaptación de cada selección al calor/humedad/viento/lluvia del kickoff.
- Usá weatherOps y weatherRisk: si phase=pre_kickoff_delay o suspended, el partido está demorado por clima. En sedes USA aplica protocolo NOAA (8 mi / 30 min); en Canadá alertas MSC; en México protocolo local SMN con señal Open-Meteo. Si liveScheduleContext.integrityWarning existe, advertí desbalance en parejas de grupo simultáneas.`;

/** Solo para predicción automática del competidor IA (maximizar puntos). */
export const AI_COMPETITOR_SCORING_INSTRUCTIONS = `OBJETIVO — Maximizar puntos en el juego de predicciones (máx. 6 pts base por partido):
1. Prioridad #1: acertar ganador o empate (PA = 3 pts). Definí primero el outcome más probable.
2. Luego afiná goles local (GL), visitante (GV) y total (GT), 1 pt c/u.
3. Minimizá error de marcador (Gdif): evitá resultados llamativos sin respaldo en datos.
4. En eliminatorias: predicción = resultado a 90 minutos (sin penales). Empate es válido.
5. Usá mercadoYxG como señal fuerte si existe; ajustá con lesiones, clima y stakes.
6. Usá inteligenciaGrupo.consensoPartido como señal secundaria (no copies al grupo).
7. Si carreraPremios.diferenciaAlCorte ≤ 6 pts y no estás en zona de premio: priorizá PA sobre marcador exacto.
8. Nunca cites nombres de otros jugadores ni sus predicciones individuales; solo agregados del grupo.`;

export function formatKickoffLocalDescription(kickoffAt, timezone) {
  if (!kickoffAt || !timezone) return null;
  try {
    const date = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return null;
  }
}

export function buildVenueContextForPrompt(match, stadium) {
  const timezone =
    match?.kickoffTimezone ||
    stadium?.timezone ||
    resolveStadiumTimezone(stadium) ||
    null;

  return {
    fixtureNote:
      'En el Mundial, local/visitante es solo orden en el fixture; no implica que el local juegue en su país.',
    stadium: stadium
      ? {
          name: stadium.nameEn ?? null,
          city: stadium.city ?? null,
          country: stadium.country ?? null,
          timezone,
          capacity: stadium.capacity > 0 ? stadium.capacity : null,
        }
      : null,
    kickoffUtc: match?.kickoffAt?.toISOString?.() ?? match?.kickoffAt ?? null,
    kickoffLocal: formatKickoffLocalDescription(match?.kickoffAt, timezone),
    analysisHints: [
      'Si venue.matchWeather.status=ok, usar kickoffForecast como clima del partido (panel Sede y clima).',
      'Sin datos de clima: no inventes temperatura, humedad ni lluvia concretas; mencioná solo incertidumbre.',
      'Considerar viaje y aclimatación de ambos equipos respecto a la sede del partido, no la etiqueta local/visitante.',
    ],
  };
}

export async function enrichVenueWithWeather(venue, match, stadium, { fetchImpl = fetch } = {}) {
  if (!venue) return venue;
  const weatherRaw = await getVenueWeatherForStadium(stadium, {
    kickoffAt: match?.kickoffAt,
    fetchImpl,
  });
  const matchWeather = buildMatchWeatherPredictionContext(weatherRaw);
  const analysisHints =
    matchWeather.status === 'ok'
      ? [
          'Clima del partido: usar venue.matchWeather.kickoffForecast (mismo dato que el panel Sede y clima).',
          'Evaluar aclimatación de cada selección respecto a temperatura, humedad, viento y lluvia del kickoff.',
        ]
      : venue.analysisHints;

  return {
    ...venue,
    analysisHints,
    weather: formatWeatherForPrompt(weatherRaw),
    matchWeather,
  };
}

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

/** Fallback: xG/odds → ranking/stats → Poisson por grupo. */
export function computeHeuristicScore(context) {
  const external = scoreFromExternalIntel(context.externalIntel ?? context.mercadoYxG);
  if (external) {
    let homeGoals = clampGoals(external.homeGoals) ?? 1;
    let awayGoals = clampGoals(external.awayGoals) ?? 1;
    if (homeGoals === 0 && awayGoals === 0) {
      homeGoals = 1;
      awayGoals = 1;
    }
    return { homeGoals, awayGoals, reasoning: external.reasoning, source: external.source };
  }

  const homeRank = context.homeTeam?.fifaRanking?.rank;
  const awayRank = context.awayTeam?.fifaRanking?.rank;
  if (homeRank != null && awayRank != null) {
    const diff = awayRank - homeRank;
    let homeGoals = diff > 8 ? 2 : diff > 0 ? 1 : diff < -8 ? 0 : 1;
    let awayGoals = diff < -8 ? 2 : diff < 0 ? 1 : diff > 8 ? 0 : 1;
    if (homeGoals === 0 && awayGoals === 0) {
      homeGoals = 1;
      awayGoals = 1;
    }
    return {
      homeGoals: clampGoals(homeGoals) ?? 1,
      awayGoals: clampGoals(awayGoals) ?? 1,
      reasoning: 'Heurística por ranking FIFA',
      source: 'heuristic',
    };
  }

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
    reasoning: 'Heurística por promedios de grupo',
    source: 'heuristic',
  };
}

export async function getAiUser() {
  const email = env.aiUserEmail;
  if (!email) return null;
  return User.findOne({ email, isAiUser: true });
}

export async function buildPromptContext(match, aiUserId) {
  const [homeTeam, awayTeam, teams, allMatches, groups, stadium] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
    Team.find({ group: { $exists: true, $ne: '' } }).lean(),
    Match.find().sort({ kickoffAt: 1 }).lean(),
    Group.find().lean(),
    match.stadiumId
      ? Stadium.findOne({ externalId: match.stadiumId }).lean()
      : Promise.resolve(null),
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

  const relevantGroup = match.group
    ? groupStandings.find((g) => g.group === String(match.group).toUpperCase())
    : null;

  const teamById = Object.fromEntries(teams.map((team) => [team.externalId, team]));
  const homeForAnalysis =
    resolvedHome ??
    ({
      externalId: match.homeTeamId,
      nameEn: match.homeTeamId,
      fifaCode: null,
      group: match.group ?? null,
    });
  const awayForAnalysis =
    resolvedAway ??
    ({
      externalId: match.awayTeamId,
      nameEn: match.awayTeamId,
      fifaCode: null,
      group: match.group ?? null,
    });

  const teamsAnalysis = await buildMatchTeamsAnalysis({
    homeTeam: homeForAnalysis,
    awayTeam: awayForAnalysis,
    match,
    allMatches,
    standingsByGroup: groupStandings,
    teamById,
  });

  const venue = await enrichVenueWithWeather(buildVenueContextForPrompt(match, stadium), match, stadium);
  const weatherRaw = await getVenueWeatherForStadium(stadium, { kickoffAt: match.kickoffAt });
  const weatherRisk = formatWeatherRiskForClient(
    await assessVenueWeatherRisk(stadium, { weather: weatherRaw, kickoffAt: match.kickoffAt })
  );
  const liveScheduleContext = buildLiveScheduleContext(match, allMatches);

  const enriched = await buildEnrichedMatchContext({
    homeTeam: homeForAnalysis,
    awayTeam: awayForAnalysis,
    venue,
    teamsAnalysis,
    enrichPerformance: false,
  });

  return {
    matchExternalId: match.externalId,
    phase: isKnockout ? 'knockout' : 'group',
    group: match.group ?? null,
    matchday: match.matchday ?? null,
    kickoffAt: match.kickoffAt?.toISOString?.() ?? match.kickoffAt,
    homeTeam: teamsAnalysis.home,
    awayTeam: teamsAnalysis.away,
    headToHead2026: teamsAnalysis.headToHead2026,
    fifaRankingsAsOf: teamsAnalysis.rankingsAsOf,
    venue,
    weatherOps: serializeWeatherOpsForClient(match.weatherOps),
    weatherRisk,
    liveScheduleContext,
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
    nationContext: enriched.nationContext,
    squadAnalysis: enriched.squadAnalysis,
    positionMatchups: enriched.positionMatchups,
  };
}

export async function prepareCompetitorMatchPrefetch(match, homeTeam, awayTeam) {
  const kickoffMs = match?.kickoffAt ? new Date(match.kickoffAt).getTime() : NaN;
  const forceIntel = Number.isFinite(kickoffMs) && kickoffMs - Date.now() < 2 * 60 * 60 * 1000;

  await Promise.all([
    homeTeam?.fifaCode
      ? refreshTeamPlayerIntel(homeTeam.fifaCode, { force: forceIntel }).catch(() => null)
      : null,
    awayTeam?.fifaCode
      ? refreshTeamPlayerIntel(awayTeam.fifaCode, { force: forceIntel }).catch(() => null)
      : null,
    fetchExternalMatchIntel(match, { force: false }).catch(() => null),
  ]);
}

export async function buildAiCompetitorPredictionContext(match, aiUserId) {
  const base = await buildPromptContext(match, aiUserId);

  const [homeTeam, awayTeam, allMatches, teams] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
    Match.find().sort({ kickoffAt: 1 }).lean(),
    Team.find({ group: { $exists: true, $ne: '' } }).lean(),
  ]);

  await prepareCompetitorMatchPrefetch(match, homeTeam, awayTeam);

  const teamById = Object.fromEntries(teams.map((t) => [t.externalId, t]));
  const homeForAnalysis = {
    externalId: match.homeTeamId,
    nameEn: base.homeTeam?.name ?? match.homeTeamId,
    fifaCode: base.homeTeam?.code ?? homeTeam?.fifaCode,
    group: match.group ?? homeTeam?.group,
  };
  const awayForAnalysis = {
    externalId: match.awayTeamId,
    nameEn: base.awayTeam?.name ?? match.awayTeamId,
    fifaCode: base.awayTeam?.code ?? awayTeam?.fifaCode,
    group: match.group ?? awayTeam?.group,
  };

  const enriched = await buildEnrichedMatchContext({
    homeTeam: homeForAnalysis,
    awayTeam: awayForAnalysis,
    venue: base.venue,
    teamsAnalysis: { home: base.homeTeam, away: base.awayTeam },
    enrichPerformance: true,
  });

  const userPredictedCtx = await buildUserPredictedMatchContext(aiUserId);
  const focusGroupId = await pickFocusGroupId(aiUserId);

  const [
    historialReciente,
    stakesContext,
    inteligenciaGrupo,
    prizeContext,
    calibrationStats,
    externalIntel,
  ] = await Promise.all([
    buildMatchHistoryContext(homeForAnalysis, awayForAnalysis, {
      allMatches,
      teamById,
      match,
    }),
    buildMatchStakesContext(match, aiUserId, { userPredictedCtx }),
    buildCrowdContextForCompetitor(match, aiUserId),
    buildPrizeRaceContext(aiUserId, focusGroupId),
    loadAiCalibrationStats(aiUserId),
    fetchExternalMatchIntel(match),
  ]);

  const crowdStandings = inteligenciaGrupo.tablasConsenso?.[0]
    ? [{ group: match.group, standings: inteligenciaGrupo.tablasConsenso[0].standings }]
    : null;

  const tablaYClasificacion = await buildTablaYClasificacionContext(
    match,
    aiUserId,
    crowdStandings
  );

  return {
    ...base,
    nationContext: enriched.nationContext,
    squadAnalysis: enriched.squadAnalysis,
    positionMatchups: enriched.positionMatchups,
    historialReciente,
    stakesContext,
    tablaYClasificacion,
    inteligenciaGrupo,
    carreraPremios: prizeContext.carreraPremios,
    calibracionReciente: buildCalibrationPromptBlock(calibrationStats),
    mercadoYxG: formatExternalIntelForPrompt(externalIntel),
    externalIntel,
    _calibrationStats: calibrationStats,
  };
}

function buildAiCompetitorPredictionPrompt(context) {
  return `Sos Predictive Modeling (IA), competidor oficial del Mundial 2026. Predecí el marcador que maximice puntos.

${WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS}

${AI_COMPETITOR_SCORING_INSTRUCTIONS}

${WORLD_CUP_USER_FACING_LANGUAGE_RULES}

En el campo "reasoning", incluí sede/estadio y clima del kickoff, ranking FIFA, stakes de clasificación, señal de mercado/xG si hay, y por qué el marcador maximiza PA+GL/GV/GT. No cites predicciones individuales de otros usuarios.

Respondé ÚNICAMENTE con JSON válido (sin markdown fuera del campo reasoning):
{"homeGoals": <entero 0-10>, "awayGoals": <entero 0-10>, "reasoning": "<explicación en español; markdown ligero permitido>"}

Contexto del partido:
${JSON.stringify(humanizePromptContext(context), null, 2)}`;
}

function buildAiPredictionPrompt(context) {
  return `Sos un analista de fútbol para el Mundial FIFA 2026. Predecí el marcador final del partido.

${WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS}

${WORLD_CUP_USER_FACING_LANGUAGE_RULES}

En el campo "reasoning", incluí sede/estadio y el clima del kickoff (temperatura, humedad, viento, lluvia, descripción). Si hay pronóstico al horario del partido, citá esos valores concretos. También ranking FIFA, historial, lesiones, duelos por puesto y factores anímicos cuando sean relevantes. No uses "localía" en el sentido de club. En "reasoning" podés usar markdown ligero (negritas, listas).

Respondé ÚNICAMENTE con JSON válido (sin markdown fuera del campo reasoning):
{"homeGoals": <entero 0-10>, "awayGoals": <entero 0-10>, "reasoning": "<explicación en español; markdown ligero permitido>"}

Contexto del partido:
${JSON.stringify(humanizePromptContext(context), null, 2)}`;
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
    reasoning: sanitizeAiUserFacingText(String(parsed?.reasoning ?? '').trim()),
    source,
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAiChatCompletions(
  { apiKey, url, model, messages, temperature = 0.4, responseFormat, providerLabel },
  { fetchImpl = fetch } = {}
) {
  if (!apiKey) return null;

  const body = { model, messages, temperature };
  if (responseFormat) {
    body.response_format = responseFormat;
  }

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
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
        throw new Error(`${providerLabel} HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      return String(data?.choices?.[0]?.message?.content ?? '').trim();
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await sleep(800 * (attempt + 1));
      }
    }
  }

  console.warn(`AI prediction ${providerLabel} failed:`, lastError?.message ?? lastError);
  return null;
}

async function callOpenAiProviderForScore(context, { apiKey, url, model, source, providerLabel, promptBuilder }, options) {
  const buildPrompt = promptBuilder ?? buildAiPredictionPrompt;
  const text = await callOpenAiChatCompletions(
    {
      apiKey,
      url,
      model,
      messages: [{ role: 'user', content: buildPrompt(context) }],
      temperature: 0.4,
      responseFormat: { type: 'json_object' },
      providerLabel,
    },
    options
  );
  if (!text) return null;
  return parseAiScoreResponse(text, source);
}

export async function callCerebrasForScore(context, options = {}) {
  return callOpenAiProviderForScore(
    context,
    {
      apiKey: env.cerebrasApiKey,
      url: CEREBRAS_API_URL,
      model: env.aiCerebrasModel,
      source: 'cerebras',
      providerLabel: 'Cerebras',
    },
    options
  );
}

export async function callGroqForScore(context, options = {}) {
  return callOpenAiProviderForScore(
    context,
    {
      apiKey: env.groqApiKey,
      url: GROQ_API_URL,
      model: env.aiGroqModel,
      source: 'groq',
      providerLabel: 'Groq',
    },
    options
  );
}

async function callGeminiProviderForScore(context, { fetchImpl = fetch, promptBuilder } = {}) {
  const apiKey = env.googleAiApiKey;
  if (!apiKey) return null;

  const buildPrompt = promptBuilder ?? buildAiPredictionPrompt;
  const url = `${GEMINI_API_BASE}/${env.aiGeminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: buildPrompt(context) }] }],
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

  console.warn('AI prediction Gemini failed:', lastError?.message ?? lastError);
  return null;
}

export async function callAiForScore(context, { fetchImpl = fetch, promptBuilder } = {}) {
  const providerOpts = { promptBuilder };
  const cerebrasScore = await callCerebrasForScore(context, { fetchImpl, ...providerOpts });
  if (cerebrasScore) return cerebrasScore;

  const geminiScore = await callGeminiProviderForScore(context, { fetchImpl, promptBuilder });
  if (geminiScore) return geminiScore;

  const groqScore = await callGroqForScore(context, { fetchImpl, ...providerOpts });
  if (groqScore) return groqScore;

  return computeHeuristicScore(context);
}

export async function callAiForCompetitorScore(context, options = {}) {
  return callAiForScore(context, {
    ...options,
    promptBuilder: buildAiCompetitorPredictionPrompt,
  });
}

/** @deprecated Usar callAiForScore */
export const callGeminiForScore = callAiForScore;

export function aiModelForScoreSource(source) {
  if (source === 'cerebras') return env.aiCerebrasModel;
  if (source === 'gemini') return env.aiGeminiModel;
  if (source === 'groq') return env.aiGroqModel;
  if (source === 'heuristic-xg' || source === 'heuristic-odds') return source;
  return 'heuristic';
}

export function hasAiProvider() {
  return Boolean(env.cerebrasApiKey || env.googleAiApiKey || env.groqApiKey);
}

function normalizeFollowUpHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => entry && typeof entry.content === 'string')
    .slice(-8)
    .map((entry) => {
      const role = entry.role === 'assistant' ? 'assistant' : 'user';
      const content = entry.content.trim();
      return {
        role,
        content:
          role === 'user' ? content.slice(0, AI_QUESTION_MAX_LEN) : content,
      };
    })
    .filter((entry) => entry.content);
}

function buildFollowUpPrompt(context, insight, question, history = []) {
  const historyBlock = history.length
    ? `\nConversación previa:\n${history
        .map((entry) => `${entry.role === 'user' ? 'Usuario' : 'IA'}: ${entry.content}`)
        .join('\n')}\n`
    : '';

  return `Sos un analista de fútbol para el Mundial FIFA 2026. Ya predijiste este partido.

${WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS}

${WORLD_CUP_USER_FACING_LANGUAGE_RULES}

Contexto del partido:
${JSON.stringify(humanizePromptContext(context), null, 2)}

Tu predicción: ${insight.homeGoals}-${insight.awayGoals}
Tu razonamiento: ${insight.reasoning}
${historyBlock}
Pregunta del usuario: ${question}

Respondé en español, de forma clara y completa. Usá markdown ligero cuando ayude (negritas, listas, tablas). No uses HTML ni bloques de código. No cambies el marcador salvo que te lo pidan explícitamente.`;
}

async function callOpenAiProviderForText(
  prompt,
  { apiKey, url, model, source, providerLabel },
  { fetchImpl = fetch } = {}
) {
  const text = await callOpenAiChatCompletions(
    {
      apiKey,
      url,
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      providerLabel,
    },
    { fetchImpl }
  );
  if (!text) {
    throw new Error(`${providerLabel} devolvió respuesta vacía`);
  }
  return { text, source };
}

async function callCerebrasForText(prompt, options = {}) {
  if (!env.cerebrasApiKey) return null;
  return callOpenAiProviderForText(
    prompt,
    {
      apiKey: env.cerebrasApiKey,
      url: CEREBRAS_API_URL,
      model: env.aiCerebrasModel,
      source: 'cerebras',
      providerLabel: 'Cerebras',
    },
    options
  );
}

async function callGroqForText(prompt, options = {}) {
  if (!env.groqApiKey) return null;
  return callOpenAiProviderForText(
    prompt,
    {
      apiKey: env.groqApiKey,
      url: GROQ_API_URL,
      model: env.aiGroqModel,
      source: 'groq',
      providerLabel: 'Groq',
    },
    options
  );
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
  return { text, source: 'gemini' };
}

export async function callAiForJson(prompt, { fetchImpl = fetch } = {}) {
  const jsonPrompt = `${prompt}\n\nRespondé ÚNICAMENTE con JSON válido (sin markdown).`;

  if (env.cerebrasApiKey) {
    try {
      const text = await callOpenAiChatCompletions(
        {
          apiKey: env.cerebrasApiKey,
          url: CEREBRAS_API_URL,
          model: env.aiCerebrasModel,
          messages: [{ role: 'user', content: jsonPrompt }],
          temperature: 0.3,
          responseFormat: { type: 'json_object' },
          providerLabel: 'Cerebras',
        },
        { fetchImpl }
      );
      const parsed = parseGeminiJsonResponse(text);
      if (parsed) return { data: parsed, source: 'cerebras' };
    } catch (err) {
      console.warn('AI JSON Cerebras failed, trying fallbacks:', err.message);
    }
  }

  if (env.groqApiKey) {
    try {
      const text = await callOpenAiChatCompletions(
        {
          apiKey: env.groqApiKey,
          url: GROQ_API_URL,
          model: env.aiGroqModel,
          messages: [{ role: 'user', content: jsonPrompt }],
          temperature: 0.3,
          responseFormat: { type: 'json_object' },
          providerLabel: 'Groq',
        },
        { fetchImpl }
      );
      const parsed = parseGeminiJsonResponse(text);
      if (parsed) return { data: parsed, source: 'groq' };
    } catch (err) {
      console.warn('AI JSON Groq failed, trying Gemini:', err.message);
    }
  }

  const textResult = await callAiForText(jsonPrompt, { fetchImpl });
  const parsed = parseGeminiJsonResponse(textResult.text);
  if (!parsed) {
    throw new Error('La IA devolvió JSON inválido');
  }
  return { data: parsed, source: textResult.source };
}

function finalizeAiTextResponse(result) {
  if (!result?.text) return result;
  return { ...result, text: sanitizeAiUserFacingText(result.text) };
}

export async function callAiForText(prompt, { fetchImpl = fetch } = {}) {
  if (env.cerebrasApiKey) {
    try {
      const cerebras = await callCerebrasForText(prompt, { fetchImpl });
      if (cerebras) return finalizeAiTextResponse(cerebras);
    } catch (err) {
      console.warn('AI follow-up Cerebras failed, trying fallbacks:', err.message);
    }
  }

  if (env.googleAiApiKey) {
    try {
      const gemini = await callGeminiForText(prompt, { fetchImpl });
      if (gemini) return finalizeAiTextResponse(gemini);
    } catch (err) {
      console.warn('AI follow-up Gemini failed, trying Groq:', err.message);
      if (env.groqApiKey) {
        return finalizeAiTextResponse(await callGroqForText(prompt, { fetchImpl }));
      }
      throw err;
    }
  }

  if (env.groqApiKey) {
    return finalizeAiTextResponse(await callGroqForText(prompt, { fetchImpl }));
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
  const score = await callAiForScore(context, { fetchImpl });
  return formatMatchAiInsight(score);
}

export async function askMatchAiFollowUp(
  matchId,
  userId,
  { question, history = [], insight },
  { fetchImpl = fetch } = {}
) {
  const trimmedQuestion = String(question ?? '').trim();
  if (!trimmedQuestion) {
    throw new Error('Escribí una pregunta');
  }

  if (!hasAiProvider()) {
    throw new Error('IA no configurada');
  }
  if (trimmedQuestion.length > AI_QUESTION_MAX_LEN) {
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

export async function submitAiPrediction(
  userId,
  matchId,
  { homeGoals, awayGoals, aiModel, aiReasoning, aiCalibrationApplied }
) {
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
      aiModel: aiModel ?? env.aiCerebrasModel,
      aiReasoning: aiReasoning?.trim() || null,
      ...(aiCalibrationApplied != null ? { aiCalibrationApplied } : {}),
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
      const context = await buildAiCompetitorPredictionContext(match, aiUser._id);
      const rawScore = await callAiForCompetitorScore(context, { fetchImpl });
      const score = applyCalibrationNudge(rawScore, context._calibrationStats);
      const prediction = await submitAiPrediction(aiUser._id, match._id, {
        homeGoals: score.homeGoals,
        awayGoals: score.awayGoals,
        aiModel: aiModelForScoreSource(score.source),
        aiReasoning: score.reasoning,
        aiCalibrationApplied: Boolean(score.calibrationApplied),
      });

      await saveAiCompetitorPredictionLog({
        userId: aiUser._id,
        matchId: match._id,
        predictionId: prediction._id,
        context,
        rawScore,
        finalScore: score,
      }).catch((err) => {
        console.warn(`AI audit log failed (${match.externalId}):`, err.message);
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
