const STORAGE_KEY = 'mundial2026-scheduled-matches';
const SCHEDULE_ALL_KEY = 'mundial2026-schedule-all-used';

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

/** Tras guardar/editar predicción: el .ics anterior queda desactualizado. */
export function unmarkMatchScheduled(matchId) {
  const ids = getScheduledMatchIds();
  ids.delete(matchId);
  saveScheduledMatchIds(ids);
  return ids;
}

/** Una vez usado "Agendar todos", no volver a mostrar el botón en este dispositivo. */
export function hasUsedScheduleAll() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SCHEDULE_ALL_KEY) === '1';
}

export function markScheduleAllUsed() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SCHEDULE_ALL_KEY, '1');
}
