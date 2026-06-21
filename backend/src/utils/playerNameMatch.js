/** Normaliza para matching: NFD + minúsculas + turco (ı/İ → i). */
export function normalizeName(value) {
  return String(value || '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Tokens separados por espacios o guiones (Young-woo → young, woo). */
export function nameTokens(value) {
  return normalizeName(value)
    .split(/[\s-]+/)
    .filter(Boolean);
}

/** Clave sin espacios ni guiones: "Seol Young-woo" y "SEOL Youngwoo" → "seolyoungwoo". */
export function compactNameKey(value) {
  return nameTokens(value).join('');
}

export function nameVariantKeys(fullName) {
  const tokens = nameTokens(fullName);
  if (!tokens.length) return [];

  const keys = new Set([
    tokens.join(' '),
    [...tokens].reverse().join(' '),
    compactNameKey(fullName),
  ]);
  return [...keys];
}

export function tokensMatchAnyOrder(a, b) {
  const left = nameTokens(a).sort();
  const right = nameTokens(b).sort();
  if (!left.length || left.length !== right.length) return false;
  return left.every((token, index) => token === right[index]);
}

/** Variantes de transliteración árabe/latina (mismo jugador, distinto spelling en fuentes). */
const TRANSLITERATION_TOKEN_ALIASES = {
  feras: ['firas'],
  firas: ['feras'],
  brikan: ['buraikan'],
  buraikan: ['brikan'],
  mehdi: ['mahdi'],
  mahdi: ['mehdi'],
};

function tokenAliasSet(token) {
  return new Set([token, ...(TRANSLITERATION_TOKEN_ALIASES[token] ?? [])]);
}

function tokensEquivalent(leftToken, rightToken) {
  if (leftToken === rightToken) return true;
  const leftAliases = tokenAliasSet(leftToken);
  return leftAliases.has(rightToken);
}

/** Mismos tokens en cualquier orden, tolerando transliteraciones conocidas. */
export function tokensMatchWithTransliterationAliases(a, b) {
  const left = nameTokens(a).sort();
  const right = nameTokens(b).sort();
  if (!left.length || left.length !== right.length) return false;
  return left.every((token, index) => tokensEquivalent(token, right[index]));
}

/** Slugs con sustitución de tokens (ej. feras-al-brikan → firas-al-buraikan). */
export function slugTransliterationVariants(slug) {
  const words = String(slug || '')
    .split('-')
    .filter(Boolean);
  if (!words.length) return [];

  const variants = new Set([words.join('-')]);

  function expand(index, current) {
    if (index >= words.length) {
      variants.add(current.join('-'));
      return;
    }
    const token = words[index];
    const options = tokenAliasSet(token);
    for (const option of options) {
      expand(index + 1, [...current, option]);
    }
  }

  expand(0, []);
  return [...variants];
}

/** Mismo apellido y nombre compatible (Mat / Mathew, Tim / Timothy). */
export function sameSurnameWithCompatibleGivenName(a, b) {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (left.length < 2 || right.length < 2) return false;

  const lastLeft = left[left.length - 1];
  const lastRight = right[right.length - 1];
  if (lastLeft !== lastRight) return false;

  const givenLeft = left.slice(0, -1).join(' ');
  const givenRight = right.slice(0, -1).join(' ');
  if (givenLeft === givenRight) return true;
  if (givenLeft.startsWith(givenRight) || givenRight.startsWith(givenLeft)) return true;

  const shortLeft = left[0];
  const shortRight = right[0];
  if (shortLeft.length >= 3 && shortRight.length >= 3 && shortLeft.slice(0, 3) === shortRight.slice(0, 3)) {
    return true;
  }

  return false;
}

function parseInitialsPlusSurname(name) {
  const tokens = normalizeName(name).split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const surname = tokens[tokens.length - 1];
  const initials = tokens.slice(0, -1).map((token) => token.replace(/\./g, ''));
  if (!initials.length || initials.some((token) => token.length > 2)) return null;
  if (!initials.every((token) => token.length === 1)) return null;

  return { surname, initials };
}

function scoreInitialsSurnameMatch(target, player) {
  const parsed = parseInitialsPlusSurname(target);
  if (!parsed) return 0;

  const tokens = nameTokens(player?.fullName);
  if (tokens.length < 2) return 0;

  let surnameIndex = -1;
  if (tokens[0] === parsed.surname) surnameIndex = 0;
  else if (tokens[tokens.length - 1] === parsed.surname) surnameIndex = tokens.length - 1;
  else return 0;

  const givenTokens = tokens.filter((_, index) => index !== surnameIndex);
  if (givenTokens.length < parsed.initials.length) return 0;

  const initialsFromGiven = givenTokens.map((token) => token[0]).join('');
  if (initialsFromGiven === parsed.initials.join('')) return 88;

  return 0;
}

function scoreNameMatch(target, player) {
  const targetNorm = normalizeName(target);
  if (!targetNorm) return 0;

  const rosterNorm = normalizeName(player?.fullName);
  if (targetNorm === rosterNorm) return 100;

  const rosterTokens = nameTokens(player?.fullName);
  const targetTokens = nameTokens(target);

  if (rosterTokens.length && targetNorm === [...rosterTokens].reverse().join(' ')) return 95;
  if (compactNameKey(target) === compactNameKey(player?.fullName)) return 93;
  if (tokensMatchAnyOrder(target, player.fullName)) return 90;

  const initialsScore = scoreInitialsSurnameMatch(target, player);
  if (initialsScore > 0) return initialsScore;

  for (const alias of player?.aliasNames ?? []) {
    const aliasNorm = normalizeName(alias);
    if (targetNorm === aliasNorm) return 90;
    if (compactNameKey(target) === compactNameKey(alias)) return 89;
    if (tokensMatchAnyOrder(target, alias)) return 88;
  }

  if (player?.nameLookupKeys?.includes(targetNorm)) return 87;
  if (player?.nameLookupKeys?.includes(compactNameKey(target))) return 86;

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

export function matchRosterPlayerByShirtNumber(shirtNumber, rosterPlayers = []) {
  if (shirtNumber == null || !Number.isFinite(Number(shirtNumber))) return null;
  const num = Number(shirtNumber);
  const matches = rosterPlayers.filter((player) => player.shirtNumber === num);
  return matches.length === 1 ? matches[0] : null;
}

export function canonicalPlayerName(name, rosterPlayers = []) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return trimmed;
  return matchNameToRosterPlayer(trimmed, rosterPlayers)?.fullName ?? trimmed;
}

export function rosterPositionForName(name, rosterPlayers = []) {
  return matchNameToRosterPlayer(name, rosterPlayers)?.position ?? null;
}

export function enrichNameFromRoster(name, rosterPlayers = [], { shirtNumber = null } = {}) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return { name: trimmed, position: null, shirtNumber: null, photoUrl: null, mongoId: null, externalId: null };
  }

  let matched = matchNameToRosterPlayer(trimmed, rosterPlayers);
  if (!matched && shirtNumber != null) {
    matched = matchRosterPlayerByShirtNumber(shirtNumber, rosterPlayers);
  }
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
