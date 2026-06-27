const SESSION_KEY = 'mundial2026:teamKitsBundle';

/** @type {Promise<Record<string, object>> | null} */
let inFlight = null;

async function fetchKitsBundle() {
  const res = await fetch('/api/teams/kits-bundle');
  if (!res.ok) {
    throw new Error('No se pudo cargar indumentaria');
  }
  const payload = await res.json();
  return payload?.kits ?? {};
}

/**
 * @param {string} fifaCode
 * @returns {Promise<object | null>}
 */
export async function loadTeamKitFromClientCache(fifaCode) {
  const code = String(fifaCode ?? '').trim().toUpperCase();
  if (!code) return null;

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const kits = JSON.parse(raw);
      if (kits?.[code]?.parts?.body) return kits[code];
    }
  } catch {
    // ignore quota / parse errors
  }

  if (!inFlight) {
    inFlight = fetchKitsBundle()
      .then((kits) => {
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(kits));
        } catch {
          // ignore quota
        }
        return kits;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  const kits = await inFlight;
  return kits?.[code]?.parts?.body ? kits[code] : null;
}

/** Test helper */
export function clearTeamKitClientCache() {
  inFlight = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
