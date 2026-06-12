import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { AiMatchLiveBriefing } from '../models/AiMatchLiveBriefing.js';
import { enrichMatchLiveFields } from './matchLiveData.js';
import {
  aiModelForScoreSource,
  callAiForJson,
  hasAiProvider,
} from './aiPredictionService.js';

const LIVE_TTL_MS = 2 * 60 * 1000;
const FINISHED_TTL_MS = 6 * 60 * 60 * 1000;

const EVENT_LABELS = {
  goal: 'Gol',
  yellow_card: 'Amarilla',
  red_card: 'Roja',
  substitution: 'Cambio',
  foul: 'Falta',
  goal_disallowed: 'Gol anulado',
};

function timelineHash(timeline = []) {
  return timeline
    .map((event) =>
      [
        event.type,
        event.side,
        event.minute,
        event.player,
        event.playerIn,
        event.playerOut,
      ].join(':')
    )
    .join('|');
}

function formatMinute(event) {
  if (event.minute == null) return '?';
  if (event.extraMinute) return `${event.minute}+${event.extraMinute}'`;
  return `${event.minute}'`;
}

function formatTimelineLine(event, homeCode, awayCode) {
  const minute = formatMinute(event);
  const code = event.side === 'home' ? homeCode : event.side === 'away' ? awayCode : '—';

  switch (event.type) {
    case 'goal':
      return `${minute} ${code} Gol ${event.player}`;
    case 'yellow_card':
      return `${minute} ${code} Amarilla ${event.player}`;
    case 'red_card':
      return `${minute} ${code} Roja ${event.player}`;
    case 'substitution':
      return `${minute} ${code} Cambio ${event.playerOut} → ${event.playerIn}`;
    case 'foul':
      return `${minute} ${code} Falta ${event.player}`;
    case 'goal_disallowed':
      return `${minute} Gol anulado`;
    default:
      return `${minute} ${EVENT_LABELS[event.type] ?? event.type} ${event.player ?? ''}`.trim();
  }
}

export function buildLiveMatchAiContext(match, homeTeam, awayTeam, liveFields) {
  const homeCode = homeTeam?.fifaCode ?? 'LOC';
  const awayCode = awayTeam?.fifaCode ?? 'VIS';
  const timeline = liveFields.matchTimeline ?? [];

  return {
    status: match.status,
    minute: liveFields.timeElapsed ?? null,
    score: {
      home: liveFields.homeScore ?? match.homeScore ?? 0,
      away: liveFields.awayScore ?? match.awayScore ?? 0,
    },
    teams: {
      home: { code: homeCode, name: homeTeam?.nameEn ?? match.homeTeamId },
      away: { code: awayCode, name: awayTeam?.nameEn ?? match.awayTeamId },
    },
    group: match.group ?? null,
    phase: match.type ?? null,
    timeline: timeline.map((event) => ({
      minute: event.minute,
      extraMinute: event.extraMinute ?? null,
      type: event.type,
      side: event.side,
      player: event.player ?? null,
      playerIn: event.playerIn ?? null,
      playerOut: event.playerOut ?? null,
      label: formatTimelineLine(event, homeCode, awayCode),
    })),
    reportStats: liveFields.fifaReportStats ?? null,
  };
}

function buildLiveMatchPrompt(context) {
  return `Sos comentarista del Mundial FIFA 2026. Analizá las acciones de juego SOLO con los datos provistos.
NO inventes goles, tarjetas, cambios ni jugadores que no estén en el timeline.
Si el partido está en vivo, podés inferir ritmo o momentum, pero marcá lo inferido como interpretación breve.

Contexto del partido:
${JSON.stringify(context, null, 2)}

Respondé ÚNICAMENTE JSON válido:
{
  "headline": "titular corto (máx 12 palabras)",
  "summary": "2-4 oraciones sobre lo ocurrido hasta ahora",
  "keyMoments": [{"minute": 67, "text": "descripción breve de la acción"}],
  "momentum": "home|away|balanced",
  "discipline": "1 oración sobre tarjetas/expulsiones si aplica, o vacío",
  "tacticalNote": "1 oración interpretando cambios o dominio con stats si hay",
  "whatToWatch": "1 oración sobre qué vigilar (solo si status=live, si no vacío)"
}

Máximo 5 keyMoments. Usá minutos del timeline.`;
}

export function normalizeLiveBriefingPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const momentum = ['home', 'away', 'balanced'].includes(String(raw.momentum ?? ''))
    ? raw.momentum
    : 'balanced';

  const keyMoments = Array.isArray(raw.keyMoments)
    ? raw.keyMoments
        .map((row) => ({
          minute: Number.isFinite(Number(row?.minute)) ? Number(row.minute) : null,
          text: String(row?.text ?? '').trim(),
        }))
        .filter((row) => row.text)
        .slice(0, 6)
    : [];

  return {
    headline: String(raw.headline ?? '').trim(),
    summary: String(raw.summary ?? '').trim(),
    keyMoments,
    momentum,
    discipline: String(raw.discipline ?? '').trim(),
    tacticalNote: String(raw.tacticalNote ?? '').trim(),
    whatToWatch: String(raw.whatToWatch ?? '').trim(),
  };
}

function isBriefingFresh(doc, matchStatus, currentHash, now = Date.now()) {
  if (!doc?.fetchedAt || doc.timelineHash !== currentHash) return false;
  const ttl = matchStatus === 'live' ? LIVE_TTL_MS : FINISHED_TTL_MS;
  return now - new Date(doc.fetchedAt).getTime() < ttl;
}

function formatBriefingResponse(doc, meta = {}) {
  return {
    aiAvailable: hasAiProvider(),
    briefing: doc
      ? {
          headline: doc.headline,
          summary: doc.summary,
          keyMoments: doc.keyMoments ?? [],
          momentum: doc.momentum,
          discipline: doc.discipline,
          tacticalNote: doc.tacticalNote,
          whatToWatch: doc.whatToWatch,
          source: doc.source,
          model: doc.model,
          fetchedAt: doc.fetchedAt,
          stale: meta.stale ?? false,
        }
      : null,
    eventTypesAvailable: Object.keys(EVENT_LABELS),
  };
}

async function loadMatchBundle(matchId) {
  const match = await Match.findById(matchId).lean();
  if (!match) throw new Error('Partido no encontrado');
  if (match.status !== 'live' && match.status !== 'finished') {
    throw new Error('El análisis IA de acciones está disponible solo en partidos en vivo o finalizados');
  }

  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);

  const liveFields = enrichMatchLiveFields(match);
  const context = buildLiveMatchAiContext(match, homeTeam, awayTeam, liveFields);
  const hash = timelineHash(liveFields.matchTimeline);

  return { match, context, hash, liveFields };
}

async function generateLiveBriefing(match, context, hash) {
  const prompt = buildLiveMatchPrompt(context);
  const result = await callAiForJson(prompt);
  const normalized = normalizeLiveBriefingPayload(result?.data);
  if (!normalized?.summary) return null;

  const source = result?.source ?? 'heuristic';
  const model = aiModelForScoreSource(source);

  return AiMatchLiveBriefing.findOneAndUpdate(
    { matchExternalId: match.externalId },
    {
      $set: {
        matchId: match._id,
        ...normalized,
        timelineHash: hash,
        source,
        model,
        fetchedAt: new Date(),
      },
    },
    { upsert: true, new: true, lean: true }
  );
}

export async function getMatchLiveAiBriefing(matchId, { refresh = false } = {}) {
  const { match, context, hash } = await loadMatchBundle(matchId);
  const cached = await AiMatchLiveBriefing.findOne({ matchExternalId: match.externalId }).lean();

  if (!context.timeline.length) {
    return {
      ...formatBriefingResponse(null),
      emptyTimeline: true,
      message: 'Todavía no hay acciones de juego sincronizadas para este partido.',
    };
  }

  const needsRefresh = refresh || !isBriefingFresh(cached, match.status, hash);

  if (needsRefresh && hasAiProvider()) {
    try {
      const generated = await generateLiveBriefing(match, context, hash);
      if (generated) {
        return formatBriefingResponse(generated);
      }
    } catch {
      // keep stale cache if refresh fails
    }
  }

  return formatBriefingResponse(cached, {
    stale: Boolean(cached && !isBriefingFresh(cached, match.status, hash)),
  });
}

export async function refreshMatchLiveAiBriefing(matchId) {
  return getMatchLiveAiBriefing(matchId, { refresh: true });
}

export { EVENT_LABELS, timelineHash };
