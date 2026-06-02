const STORAGE_KEY = 'mundial2026-scheduled-matches';

export function getScheduledMatchIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function saveScheduledMatchIds(ids) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function markMatchScheduled(matchId) {
  const ids = getScheduledMatchIds();
  ids.add(matchId);
  saveScheduledMatchIds(ids);
  return ids;
}

export function markMatchesScheduled(matchIds) {
  const ids = getScheduledMatchIds();
  for (const id of matchIds) ids.add(id);
  saveScheduledMatchIds(ids);
  return ids;
}
