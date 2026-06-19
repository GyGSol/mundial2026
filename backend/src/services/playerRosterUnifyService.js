import { normalizeName, nameVariantKeys, tokensMatchAnyOrder } from '../utils/playerNameMatch.js';
import { mapPlayerToTimelineRosterEntry } from './playerPhotoService.js';

export function isOfficialSquadExternalId(externalId) {
  return /^[A-Z]{3}-/.test(String(externalId ?? ''));
}

function playerIdentityScore(player) {
  let score = 0;
  if (isOfficialSquadExternalId(player.externalId)) score += 1000;
  if (player.photoKey) score += 100;
  if (player.shirtNumber != null) score += 10;
  if (player.footballDataPersonId) score += 5;
  const name = String(player.fullName ?? '');
  if (name && name !== name.toUpperCase()) score += 3;
  return score;
}

export function areSamePlayer(a, b) {
  if (!a || !b) return false;

  const fdA = a.footballDataPersonId;
  const fdB = b.footballDataPersonId;
  if (fdA && fdB && String(fdA) === String(fdB)) return true;

  if (tokensMatchAnyOrder(a.fullName, b.fullName)) return true;

  const keysA = new Set(nameVariantKeys(a.fullName));
  const keysB = nameVariantKeys(b.fullName);
  return keysB.some((key) => keysA.has(key));
}

export function pickCanonicalPlayer(candidates = []) {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => playerIdentityScore(b) - playerIdentityScore(a))[0];
}

/**
 * Deduplica jugadores del mismo equipo (seed oficial vs Football-Data) y devuelve
 * entradas de roster listas para enriquecer la cronología en vivo.
 *
 * @param {Array<Record<string, unknown>>} players
 */
export function unifyRawTeamPlayers(players = []) {
  if (!players.length) return [];

  const groups = [];
  const used = new Set();

  for (let i = 0; i < players.length; i += 1) {
    if (used.has(i)) continue;
    const group = [players[i]];
    used.add(i);

    for (let j = i + 1; j < players.length; j += 1) {
      if (used.has(j)) continue;
      if (areSamePlayer(players[i], players[j])) {
        group.push(players[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups.map((group) => {
    const canonical = pickCanonicalPlayer(group);
    const lookupKeys = new Set();
    const aliasNames = new Set();
    const aliasExternalIds = new Set();

    for (const player of group) {
      for (const key of nameVariantKeys(player.fullName)) lookupKeys.add(key);
      if (player.fullName) aliasNames.add(String(player.fullName));
      if (player.externalId) aliasExternalIds.add(String(player.externalId));
    }

    return {
      ...mapPlayerToTimelineRosterEntry(canonical),
      aliasNames: [...aliasNames],
      aliasExternalIds: [...aliasExternalIds],
      nameLookupKeys: [...lookupKeys],
    };
  });
}

/**
 * @param {Array<Record<string, unknown>>} players
 */
export function groupUnifiedRostersByTeam(players = []) {
  const rawByTeam = new Map();

  for (const player of players) {
    const teamId = player.teamExternalId;
    if (!teamId) continue;
    const list = rawByTeam.get(teamId) ?? [];
    list.push(player);
    rawByTeam.set(teamId, list);
  }

  const byTeamExternalId = new Map();
  const byFifaCode = new Map();

  for (const [teamId, teamPlayers] of rawByTeam) {
    const unified = unifyRawTeamPlayers(teamPlayers);
    byTeamExternalId.set(teamId, unified);

    for (const entry of unified) {
      const code = String(
        teamPlayers.find((p) => p.externalId === entry.externalId)?.fifaCode ??
          teamPlayers[0]?.fifaCode ??
          ''
      ).toUpperCase();
      if (!code) continue;
      const list = byFifaCode.get(code) ?? [];
      list.push(entry);
      byFifaCode.set(code, list);
    }
  }

  return { byTeamExternalId, byFifaCode };
}

/**
 * @param {{ mongoId?: string | null, externalId?: string | null, fullName?: string | null }} identity
 * @param {Map<string, Array<Record<string, unknown>>>} unifiedRosterByTeam
 */
export function expandIdentityKeysFromUnifiedRosters(identity = {}, unifiedRosterByTeam = new Map()) {
  const mongoIds = new Set();
  const externalIds = new Set();
  const names = new Set();

  if (identity.mongoId) mongoIds.add(String(identity.mongoId));
  if (identity.externalId) externalIds.add(String(identity.externalId));
  if (identity.fullName) names.add(normalizeName(identity.fullName));

  for (const roster of unifiedRosterByTeam.values()) {
    for (const entry of roster) {
      const matchesIdentity =
        (identity.mongoId && entry.mongoId === String(identity.mongoId)) ||
        (identity.externalId &&
          (entry.externalId === identity.externalId ||
            entry.aliasExternalIds?.includes(String(identity.externalId)))) ||
        (identity.fullName &&
          (entry.nameLookupKeys?.includes(normalizeName(identity.fullName)) ||
            normalizeName(entry.fullName) === normalizeName(identity.fullName)));

      if (!matchesIdentity) continue;

      if (entry.mongoId) mongoIds.add(String(entry.mongoId));
      if (entry.externalId) externalIds.add(String(entry.externalId));
      for (const ext of entry.aliasExternalIds ?? []) externalIds.add(String(ext));
      for (const alias of entry.aliasNames ?? []) names.add(normalizeName(alias));
      names.add(normalizeName(entry.fullName));
      for (const key of entry.nameLookupKeys ?? []) names.add(key);
    }
  }

  return { mongoIds, externalIds, names };
}
