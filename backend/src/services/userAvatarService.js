import { AI_USER_AVATAR_URL } from '../constants/aiUser.js';

const ALLOWED_PREFIXES = ['data:image/jpeg;base64,', 'data:image/webp;base64,'];
const MAX_DECODED_BYTES = 120 * 1024;

/**
 * @param {unknown} value
 * @returns {string | null | undefined} normalized value, undefined = no change, null = clear
 */
export function normalizeAvatarDataUrlInput(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (typeof value !== 'string') {
    const err = new Error('La foto de perfil debe ser una imagen válida');
    err.status = 400;
    throw err;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const prefix = ALLOWED_PREFIXES.find((p) => trimmed.startsWith(p));
  if (!prefix) {
    const err = new Error('La foto debe ser JPEG o WebP');
    err.status = 400;
    throw err;
  }

  const base64 = trimmed.slice(prefix.length);
  if (!base64 || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
    const err = new Error('La foto de perfil no es válida');
    err.status = 400;
    throw err;
  }

  const decodedBytes = Buffer.byteLength(base64, 'base64');
  if (decodedBytes > MAX_DECODED_BYTES) {
    const err = new Error('La foto es demasiado grande (máx. 120 KB)');
    err.status = 400;
    throw err;
  }

  return trimmed;
}

const DATA_URL_RE = /^data:(image\/(?:jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

/** @param {string | null | undefined} dataUrl */
export function decodeAvatarDataUrl(dataUrl) {
  if (!dataUrl) return null;
  const match = String(dataUrl).trim().match(DATA_URL_RE);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

/** @param {string} userId */
export function getUserAvatarPublicPath(userId) {
  return `/api/users/${userId}/avatar`;
}

/** URL pública para ranking/header: moneda Fubol en IA, API en humanos con foto. */
export function resolvePublicAvatarUrl({ isAiUser, avatarDataUrl, userId }) {
  if (isAiUser) return AI_USER_AVATAR_URL;
  if (avatarDataUrl) return getUserAvatarPublicPath(userId);
  return null;
}
