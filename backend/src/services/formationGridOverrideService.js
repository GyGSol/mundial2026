import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { invalidateMatchRelatedCaches } from './matchRelatedCaches.js';
import { invalidateRankingFinishedMatchesCache } from './rankingFinishedMatchesCache.js';
import {
  applyFormationGridOverridesToLineupPlayers,
  formationOverrideKey,
} from '../../../shared/formationGridOverrides.js';

export const FORMATION_OVERRIDE_SCHEMA_VERSION = 1;

/** @deprecated use formationOverrideKey from shared */
export { formationOverrideKey };

function clampGrid(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Number(n.toFixed(1))));
}

/** Normaliza mapa { "home:10": { gridX, gridY, ... } } desde body admin. */
export function normalizeFormationOverrideMap(input) {
  if (!input || typeof input !== 'object') {
    const error = new Error('overrides debe ser un objeto');
    error.status = 400;
    throw error;
  }

  const players = {};
  for (const [key, value] of Object.entries(input)) {
    if (!/^(home|away):.+$/.test(key) || !value || typeof value !== 'object') continue;
    const gridX = clampGrid(value.gridX);
    const gridY = clampGrid(value.gridY);
    if (gridX == null || gridY == null) continue;
    players[key] = {
      gridX,
      gridY,
      ...(value.shirtNumber != null ? { shirtNumber: value.shirtNumber } : {}),
      ...(value.name ? { name: String(value.name) } : {}),
    };
  }

  return players;
}

export function readFormationGridOverridesFromMatch(match) {
  const stored = match?.raw?.formationGridOverrides;
  if (!stored?.players || typeof stored.players !== 'object') {
    return { version: FORMATION_OVERRIDE_SCHEMA_VERSION, updatedAt: null, players: {} };
  }
  return {
    version: stored.version ?? FORMATION_OVERRIDE_SCHEMA_VERSION,
    updatedAt: stored.updatedAt ?? null,
    updatedBy: stored.updatedBy ?? null,
    players: stored.players,
  };
}

/** Aplica overrides persistidos sobre payload lineup (ranking + admin). */
export function applyFormationGridOverridesToLineup(lineup, matchOrOverrides) {
  if (!lineup || lineup.status === 'unavailable') return lineup;

  const players =
    matchOrOverrides?.players != null
      ? matchOrOverrides.players
      : readFormationGridOverridesFromMatch(matchOrOverrides).players;

  if (!players || !Object.keys(players).length) return lineup;

  const patched = applyFormationGridOverridesToLineupPlayers(lineup, players);

  return {
    ...patched,
    formationOverridesApplied: true,
    formationGridOverrides: players,
  };
}

async function findAdminMatch(matchId) {
  if (!mongoose.Types.ObjectId.isValid(matchId)) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }
  const match = await Match.findById(matchId).lean();
  if (!match) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }
  return match;
}

export async function getAdminFormationGridOverrides(matchId) {
  const match = await findAdminMatch(matchId);
  const data = readFormationGridOverridesFromMatch(match);
  return {
    matchId: String(match._id),
    externalId: match.externalId,
    ...data,
  };
}

export async function saveAdminFormationGridOverrides(matchId, overridesInput, { updatedBy = 'admin' } = {}) {
  const incoming = normalizeFormationOverrideMap(overridesInput);
  const match = await Match.findById(matchId);
  if (!match) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }

  const existing = readFormationGridOverridesFromMatch(match).players;
  const players = { ...existing, ...incoming };

  const payload = {
    version: FORMATION_OVERRIDE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    updatedBy,
    players,
  };

  if (!match.raw || typeof match.raw !== 'object') {
    match.raw = {};
  }
  match.raw.formationGridOverrides = payload;
  match.markModified('raw');
  await match.save();

  invalidateMatchRelatedCaches();
  if (match.status === 'finished') {
    invalidateRankingFinishedMatchesCache();
  }

  return {
    matchId: String(match._id),
    externalId: match.externalId,
    saved: true,
    playerCount: Object.keys(players).length,
    ...payload,
  };
}

export async function clearAdminFormationGridOverrides(matchId) {
  const match = await Match.findById(matchId);
  if (!match) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }

  if (match.raw?.formationGridOverrides) {
    delete match.raw.formationGridOverrides;
    match.markModified('raw');
    await match.save();
    invalidateMatchRelatedCaches();
    if (match.status === 'finished') {
      invalidateRankingFinishedMatchesCache();
    }
  }

  return { matchId: String(match._id), cleared: true };
}
