const TOKEN_KEY = 'token';
const EXPIRES_KEY = 'sessionExpiresAt';

export function getStoredToken() {
  if (isStoredSessionExpired()) {
    clearStoredSession();
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function isStoredSessionExpired() {
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (!expiresAt) return false;
  return Date.now() >= new Date(expiresAt).getTime();
}

export function saveStoredSession({ token, expiresAt }) {
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) {
    localStorage.setItem(EXPIRES_KEY, expiresAt);
  } else {
    localStorage.removeItem(EXPIRES_KEY);
  }
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function formatSessionExpiry(expiresAt) {
  if (!expiresAt) return '';
  return new Date(expiresAt).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
