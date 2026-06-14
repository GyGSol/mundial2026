import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

const EVENT_LINK_PATTERN = /href=["']([^"']*(?:\/evento\/|\/eventos\/)[^"']*)["']/gi;
const TITLE_PATTERN = />([^<]{4,120})<\//g;
const AGENDA_JSON_PATH = '/eventos/json/agenda123.json';
const AGENDA_CACHE_TTL_MS = 60_000;

const STREAM_SLUG_LABELS = {
  disney6: 'Disney+',
  dsports: 'DSports',
  dsports2: 'DSports 2',
  tyc: 'TyC Sports',
  tycsports: 'TyC Sports',
  telefe: 'Telefe',
  vtvplus: 'VTV Plus',
  americatv: 'América TV',
  caracol: 'Caracol',
  sportv: 'Sportv',
  espndeportes: 'ESPN Deportes',
  tntsportschile: 'TNT Sports Chile',
  foxsports: 'Fox Sports',
};

const TEAM_ALIASES = {
  haiti: ['haiti', 'haití', 'hai', 'hti'],
  scotland: ['scotland', 'escocia', 'sco'],
  brazil: ['brazil', 'brasil', 'bra'],
  morocco: ['morocco', 'marruecos', 'mar'],
  argentina: ['argentina', 'arg'],
};

let agendaCache = { fetchedAt: 0, entries: [] };

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `${baseUrl}${href}`;
  return `${baseUrl}/${href.replace(/^\//, '')}`;
}

function extractEventId(url) {
  try {
    const parsed = new URL(url);
    const stream = parsed.searchParams.get('stream');
    if (stream) return stream;

    const pathname = parsed.pathname;
    const segments = pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  } catch {
    return '';
  }
}

function normalizeTeamToken(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function collectTeamTokens(team) {
  const tokens = new Set();
  for (const value of [team?.name, team?.nameEn, team?.shortName, team?.externalId, team?.fifaCode]) {
    const normalized = normalizeTeamToken(value);
    if (normalized) tokens.add(normalized);
  }
  return [...tokens];
}

function expandTeamTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const aliases of Object.values(TEAM_ALIASES)) {
      if (aliases.some((alias) => token.includes(alias) || alias.includes(token))) {
        aliases.forEach((alias) => expanded.add(alias));
      }
    }
  }
  return [...expanded];
}

function hashLink(url) {
  return createHash('sha1').update(url).digest('hex').slice(0, 10);
}

export function labelStreamLink(url, language = '') {
  const link = String(url ?? '').trim();
  if (!link) return 'Stream';

  try {
    const parsed = new URL(link);
    const stream = parsed.searchParams.get('stream');
    if (stream) {
      const label = STREAM_SLUG_LABELS[stream] || stream;
      return language ? `${label} (${language})` : label;
    }

    if (parsed.hostname.includes('workers.dev') || parsed.pathname.includes('/mpd/drm')) {
      return language ? `DRM (${language || 'externo'})` : 'DRM externo';
    }

    if (parsed.pathname.includes('/mpd/drm')) {
      return language ? `DRM (${language || '—'})` : 'DRM';
    }
  } catch {
    // ignore invalid URL
  }

  return language ? `Stream (${language})` : 'Stream';
}

export function sourceIdFromLink(url) {
  const link = String(url ?? '').trim();
  if (!link) return '';

  try {
    const parsed = new URL(link);
    const stream = parsed.searchParams.get('stream');
    if (stream) return stream;
  } catch {
    return '';
  }

  return `link-${hashLink(link)}`;
}

function streamSortRank(url) {
  const link = String(url ?? '');
  if (link.includes('/vivo/canales.php?stream=')) return 0;
  if (link.includes('la18hd.com/mpd/')) return 1;
  return 2;
}

export function buildStreamSource(link, language = '') {
  const url = String(link ?? '').trim();
  const id = sourceIdFromLink(url);
  const label = labelStreamLink(url, language);
  const embeddable =
    url.includes('la18hd.com/vivo/canales.php') ||
    url.includes('la18hd.com/evento') ||
    url.includes('la18hd.com/mpd/drm.php');

  return {
    id,
    label,
    language: String(language ?? '').trim(),
    url,
    pageUrl: url,
    embedUrl: url,
    eventId: extractEventId(url),
    embeddable,
    provider: 'la18hd',
  };
}

/**
 * Agrupa filas del JSON agenda (mismo título + hora + fecha → un evento con N links).
 * @param {Array<{ title?: string, link?: string, time?: string, date?: string, language?: string, category?: string, status?: string }>} entries
 */
export function groupAgendaEntries(entries) {
  const groups = new Map();

  for (const row of entries ?? []) {
    const title = String(row?.title ?? '').trim();
    const link = String(row?.link ?? '').trim();
    if (!title || !link) continue;

    const key = `${row?.date ?? ''}|${row?.time ?? ''}|${normalizeTeamToken(title)}`;
    const existing = groups.get(key) ?? {
      title,
      time: row?.time ?? '',
      date: row?.date ?? '',
      category: row?.category ?? '',
      status: row?.status ?? '',
      streams: [],
      seenUrls: new Set(),
    };

    if (existing.seenUrls.has(link)) continue;
    existing.seenUrls.add(link);
    existing.streams.push(buildStreamSource(link, row?.language));
    groups.set(key, existing);
  }

  return [...groups.values()].map(({ seenUrls: _seen, ...event }) => ({
    ...event,
    streams: event.streams.sort((a, b) => streamSortRank(a.url) - streamSortRank(b.url)),
  }));
}

function scoreEventForMatch(event, homeTeamName, awayTeamName, homeTeam, awayTeam) {
  const haystack = normalizeTeamToken(event.title);
  const homeTokens = expandTeamTokens([
    normalizeTeamToken(homeTeamName),
    ...collectTeamTokens(homeTeam),
  ]).filter(Boolean);
  const awayTokens = expandTeamTokens([
    normalizeTeamToken(awayTeamName),
    ...collectTeamTokens(awayTeam),
  ]).filter(Boolean);

  if (!haystack || (!homeTokens.length && !awayTokens.length)) return 0;

  let score = 0;
  for (const token of homeTokens) {
    if (token.length >= 3 && haystack.includes(token)) score += 2;
  }
  for (const token of awayTokens) {
    if (token.length >= 3 && haystack.includes(token)) score += 2;
  }

  const homeHit = homeTokens.some((token) => token.length >= 3 && haystack.includes(token));
  const awayHit = awayTokens.some((token) => token.length >= 3 && haystack.includes(token));
  if (homeHit && awayHit) score += 4;

  return score;
}

/**
 * @param {import('../models/Match.js').Match} match
 * @param {ReturnType<typeof groupAgendaEntries>} events
 */
export function rankLa18EventsForMatch(
  match,
  events,
  homeTeamName = '',
  awayTeamName = '',
  homeTeam = null,
  awayTeam = null
) {
  return [...events]
    .map((event) => ({
      ...event,
      score: scoreEventForMatch(event, homeTeamName, awayTeamName, homeTeam, awayTeam),
    }))
    .filter((event) => event.score > 0)
    .sort((a, b) => b.score - a.score || b.streams.length - a.streams.length);
}

export async function fetchLa18AgendaEntries(fetchImpl = fetch, { forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && agendaCache.entries.length && now - agendaCache.fetchedAt < AGENDA_CACHE_TTL_MS) {
    return agendaCache.entries;
  }

  const agendaUrl = `${env.la18hdBaseUrl}${AGENDA_JSON_PATH}`;
  const response = await fetchImpl(agendaUrl, {
    headers: {
      'User-Agent': 'Mundial2026-Stream/1.0',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`La18HD agenda respondió ${response.status}`);
  }

  const raw = await response.json();
  const entries = Array.isArray(raw) ? raw : [];
  agendaCache = { fetchedAt: now, entries };
  return entries;
}

export async function fetchLa18AgendaEvents(fetchImpl = fetch, options = {}) {
  const entries = await fetchLa18AgendaEntries(fetchImpl, options);
  return groupAgendaEntries(entries);
}

/**
 * Encuentra el evento La18HD con todos sus streams para un partido.
 */
export async function resolveLa18StreamsForMatch(
  match,
  { homeTeam = null, awayTeam = null, fetchImpl = fetch } = {}
) {
  const events = await fetchLa18AgendaEvents(fetchImpl);
  const homeTeamName = homeTeam?.nameEn || homeTeam?.name || '';
  const awayTeamName = awayTeam?.nameEn || awayTeam?.name || '';
  const ranked = rankLa18EventsForMatch(match, events, homeTeamName, awayTeamName, homeTeam, awayTeam);

  if (!ranked.length) {
    return { event: null, streams: [], sourceUrl: `${env.la18hdBaseUrl}${AGENDA_JSON_PATH}` };
  }

  const best = ranked[0];
  return {
    event: {
      title: best.title,
      time: best.time,
      date: best.date,
      status: best.status,
      score: best.score,
    },
    streams: best.streams,
    sourceUrl: `${env.la18hdBaseUrl}${AGENDA_JSON_PATH}`,
  };
}

/**
 * Parsea HTML de la18hd.com/eventos/ y devuelve candidatos (legacy).
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
      streams: [buildStreamSource(url)],
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

const HLS_URL_PATTERN = /https?:\/\/[^"'<>\s]+\.m3u8[^"'<>\s]*/i;

/** Extrae la primera URL .m3u8 del HTML de una página La18HD. */
export function extractHlsUrlFromHtml(html) {
  if (!html?.trim()) return null;
  const match = html.match(HLS_URL_PATTERN);
  return match?.[0] ?? null;
}

/**
 * Resuelve la URL HLS actual desde la página La18HD (token con expiración corta).
 * @param {string} pageUrl
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchLa18HlsUrl(pageUrl, fetchImpl = fetch) {
  const url = String(pageUrl ?? '').trim();
  if (!url) return null;

  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': 'Mundial2026-Stream/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return null;
  const html = await response.text();
  return extractHlsUrlFromHtml(html);
}

function mappingToStreamSource(mapping) {
  const url = mapping.embedUrl || mapping.la18PageUrl;
  if (!url) return null;

  const source = buildStreamSource(url, mapping.notes || 'Admin');
  return {
    ...source,
    id: mapping.la18EventId || source.id,
    label: mapping.notes?.trim() ? mapping.notes.trim() : source.label,
    source: mapping.auto ? 'auto' : 'admin',
  };
}

function dedupeStreams(streams) {
  const seen = new Set();
  return streams.filter((stream) => {
    if (!stream?.url || seen.has(stream.url)) return false;
    seen.add(stream.url);
    return true;
  });
}

export function mergeStreamSources(adminMapping, la18Streams = []) {
  const merged = [];
  const adminSource = adminMapping ? mappingToStreamSource(adminMapping) : null;
  if (adminSource) merged.push(adminSource);

  for (const stream of la18Streams) {
    if (adminSource && stream.url === adminSource.url) continue;
    merged.push({ ...stream, source: 'la18hd' });
  }

  return dedupeStreams(merged);
}

/**
 * Fetch remoto (admin suggestions o stream config).
 */
export async function fetchLa18EventSuggestions(
  match,
  homeTeamName = '',
  awayTeamName = '',
  homeTeam = null,
  awayTeam = null
) {
  if (!env.la18hdScraperEnabled && !env.liveStreamEnabled) {
    return { enabled: false, suggestions: [], streams: [] };
  }

  try {
    const { event, streams, sourceUrl } = await resolveLa18StreamsForMatch(match, {
      homeTeam: homeTeam ?? { name: homeTeamName, nameEn: homeTeamName },
      awayTeam: awayTeam ?? { name: awayTeamName, nameEn: awayTeamName },
    });

    const suggestions = streams.map((stream) => ({
      title: event?.title ? `${event.title} · ${stream.label}` : stream.label,
      url: stream.url,
      eventId: stream.eventId,
      label: stream.label,
      language: stream.language,
    }));

    return {
      enabled: true,
      suggestions,
      streams,
      event,
      sourceUrl,
    };
  } catch (err) {
    if (!env.la18hdScraperEnabled) {
      return { enabled: false, suggestions: [], streams: [] };
    }
    throw err;
  }
}

/** Solo tests: limpia cache de agenda. */
export function clearLa18AgendaCacheForTests() {
  agendaCache = { fetchedAt: 0, entries: [] };
}
