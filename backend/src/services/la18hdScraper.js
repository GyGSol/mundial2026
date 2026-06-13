import { env } from '../config/env.js';

const EVENT_LINK_PATTERN = /href=["']([^"']*(?:\/evento\/|\/eventos\/)[^"']*)["']/gi;
const TITLE_PATTERN = />([^<]{4,120})<\//g;

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `${baseUrl}${href}`;
  return `${baseUrl}/${href.replace(/^\//, '')}`;
}

function extractEventId(url) {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  } catch {
    return '';
  }
}

/**
 * Parsea HTML de la18hd.com/eventos/ y devuelve candidatos (sin auto-guardar).
 * @param {string} html
 * @param {string} [baseUrl]
 */
export function parseLa18EventList(html, baseUrl = env.la18hdBaseUrl) {
  if (!html?.trim()) return [];

  const seen = new Set();
  const events = [];

  for (const match of html.matchAll(EVENT_LINK_PATTERN)) {
    const url = normalizeUrl(match[1], baseUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    events.push({
      title: '',
      url,
      eventId: extractEventId(url),
    });
  }

  const titles = [...html.matchAll(TITLE_PATTERN)]
    .map((m) => m[1].replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 4 && !/derechos reservados|partidos de hoy/i.test(t));

  events.forEach((event, index) => {
    if (!event.title && titles[index]) {
      event.title = titles[index];
    }
    if (!event.title) {
      event.title = event.eventId || 'Evento La18HD';
    }
  });

  return events;
}

function normalizeTeamToken(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreEventForMatch(event, homeName, awayName) {
  const haystack = normalizeTeamToken(event.title);
  const home = normalizeTeamToken(homeName);
  const away = normalizeTeamToken(awayName);
  if (!haystack || !home || !away) return 0;

  let score = 0;
  if (haystack.includes(home)) score += 2;
  if (haystack.includes(away)) score += 2;
  if (home && away && haystack.includes(`${home}`) && haystack.includes(`${away}`)) score += 2;
  return score;
}

/**
 * @param {import('../models/Match.js').Match} match
 * @param {ReturnType<typeof parseLa18EventList>} events
 */
export function rankLa18EventsForMatch(match, events, homeTeamName = '', awayTeamName = '') {
  return [...events]
    .map((event) => ({
      ...event,
      score: scoreEventForMatch(event, homeTeamName, awayTeamName),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Fetch remoto opcional (admin-only, flag LA18HD_SCRAPER_ENABLED).
 */
export async function fetchLa18EventSuggestions(match, homeTeamName = '', awayTeamName = '') {
  if (!env.la18hdScraperEnabled) {
    return { enabled: false, suggestions: [] };
  }

  const eventsUrl = `${env.la18hdBaseUrl}/eventos/`;
  const response = await fetch(eventsUrl, {
    headers: {
      'User-Agent': 'Mundial2026-Admin/1.0',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`La18HD respondió ${response.status}`);
  }

  const html = await response.text();
  const events = parseLa18EventList(html);
  const suggestions = rankLa18EventsForMatch(match, events, homeTeamName, awayTeamName).slice(0, 12);

  return { enabled: true, suggestions, sourceUrl: eventsUrl };
}
