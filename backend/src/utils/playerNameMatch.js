export function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function nameVariantKeys(fullName) {
  const normalized = normalizeName(fullName);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const keys = new Set([tokens.join(' '), [...tokens].reverse().join(' ')]);
  return [...keys];
}

export function tokensMatchAnyOrder(a, b) {
  const left = normalizeName(a).split(/\s+/).filter(Boolean).sort();
  const right = normalizeName(b).split(/\s+/).filter(Boolean).sort();
  if (!left.length || left.length !== right.length) return false;
  return left.every((token, index) => token === right[index]);
}

function scoreNameMatch(target, player) {
  const targetNorm = normalizeName(target);
  if (!targetNorm) return 0;

  const rosterNorm = normalizeName(player?.fullName);
  if (targetNorm === rosterNorm) return 100;

  const rosterTokens = rosterNorm.split(/\s+/).filter(Boolean);
  const targetTokens = targetNorm.split(/\s+/).filter(Boolean);

  if (rosterTokens.length && targetNorm === [...rosterTokens].reverse().join(' ')) return 95;
  if (tokensMatchAnyOrder(target, player.fullName)) return 90;

  for (const alias of player?.aliasNames ?? []) {
    const aliasNorm = normalizeName(alias);
    if (targetNorm === aliasNorm) return 90;
    if (tokensMatchAnyOrder(target, alias)) return 88;
  }

  if (player?.nameLookupKeys?.includes(targetNorm)) return 87;

  if (targetTokens.length >= 1 && rosterTokens.length >= 2) {
    const targetLast = targetTokens[targetTokens.length - 1];
    const rosterLast = rosterTokens[rosterTokens.length - 1];
    if (targetLast.length > 2 && targetLast === rosterLast) {
      if (targetTokens.length === 1) return 75;
      if (targetTokens[0][0] === rosterTokens[0][0]) return 80;
    }
  }

  if (rosterNorm && (rosterNorm.includes(targetNorm) || targetNorm.includes(rosterNorm))) {
    return 50 + Math.min(targetNorm.length, rosterNorm.length) / 100;
  }

  return 0;
}

export function matchNameToRosterPlayer(name, rosterPlayers = []) {
  const target = normalizeName(name);
  if (!target) return null;

  let best = null;
  let bestScore = 0;

  for (const player of rosterPlayers) {
    const score = scoreNameMatch(target, player);
    if (score > bestScore) {
      bestScore = score;
      best = player;
    }
  }

  return bestScore >= 70 ? best : null;
}

export function canonicalPlayerName(name, rosterPlayers = []) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return trimmed;
  return matchNameToRosterPlayer(trimmed, rosterPlayers)?.fullName ?? trimmed;
}

export function rosterPositionForName(name, rosterPlayers = []) {
  return matchNameToRosterPlayer(name, rosterPlayers)?.position ?? null;
}

export function enrichNameFromRoster(name, rosterPlayers = []) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return { name: trimmed, position: null, shirtNumber: null, photoUrl: null, mongoId: null, externalId: null };
  }

  const matched = matchNameToRosterPlayer(trimmed, rosterPlayers);
  if (!matched) {
    return { name: trimmed, position: null, shirtNumber: null, photoUrl: null, mongoId: null, externalId: null };
  }

  const photoUrl = matched.photoUrl ? String(matched.photoUrl) : null;
  const mongoId = matched.mongoId ? String(matched.mongoId) : null;
  const externalId = matched.externalId ? String(matched.externalId) : null;

  return {
    name: matched.fullName,
    position: matched.position ?? null,
    shirtNumber: matched.shirtNumber ?? null,
    photoUrl,
    mongoId,
    externalId,
  };
}
