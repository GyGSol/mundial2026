/** Kickoff used for stable tournament order (official fixture when present). */
export function matchScheduleKickoffMs(match) {
  const raw = match?.scheduleKickoffAt ?? match?.kickoffAt;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function compareMatchesBySchedule(a, b) {
  const ta = matchScheduleKickoffMs(a);
  const tb = matchScheduleKickoffMs(b);
  if (ta !== tb) return ta - tb;

  const extA = String(a?.externalId ?? '');
  const extB = String(b?.externalId ?? '');
  const aIsNum = /^\d+$/.test(extA);
  const bIsNum = /^\d+$/.test(extB);
  if (aIsNum && bIsNum) {
    const diff = Number(extA) - Number(extB);
    if (diff !== 0) return diff;
  } else if (extA !== extB) {
    return extA.localeCompare(extB, undefined, { numeric: true });
  }

  const idA = String(a?.id ?? '');
  const idB = String(b?.id ?? '');
  return idA.localeCompare(idB);
}

export function sortMatchesBySchedule(matches = []) {
  return [...matches].sort(compareMatchesBySchedule);
}

export function compareMatchesByKickoffDesc(a, b) {
  const ta = matchScheduleKickoffMs(a);
  const tb = matchScheduleKickoffMs(b);
  if (ta !== tb) return tb - ta;
  return compareMatchesBySchedule(a, b);
}

export function sortMatchesByKickoffDesc(matches = []) {
  return [...matches].sort(compareMatchesByKickoffDesc);
}
