import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { rankEventsForMatch } from './streamTeamMatching.js';

const AGENDA_PATH = '/agenda.php';
const AGENDA_CACHE_TTL_MS = 60_000;

const CHANNEL_LABEL_IDS = {
  dsports: 'dsports',
  'dsports+': 'dsportsplus',
  'dsports+ op2': 'dsportsplus-op2',
  'dsports op2': 'dsports-op2',
  tyc: 'tyc',
  'tyc sports': 'tyc',
  telefe: 'telefe',
  disney: 'disney',
  'disney+': 'disney',
  fox: 'fox',
  caracol: 'caracol',
  rpc: 'rpc',
  teleamazonas: 'teleamazonas',
  tsn: 'tsn',
  vix: 'vix',
  rcn: 'rcn',
  tudn: 'tudn',
  chilevision: 'chilevision',
};

const PREFERRED_CHANNEL_RANK = [
  'dsports',
  'dsportsplus',
  'tyc',
  'telefe',
  'disney',
  'fox',
  'caracol',
];

let agendaCache = { fetchedAt: 0, events: [] };

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `${baseUrl}${href}`;
  return `${baseUrl}/${href.replace(/^\//, '')}`;
}

function hashLink(url) {
  return createHash('sha1').update(url).digest('hex').slice(0, 10);
}

function channelIdFromLabel(label) {
  const normalized = String(label ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (CHANNEL_LABEL_IDS[normalized]) return CHANNEL_LABEL_IDS[normalized];

  for (const [key, id] of Object.entries(CHANNEL_LABEL_IDS)) {
    if (normalized.includes(key)) return id;
  }

  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `link-${hashLink(label)}`;
}

function sourceIdFromLink(url, label = '') {
  const link = String(url ?? '').trim();
  if (!link) return '';

  try {
    const parsed = new URL(link);
    if (parsed.pathname.includes('/canal/')) {
      const slug = parsed.pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/, '');
      if (slug) return slug;
    }
  } catch {
    // ignore
  }

  const fromLabel = channelIdFromLabel(label);
  if (fromLabel && !fromLabel.startsWith('link-')) return fromLabel;
  return `link-${hashLink(link)}`;
}

function qualityRank(quality) {
  const q = String(quality ?? '').toLowerCase();
  if (q.includes('1080')) return 0;
  if (q.includes('720')) return 1;
  return 2;
}

function channelRank(id) {
  const index = PREFERRED_CHANNEL_RANK.indexOf(id);
  return index === -1 ? 99 : index;
}

export function sortFptStreams(streams) {
  return [...streams].sort((a, b) => {
    const qualityDiff = qualityRank(a.quality) - qualityRank(b.quality);
    if (qualityDiff !== 0) return qualityDiff;
    const channelDiff = channelRank(a.id) - channelRank(b.id);
    if (channelDiff !== 0) return channelDiff;
    return String(a.label).localeCompare(String(b.label));
  });
}

export function pickPreferredFptStream(streams) {
  const sorted = sortFptStreams(streams ?? []);
  return sorted[0] ?? null;
}

export function buildFptStreamSource(link, label = '', quality = '') {
  const url = String(link ?? '').trim();
  const cleanLabel = String(label ?? '').trim() || 'Stream';
  const id = sourceIdFromLink(url, cleanLabel);

  return {
    id,
    label: quality ? `${cleanLabel} (${quality})` : cleanLabel,
    language: '',
    quality: String(quality ?? '').trim(),
    url,
    pageUrl: url,
    embedUrl: url,
    eventId: id,
    embeddable: url.includes('futbolparatodos') || url.includes('/eventos.html') || url.includes('/canal/'),
    provider: 'fpt',
  };
}

/**
 * Parsea HTML de futbolparatodos.su/agenda.php
 * @param {string} html
 * @param {string} [baseUrl]
 */
export function parseFptAgendaHtml(html, baseUrl = env.fptBaseUrl) {
  if (!html?.trim()) return [];

  const events = [];
  const eventPattern =
    /<li class="([^"]+)"><a href="#">\s*([\s\S]*?)<span class="t">(\d{1,2}:\d{2})<\/span><\/a>\s*<ul>([\s\S]*?)<\/ul>\s*<\/li>/gi;

  const streamPattern =
    /<a href="([^"]+)"[^>]*>\s*([^<]+?)\s*<span[^>]*>([^<]*)<\/span>/gi;

  for (const eventMatch of html.matchAll(eventPattern)) {
    const category = eventMatch[1]?.trim() ?? '';
    const title = eventMatch[2].replace(/\s+/g, ' ').trim();
    const time = eventMatch[3].trim();
    const streamsBlock = eventMatch[4] ?? '';

    if (!title) continue;

    const streams = [];
    const seenUrls = new Set();

    for (const streamMatch of streamsBlock.matchAll(streamPattern)) {
      const href = streamMatch[1];
      if (!href.includes('eventos.html')) continue;

      const url = normalizeUrl(href, baseUrl);
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);

      const label = streamMatch[2].replace(/\s+/g, ' ').trim();
      const quality = streamMatch[3].replace(/\s+/g, ' ').trim();
      streams.push(buildFptStreamSource(url, label, quality));
    }

    if (!streams.length && !title.match(/mundial|fifa|copa/i)) continue;

    events.push({
      title,
      time,
      category,
      streams: sortFptStreams(streams),
    });
  }

  return events;
}

/**
 * Extrae slugs de /canal/*.html desde la home de FPT.
 * @param {string} html
 */
export function parseFptChannelCatalog(html) {
  if (!html?.trim()) return [];

  const slugs = new Set();
  for (const match of html.matchAll(/href=["']\/canal\/([^"']+\.html)["']/gi)) {
    const slug = match[1]?.replace(/\.html$/, '').trim();
    if (slug) slugs.add(slug);
  }

  return [...slugs];
}

export async function fetchFptAgendaEvents(fetchImpl = fetch, { forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && agendaCache.events.length && now - agendaCache.fetchedAt < AGENDA_CACHE_TTL_MS) {
    return agendaCache.events;
  }

  const agendaUrl = `${env.fptBaseUrl}${AGENDA_PATH}`;
  const response = await fetchImpl(agendaUrl, {
    headers: {
      'User-Agent': 'Mundial2026-Stream/1.0',
      Accept: 'text/html,application/xhtml+xml',
      Referer: `${env.fptBaseUrl}/`,
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`FPT agenda respondió ${response.status}`);
  }

  const html = await response.text();
  const events = parseFptAgendaHtml(html, env.fptBaseUrl);
  agendaCache = { fetchedAt: now, events };
  return events;
}

export async function resolveFptStreamsForMatch(
  match,
  { homeTeam = null, awayTeam = null, fetchImpl = fetch } = {}
) {
  const events = await fetchFptAgendaEvents(fetchImpl);
  const homeTeamName = homeTeam?.nameEn || homeTeam?.name || '';
  const awayTeamName = awayTeam?.nameEn || awayTeam?.name || '';
  const ranked = rankEventsForMatch(match, events, homeTeamName, awayTeamName, homeTeam, awayTeam);

  if (!ranked.length) {
    return { event: null, streams: [], sourceUrl: `${env.fptBaseUrl}${AGENDA_PATH}` };
  }

  const best = ranked[0];
  return {
    event: {
      title: best.title,
      time: best.time,
      category: best.category,
      score: best.score,
    },
    streams: best.streams,
    sourceUrl: `${env.fptBaseUrl}${AGENDA_PATH}`,
  };
}

function mappingToStreamSource(mapping) {
  const url = mapping.embedUrl || mapping.la18PageUrl;
  if (!url) return null;

  const source = buildFptStreamSource(url, mapping.notes || 'Admin');
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

export function mergeStreamSources(adminMapping, fptStreams = []) {
  const merged = [];
  const adminSource = adminMapping ? mappingToStreamSource(adminMapping) : null;
  if (adminSource) merged.push(adminSource);

  for (const stream of fptStreams) {
    if (adminSource && stream.url === adminSource.url) continue;
    merged.push({ ...stream, source: 'fpt' });
  }

  return dedupeStreams(merged);
}

export async function fetchFptEventSuggestions(
  match,
  homeTeamName = '',
  awayTeamName = '',
  homeTeam = null,
  awayTeam = null
) {
  if (!env.fptScraperEnabled && !env.liveStreamEnabled) {
    return { enabled: false, suggestions: [], streams: [] };
  }

  try {
    const { event, streams, sourceUrl } = await resolveFptStreamsForMatch(match, {
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
    if (!env.fptScraperEnabled) {
      return { enabled: false, suggestions: [], streams: [] };
    }
    throw err;
  }
}

/** Solo tests: limpia cache de agenda. */
export function clearFptAgendaCacheForTests() {
  agendaCache = { fetchedAt: 0, events: [] };
}
