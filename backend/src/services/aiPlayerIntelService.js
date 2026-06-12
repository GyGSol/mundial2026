import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { AiPlayerIntel } from '../models/AiPlayerIntel.js';
import {
  aiModelForScoreSource,
  callAiForJson,
  callAiForText,
  hasAiProvider,
} from './aiPredictionService.js';
import { listPlayers, getPlayerById } from './playerService.js';
import { matchNameToRosterPlayer } from '../utils/playerNameMatch.js';

const INTEL_TTL_MS = 12 * 60 * 60 * 1000;
const HEALTH_STATUSES = new Set(['available', 'injured', 'doubt']);

const HEALTH_LABELS = {
  available: 'Disponible',
  injured: 'Lesionado',
  doubt: 'Duda',
  unknown: 'Sin datos IA',
};

function isIntelFresh(intel, now = Date.now()) {
  if (!intel?.fetchedAt) return false;
  return now - new Date(intel.fetchedAt).getTime() < INTEL_TTL_MS;
}

function normalizeHealthStatus(value) {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('injur') || raw.includes('lesion') || raw.includes('baja')) return 'injured';
  if (raw.includes('doubt') || raw.includes('duda')) return 'doubt';
  if (HEALTH_STATUSES.has(raw)) return raw;
  return 'available';
}

function normalizeAiPlayerEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const fullName = String(entry.fullName ?? entry.name ?? '').trim();
  if (!fullName) return null;

  return {
    fullName,
    healthStatus: normalizeHealthStatus(entry.healthStatus ?? entry.status),
    injuryInfo: String(entry.injuryInfo ?? entry.injury ?? entry.dolencia ?? '').trim(),
    yellowCards: Math.max(0, Number(entry.yellowCards ?? entry.amarillas ?? 0) || 0),
    redCards: Math.max(0, Number(entry.redCards ?? entry.rojas ?? 0) || 0),
    suspended: Boolean(entry.suspended ?? entry.suspendido),
    suspensionInfo: String(entry.suspensionInfo ?? entry.suspension ?? '').trim(),
    isStarter:
      entry.isStarter === true || entry.isStarter === false
        ? entry.isStarter
        : entry.starter === true || entry.starter === false
          ? entry.starter
          : null,
    notes: String(entry.notes ?? entry.notas ?? '').trim(),
    aiSummary: String(entry.aiSummary ?? entry.summary ?? entry.notes ?? '').trim(),
  };
}

function matchAiEntryToPlayer(aiEntry, rosterPlayers) {
  return matchNameToRosterPlayer(aiEntry.fullName, rosterPlayers);
}

async function upsertIntelForPlayer(player, aiEntry, meta) {
  const payload = {
    playerExternalId: player.externalId,
    playerId: player._id,
    fullName: player.fullName,
    fifaCode: player.fifaCode,
    healthStatus: aiEntry.healthStatus,
    injuryInfo: aiEntry.injuryInfo,
    yellowCards: aiEntry.yellowCards,
    redCards: aiEntry.redCards,
    suspended: aiEntry.suspended,
    suspensionInfo: aiEntry.suspensionInfo,
    isStarter: aiEntry.isStarter,
    notes: aiEntry.notes,
    aiSummary: aiEntry.aiSummary || aiEntry.notes,
    source: meta.source,
    model: meta.model,
    fetchedAt: new Date(),
  };

  return AiPlayerIntel.findOneAndUpdate(
    { playerExternalId: player.externalId },
    { $set: payload },
    { upsert: true, new: true, lean: true }
  );
}

function buildTeamIntelPrompt(team, rosterPlayers) {
  const squad = rosterPlayers.map((p) => ({
    fullName: p.fullName,
    position: p.position,
    club: p.currentClub,
    age: p.age,
  }));

  return `Sos un periodista deportivo especializado en el Mundial FIFA 2026.
Analizá el estado actual de la selección ${team.nameEn} (${team.fifaCode}) para el torneo.

Plantel de referencia (no inventes jugadores fuera de esta lista):
${JSON.stringify(squad, null, 2)}

Devolvé JSON con esta forma:
{
  "players": [
    {
      "fullName": "Nombre exacto del plantel",
      "healthStatus": "available|injured|doubt",
      "injuryInfo": "lesión o dolencia si aplica",
      "yellowCards": 0,
      "redCards": 0,
      "suspended": false,
      "suspensionInfo": "",
      "isStarter": true,
      "notes": "tarjetas, sanciones o contexto del mundial"
    }
  ],
  "teamNotes": "resumen breve del estado del plantel"
}

Reglas:
- Usá solo jugadores del plantel de referencia.
- Incluí lesiones, dudas, amonestaciones y suspensiones relevantes para el Mundial 2026.
- Si no hay novedad, healthStatus "available" y campos vacíos.
- Respondé en español en los textos.`;
}

function buildPlayerDetailPrompt(player, team) {
  return `Sos un analista del Mundial FIFA 2026.
Dame un informe actualizado del jugador ${player.fullName} (${team?.fifaCode ?? player.fifaCode}, ${player.position}).

Club: ${player.currentClub || 'desconocido'}
Edad: ${player.age ?? 'desconocida'}

Devolvé JSON:
{
  "healthStatus": "available|injured|doubt",
  "injuryInfo": "",
  "yellowCards": 0,
  "redCards": 0,
  "suspended": false,
  "suspensionInfo": "",
  "isStarter": true,
  "notes": "",
  "aiSummary": "párrafo con estado físico, tarjetas, rol en la selección y riesgos para el mundial"
}

Sin markdown. Textos en español.`;
}

async function resolveTeam(teamCode) {
  const code = String(teamCode ?? '').trim().toUpperCase();
  if (!code) return null;
  return Team.findOne({ $or: [{ fifaCode: code }, { externalId: code }] }).lean();
}

export async function getIntelMapForExternalIds(externalIds = []) {
  if (!externalIds.length) return new Map();
  const rows = await AiPlayerIntel.find({ playerExternalId: { $in: externalIds } }).lean();
  return new Map(rows.map((row) => [row.playerExternalId, row]));
}

export function mergePlayerWithIntel(player, intel) {
  if (!intel) {
    return {
      ...player,
      healthStatus: 'unknown',
      healthLabel: HEALTH_LABELS.unknown,
      injuryInfo: '',
      yellowCards: null,
      redCards: null,
      suspended: false,
      suspensionInfo: '',
      intelSource: null,
      intelModel: null,
      intelFetchedAt: null,
      intelStale: true,
      aiSummary: '',
    };
  }

  return {
    ...player,
    healthStatus: intel.healthStatus,
    healthLabel: HEALTH_LABELS[intel.healthStatus] || intel.healthStatus,
    injuryInfo: intel.injuryInfo || '',
    yellowCards: intel.yellowCards ?? 0,
    redCards: intel.redCards ?? 0,
    suspended: Boolean(intel.suspended),
    suspensionInfo: intel.suspensionInfo || '',
    isStarter: intel.isStarter ?? player.isStarter,
    intelSource: intel.source || 'ai',
    intelModel: intel.model || '',
    intelFetchedAt: intel.fetchedAt,
    intelStale: !isIntelFresh(intel),
    aiSummary: intel.aiSummary || intel.notes || '',
    notes: intel.notes || '',
  };
}

function intelPriorityRank(player) {
  if (player.healthStatus === 'injured') return 0;
  if (player.healthStatus === 'doubt') return 1;
  if (player.healthStatus === 'unknown') return 2;
  return 3;
}

function sortPlayersByIntelPriority(players) {
  return [...players].sort((a, b) => {
    const diff = intelPriorityRank(a) - intelPriorityRank(b);
    if (diff !== 0) return diff;
    if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
    return a.fullName.localeCompare(b.fullName, 'es');
  });
}

function filterPlayersByIntelStatus(players, status) {
  if (status === 'alert') {
    return players.filter((p) => ['injured', 'doubt'].includes(p.healthStatus));
  }
  if (['injured', 'doubt', 'available'].includes(status)) {
    return players.filter((p) => p.healthStatus === status);
  }
  return players;
}

function paginatePlayers(players, page, limit) {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const total = players.length;
  const skip = (safePage - 1) * safeLimit;
  return {
    players: players.slice(skip, skip + safeLimit),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function listPlayersWithIntel(options = {}) {
  const status = options.status ?? 'priority';
  const healthViews = new Set(['priority', 'alert', 'injured', 'doubt', 'available']);

  if (options.team && healthViews.has(status)) {
    const allResult = await listPlayers({
      ...options,
      status: 'all',
      page: 1,
      limit: 50,
    });
    const intelMap = await getIntelMapForExternalIds(
      allResult.players.map((p) => p.externalId)
    );
    let players = allResult.players.map((player) =>
      mergePlayerWithIntel(player, intelMap.get(player.externalId))
    );
    players = filterPlayersByIntelStatus(players, status);
    if (status === 'priority') {
      players = sortPlayersByIntelPriority(players);
    } else {
      players.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
    }

    const paged = paginatePlayers(players, options.page, options.limit);
    return {
      ...paged,
      status,
      aiAvailable: hasAiProvider(),
    };
  }

  const result = await listPlayers(options);
  const intelMap = await getIntelMapForExternalIds(result.players.map((p) => p.externalId));
  let players = result.players.map((player) =>
    mergePlayerWithIntel(player, intelMap.get(player.externalId))
  );
  if (status === 'priority') {
    players = sortPlayersByIntelPriority(players);
  }

  return {
    ...result,
    players,
    aiAvailable: hasAiProvider(),
  };
}

export async function getPlayerByIdWithIntel(id) {
  const player = await getPlayerById(id, { skipExternalMatches: true });
  if (!player) return null;

  const intel = await AiPlayerIntel.findOne({ playerExternalId: player.externalId }).lean();
  return mergePlayerWithIntel(player, intel);
}

export async function refreshTeamPlayerIntel(teamCode, { force = false, fetchImpl = fetch } = {}) {
  if (!hasAiProvider()) throw new Error('IA no configurada');

  const team = await resolveTeam(teamCode);
  if (!team) throw new Error('Selección no encontrada');

  const rosterPlayers = await Player.find({
    $or: [{ teamExternalId: team.externalId }, { fifaCode: team.fifaCode }],
  }).lean();

  if (!rosterPlayers.length) {
    throw new Error('No hay jugadores en el plantel local para esta selección');
  }

  if (!force) {
    const existing = await AiPlayerIntel.find({
      playerExternalId: { $in: rosterPlayers.map((p) => p.externalId) },
    }).lean();
    const freshCount = existing.filter((row) => isIntelFresh(row)).length;
    if (freshCount >= Math.min(8, rosterPlayers.length * 0.6)) {
      return {
        team: team.fifaCode,
        updated: 0,
        skipped: rosterPlayers.length,
        source: 'cache',
        message: 'Datos IA recientes para esta selección',
      };
    }
  }

  const { data, source } = await callAiForJson(buildTeamIntelPrompt(team, rosterPlayers), {
    fetchImpl,
  });
  const entries = Array.isArray(data?.players) ? data.players : [];
  const meta = { source, model: aiModelForScoreSource(source) };

  let updated = 0;
  for (const rawEntry of entries) {
    const aiEntry = normalizeAiPlayerEntry(rawEntry);
    if (!aiEntry) continue;
    const player = matchAiEntryToPlayer(aiEntry, rosterPlayers);
    if (!player) continue;
    await upsertIntelForPlayer(player, aiEntry, meta);
    updated += 1;
  }

  return {
    team: team.fifaCode,
    teamName: team.nameEn,
    updated,
    skipped: rosterPlayers.length - updated,
    source,
    model: meta.model,
    teamNotes: String(data?.teamNotes ?? '').trim(),
  };
}

export async function refreshPlayerIntel(playerId, { fetchImpl = fetch } = {}) {
  if (!hasAiProvider()) throw new Error('IA no configurada');

  const player = await Player.findById(playerId).lean();
  if (!player) throw new Error('Jugador no encontrado');

  const team = await Team.findOne({
    $or: [{ externalId: player.teamExternalId }, { fifaCode: player.fifaCode }],
  }).lean();

  const { data, source } = await callAiForJson(buildPlayerDetailPrompt(player, team), {
    fetchImpl,
  });
  const aiEntry = normalizeAiPlayerEntry({ ...data, fullName: player.fullName });
  if (!aiEntry) throw new Error('La IA devolvió datos inválidos');

  const intel = await upsertIntelForPlayer(player, aiEntry, {
    source,
    model: aiModelForScoreSource(source),
  });

  return mergePlayerWithIntel(
    await getPlayerById(playerId, { skipExternalMatches: true }),
    intel
  );
}

export async function askPlayerIntelFollowUp(playerId, question, { fetchImpl = fetch } = {}) {
  if (!hasAiProvider()) throw new Error('IA no configurada');

  const trimmed = String(question ?? '').trim();
  if (!trimmed) throw new Error('Escribí una pregunta');
  if (trimmed.length > 500) throw new Error('La pregunta es demasiado larga');

  const player = await getPlayerByIdWithIntel(playerId);
  if (!player) throw new Error('Jugador no encontrado');

  const prompt = `Sos un analista del Mundial FIFA 2026.
Jugador: ${player.fullName} (${player.fifaCode})
Estado IA actual: ${player.healthLabel}. ${player.injuryInfo || 'Sin lesión reportada'}.
Tarjetas: ${player.yellowCards ?? 0} amarillas, ${player.redCards ?? 0} rojas. Suspendido: ${player.suspended ? 'sí' : 'no'}.
Resumen: ${player.aiSummary || 'sin resumen'}

Pregunta: ${trimmed}

Respondé en español, breve y concreto (máximo 3 párrafos).`;

  const result = await callAiForText(prompt, { fetchImpl });
  return {
    answer: result.text,
    source: result.source,
    model: aiModelForScoreSource(result.source),
  };
}
