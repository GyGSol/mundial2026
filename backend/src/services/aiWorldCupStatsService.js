import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Stadium } from '../models/Stadium.js';
import { AiWorldCupStatsBriefing } from '../models/AiWorldCupStatsBriefing.js';
import { getLastSyncAt } from './syncService.js';
import { buildWorldCupOverview } from './worldCupStatsService.js';
import {
  aiModelForScoreSource,
  callAiForJson,
  hasAiProvider,
} from './aiPredictionService.js';

const BRIEFING_KEY = 'worldcup2026';
const BRIEFING_TTL_MS = 6 * 60 * 60 * 1000;

function isBriefingFresh(doc, now = Date.now()) {
  if (!doc?.fetchedAt) return false;
  return now - new Date(doc.fetchedAt).getTime() < BRIEFING_TTL_MS;
}

function buildStatsContext(overview) {
  const { stats, teams, stadiums, groups, tournament2026PlayerStats } = overview;

  return {
    teams: stats?.teams ?? teams?.length ?? 0,
    matches: stats?.matches ?? {},
    goals: stats?.goals ?? {},
    topScorers: tournament2026PlayerStats?.leaders?.slice(0, 8) ?? [],
    groups: (groups ?? []).map((g) => ({
      name: g.name,
      leader: g.standings?.[0]?.nameEn,
      played: g.standings?.[0]?.played,
    })),
    stadiums: (stadiums ?? []).slice(0, 16).map((s) => ({
      name: s.nameEn,
      city: s.city,
      country: s.country,
      capacity: s.capacity,
      matchesHosted: s.matchesHosted,
      goalsScored: s.goalsScored,
    })),
  };
}

function buildAiPrompt(statsContext) {
  return `Sos analista del Mundial FIFA 2026 (USA, Canadá y México).
Generá un briefing enriquecido en español rioplatense usando SOLO los datos locales provistos.
NO inventes resultados de partidos, goleadores ni URLs. Si un dato no está en el JSON, mencionalo como pendiente del torneo.

Datos locales del torneo:
${JSON.stringify(statsContext, null, 2)}

Respondé ÚNICAMENTE JSON válido con esta forma:
{
  "overview": "2-4 oraciones sobre el estado del torneo",
  "newsDigest": "1-2 oraciones sobre el contexto informativo del torneo según los datos locales",
  "keyNumbers": [{"label":"...", "value":"...", "note":"..."}],
  "records": [{"title":"...", "description":"..."}],
  "trivia": ["dato curioso verificable o histórico del formato 2026"],
  "phaseSummaries": [{"phase":"Fase de grupos|Octavos|...", "summary":"..."}],
  "hostFacts": ["dato sobre sedes, ciudades anfitrionas o formato expandido"]
}

Máximo 6 keyNumbers, 5 records, 5 trivia, 4 phaseSummaries, 4 hostFacts.`;
}

function normalizeBriefingPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const keyNumbers = Array.isArray(raw.keyNumbers)
    ? raw.keyNumbers
        .map((row) => ({
          label: String(row?.label ?? '').trim(),
          value: String(row?.value ?? '').trim(),
          note: String(row?.note ?? '').trim(),
        }))
        .filter((row) => row.label && row.value)
        .slice(0, 8)
    : [];

  const records = Array.isArray(raw.records)
    ? raw.records
        .map((row) => ({
          title: String(row?.title ?? '').trim(),
          description: String(row?.description ?? '').trim(),
        }))
        .filter((row) => row.title)
        .slice(0, 8)
    : [];

  const trivia = Array.isArray(raw.trivia)
    ? raw.trivia.map((t) => String(t ?? '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const phaseSummaries = Array.isArray(raw.phaseSummaries)
    ? raw.phaseSummaries
        .map((row) => ({
          phase: String(row?.phase ?? '').trim(),
          summary: String(row?.summary ?? '').trim(),
        }))
        .filter((row) => row.phase && row.summary)
        .slice(0, 6)
    : [];

  const hostFacts = Array.isArray(raw.hostFacts)
    ? raw.hostFacts.map((t) => String(t ?? '').trim()).filter(Boolean).slice(0, 6)
    : [];

  return {
    overview: String(raw.overview ?? '').trim(),
    newsDigest: String(raw.newsDigest ?? '').trim(),
    keyNumbers,
    records,
    trivia,
    phaseSummaries,
    hostFacts,
  };
}

function formatBriefingResponse(doc, meta = {}) {
  return {
    aiAvailable: hasAiProvider(),
    briefing: doc
      ? {
          overview: doc.overview,
          newsDigest: doc.newsDigest,
          keyNumbers: doc.keyNumbers ?? [],
          records: doc.records ?? [],
          trivia: doc.trivia ?? [],
          phaseSummaries: doc.phaseSummaries ?? [],
          hostFacts: doc.hostFacts ?? [],
          source: doc.source,
          model: doc.model,
          fetchedAt: doc.fetchedAt,
          stale: meta.stale ?? false,
        }
      : null,
  };
}

async function generateAiBriefing(statsContext) {
  const prompt = buildAiPrompt(statsContext);
  const result = await callAiForJson(prompt);
  const normalized = normalizeBriefingPayload(result?.data);
  if (!normalized?.overview) return null;

  const source = result?.source ?? 'heuristic';
  const model = aiModelForScoreSource(source);

  const saved = await AiWorldCupStatsBriefing.findOneAndUpdate(
    { briefingKey: BRIEFING_KEY },
    {
      $set: {
        ...normalized,
        source,
        model,
        fetchedAt: new Date(),
      },
    },
    { upsert: true, new: true, lean: true }
  );

  return saved;
}

export async function getWorldCupAiBriefing({ refresh = false } = {}) {
  const [overview, cachedBriefing] = await Promise.all([
    buildWorldCupOverview({ Match, Team, Group, Stadium, getLastSyncAt }),
    AiWorldCupStatsBriefing.findOne({ briefingKey: BRIEFING_KEY }).lean(),
  ]);

  const statsContext = buildStatsContext(overview);
  let briefingDoc = cachedBriefing;
  const needsRefresh = refresh || !isBriefingFresh(cachedBriefing);

  if (needsRefresh && hasAiProvider()) {
    try {
      const generated = await generateAiBriefing(statsContext);
      if (generated) briefingDoc = generated;
    } catch {
      // keep stale briefing if refresh fails
    }
  }

  return formatBriefingResponse(briefingDoc, {
    stale: Boolean(briefingDoc && !isBriefingFresh(briefingDoc)),
  });
}

export async function refreshWorldCupAiBriefing() {
  return getWorldCupAiBriefing({ refresh: true });
}

export { normalizeBriefingPayload, buildStatsContext, buildAiPrompt };
