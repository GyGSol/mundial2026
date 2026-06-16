import crypto from 'node:crypto';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { callAiForJson, hasAiProvider } from './aiPredictionService.js';
import { resolveOfficialKickoffAt, localWallClockToUtc } from './kickoffTimeService.js';

const KICKOFF_OFFICIAL_TOLERANCE_MS = 2 * 60 * 60 * 1000;
const KICKOFF_WC26_TOLERANCE_MS = 3 * 60 * 60 * 1000;

export function buildMatchSourceDisputePrompt(dispute) {
  const fifa = dispute.fifa ?? {};
  const official = dispute.official ?? {};
  const db = dispute.db ?? {};
  const wc26 = dispute.wc26 ?? {};
  const stadium = dispute.stadium ?? {};

  return `Sos un asistente de reconciliación de datos del Mundial FIFA 2026.
Dos o más fuentes no coinciden en QUÉ PAÍSES juegan o A QUÉ HORA empieza el partido.
NO inventes datos. NO respondas goles ni si el partido está en vivo o finalizado.
El id de worldcup26.ir NO es el MatchNumber FIFA de esta aplicación.

--- Partido FIFA (slot en nuestra app) ---
MatchNumber / externalId: ${fifa.externalId ?? dispute.externalId}
Grupo: ${fifa.group ?? ''}
Fecha de fixture: ${fifa.matchday ?? ''}
Local (FIFA): ${fifa.homeCode ?? ''} (${fifa.homeName ?? ''})
Visitante (FIFA): ${fifa.awayCode ?? ''} (${fifa.awayName ?? ''})
Kickoff FIFA calendar (si hay): ${fifa.kickoffAtUtc ?? 'n/d'}
Kickoff fixture oficial app (si hay): ${official.kickoffAtUtc ?? 'n/d'}
Estadio: ${stadium.nameEn ?? ''} — ${stadium.city ?? ''}, ${stadium.country ?? ''}
Zona horaria estadio: ${stadium.timezone ?? ''}

--- Base de datos actual ---
Local DB: ${db.homeCode ?? ''} (${db.homeName ?? ''})
Visitante DB: ${db.awayCode ?? ''} (${db.awayName ?? ''})
kickoffAt DB: ${db.kickoffAtUtc ?? 'n/d'}
status DB: ${db.status ?? ''}

--- worldcup26.ir (payload que generó el conflicto) ---
worldcup26 game id: ${wc26.id ?? 'n/d'}  ← NO confundir con MatchNumber FIFA
home_team_name_en: ${wc26.homeName ?? 'n/d'}
away_team_name_en: ${wc26.awayName ?? 'n/d'}
local_date: ${wc26.localDate ?? 'n/d'}
finished: ${wc26.finished ?? 'n/d'}
time_elapsed: ${wc26.timeElapsed ?? 'n/d'}

--- Conflicto detectado ---
Tipo: ${dispute.type}
Detalle: ${dispute.summary}

Preguntas (respondé las dos en el JSON):
1. ¿Qué dos selecciones nacionales juegan este partido según el slot FIFA ${fifa.externalId ?? dispute.externalId}?
2. ¿Cuál es el horario de inicio correcto en UTC?

Prioridad de fuentes si hay empate:
1) Fixture oficial de la app (kickoffTimeService)
2) Calendario FIFA API
3) worldcup26 local_date + timezone del estadio
4) Valor actual en DB solo si las anteriores faltan

Respondé ÚNICAMENTE JSON válido:
{
  "homeFifaCode": "IRN",
  "awayFifaCode": "NZL",
  "kickoffAtUtc": "2026-06-16T01:00:00.000Z",
  "confidence": "high",
  "reason": "Una oración: qué fuente prevalece y por qué (máx. 200 caracteres)."
}`;
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

function parseKickoffUtc(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function withinTolerance(actual, expected, toleranceMs) {
  if (!actual || !expected) return false;
  return Math.abs(actual.getTime() - expected.getTime()) <= toleranceMs;
}

export function validateAiSourceVerdict(verdict, dispute, { teamCodes } = {}) {
  if (!verdict || typeof verdict !== 'object') {
    return { ok: false, reason: 'respuesta_ia_invalida' };
  }

  const confidence = String(verdict.confidence ?? '').toLowerCase();
  if (confidence === 'low') {
    return { ok: false, reason: 'confianza_baja' };
  }

  const homeCode = normalizeCode(verdict.homeFifaCode);
  const awayCode = normalizeCode(verdict.awayFifaCode);
  if (!homeCode || !awayCode || !teamCodes.has(homeCode) || !teamCodes.has(awayCode)) {
    return { ok: false, reason: 'codigos_fifa_invalidos' };
  }

  const fifaHome = normalizeCode(dispute.fifa?.homeCode);
  const fifaAway = normalizeCode(dispute.fifa?.awayCode);
  const dbHome = normalizeCode(dispute.db?.homeCode);
  const dbAway = normalizeCode(dispute.db?.awayCode);

  const matchesFifa = homeCode === fifaHome && awayCode === fifaAway;
  const matchesDb = homeCode === dbHome && awayCode === dbAway;
  if (!matchesFifa && !matchesDb) {
    return { ok: false, reason: 'par_no_coincide_con_fifa_ni_db' };
  }

  const kickoffAt = parseKickoffUtc(verdict.kickoffAtUtc);
  if (!kickoffAt) {
    return { ok: false, reason: 'kickoff_invalido' };
  }

  const dbKickoff = parseKickoffUtc(dispute.db?.kickoffAtUtc);
  const official = parseKickoffUtc(dispute.official?.kickoffAtUtc);
  const kickoffOk =
    (official && withinTolerance(kickoffAt, official, KICKOFF_OFFICIAL_TOLERANCE_MS)) ||
    (dbKickoff && withinTolerance(kickoffAt, dbKickoff, 60_000)) ||
    (!official &&
      dispute.wc26?.localDate &&
      dispute.stadium?.timezone &&
      withinTolerance(
        kickoffAt,
        localWallClockToUtc(dispute.wc26.localDate, dispute.stadium.timezone),
        KICKOFF_WC26_TOLERANCE_MS
      ));

  if (!kickoffOk) {
    return { ok: false, reason: 'kickoff_fuera_de_ventana' };
  }

  return { ok: true, homeCode, awayCode, kickoffAt };
}

export function hashPrompt(prompt) {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

export async function resolveMatchSourceDispute(dispute, { teamCodes, fetchImpl } = {}) {
  const prompt = buildMatchSourceDisputePrompt(dispute);
  const promptHash = hashPrompt(prompt);

  if (!hasAiProvider()) {
    return {
      externalId: dispute.externalId,
      type: dispute.type,
      promptHash,
      aiSkipped: true,
      applied: false,
      reason: 'sin_proveedor_ia',
    };
  }

  try {
    const { data, source } = await callAiForJson(prompt, { fetchImpl });
    const validation = validateAiSourceVerdict(data, dispute, { teamCodes });

    if (!validation.ok) {
      return {
        externalId: dispute.externalId,
        type: dispute.type,
        promptHash,
        verdict: data,
        aiSource: source,
        applied: false,
        reason: validation.reason,
      };
    }

    let applied = false;
    let applyReason = validation.reason ?? data.reason ?? '';

    if (dispute.type === 'kickoff_mismatch') {
      const official = resolveOfficialKickoffAt(dispute.externalId);
      const nextKickoff = official ?? validation.kickoffAt;
      await Match.updateOne(
        { _id: dispute.matchId },
        { $set: { kickoffAt: nextKickoff } }
      );
      applied = true;
      applyReason = 'kickoff_actualizado';
    } else if (dispute.type === 'teams_mismatch') {
      // Equipos ya reconciliados por sync/FIFA; confirmar e ignorar payload worldcup26 erróneo.
      applied = false;
      applyReason = 'equipos_ya_alineados_ignorar_wc26';
    }

    return {
      externalId: dispute.externalId,
      type: dispute.type,
      promptHash,
      verdict: data,
      aiSource: source,
      applied,
      reason: applyReason,
    };
  } catch (err) {
    return {
      externalId: dispute.externalId,
      type: dispute.type,
      promptHash,
      applied: false,
      reason: `error_ia: ${err.message}`,
    };
  }
}

export async function resolveAndApplySourceDisputes(disputes, options = {}) {
  if (!disputes?.length) return [];

  if (!hasAiProvider()) {
    return disputes.map((dispute) => ({
      externalId: dispute.externalId,
      type: dispute.type,
      aiSkipped: true,
      applied: false,
      reason: 'sin_proveedor_ia',
    }));
  }

  const teams = await Team.find().select('fifaCode').lean();
  const teamCodes = new Set(
    teams.map((t) => normalizeCode(t.fifaCode)).filter(Boolean)
  );

  const results = [];
  for (const dispute of disputes) {
    results.push(await resolveMatchSourceDispute(dispute, { ...options, teamCodes }));
  }
  return results;
}
