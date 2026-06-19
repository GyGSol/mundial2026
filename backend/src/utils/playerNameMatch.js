export function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchNameToRosterPlayer(name, rosterPlayers = []) {
  const target = normalizeName(name);
  if (!target) return null;

  const exact = rosterPlayers.find((player) => normalizeName(player.fullName) === target);
  if (exact) return exact;

  return (
    rosterPlayers.find((player) => {
      const rosterName = normalizeName(player.fullName);
      return rosterName.includes(target) || target.includes(rosterName);
    }) ?? null
  );
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
    return { name: trimmed, position: null, shirtNumber: null, photoUrl: null };
  }

  const matched = matchNameToRosterPlayer(trimmed, rosterPlayers);
  if (!matched) {
    return { name: trimmed, position: null, shirtNumber: null, photoUrl: null };
  }

  const photoUrl = matched.photoUrl ? String(matched.photoUrl) : null;

  return {
    name: matched.fullName,
    position: matched.position ?? null,
    shirtNumber: matched.shirtNumber ?? null,
    photoUrl,
  };
}
