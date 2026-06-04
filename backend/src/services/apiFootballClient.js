import { env } from '../config/env.js';

export const API_FOOTBALL_BASE_URL =
  process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

export class ApiFootballNotConfiguredError extends Error {
  constructor() {
    super('API_FOOTBALL_KEY no está configurada');
    this.name = 'ApiFootballNotConfiguredError';
  }
}

export function isApiFootballConfigured() {
  return Boolean(env.apiFootballKey?.trim());
}

export async function apiFootballGet(resourcePath, params = {}) {
  if (!isApiFootballConfigured()) {
    throw new ApiFootballNotConfiguredError();
  }

  const url = new URL(resourcePath.replace(/^\//, ''), `${API_FOOTBALL_BASE_URL}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: { 'x-apisports-key': env.apiFootballKey.trim() },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      body?.message || body?.errors?.requests || `API-Football ${res.status}`;
    throw new Error(String(message));
  }

  if (body?.errors && Object.keys(body.errors).length > 0) {
    const message = Object.values(body.errors).join('; ') || 'API-Football error';
    throw new Error(String(message));
  }

  return body;
}
