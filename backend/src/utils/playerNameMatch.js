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
