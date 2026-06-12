const NEWS_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12000;
const OG_IMAGE_TIMEOUT_MS = 8000;
const OG_IMAGE_ENRICH_LIMIT = 16;
const OG_IMAGE_CONCURRENCY = 4;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const RSS_FEEDS = [
  {
    id: 'fifa-official',
    sourceName: 'FIFA',
    url: 'https://news.google.com/rss/search?q=site:fifa.com+World+Cup+2026&hl=es-419&gl=AR&ceid=AR:es-419',
    official: true,
  },
  {
    id: 'fifa-en',
    sourceName: 'FIFA',
    url: 'https://news.google.com/rss/search?q=site:fifa.com+FIFA+World+Cup+2026&hl=en-US&gl=US&ceid=US:en',
    official: true,
  },
  {
    id: 'mundial-2026',
    sourceName: 'Prensa internacional',
    url: 'https://news.google.com/rss/search?q=Mundial+2026+FIFA+Copa+del+Mundo&hl=es-419&gl=AR&ceid=AR:es-419',
    official: false,
  },
];

let newsCache = { articles: [], fetchedAt: 0 };

function decodeXmlEntities(value) {
  return String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function extractTag(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? decodeXmlEntities(match[1]) : '';
}

function extractImageFromBlock(block) {
  const mediaMatch = block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch?.[1]) return mediaMatch[1];

  const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosureMatch?.[1]) return enclosureMatch[1];

  const description = extractTag(block, 'description');
  const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) return imgMatch[1];

  return '';
}

export function extractSourceFromBlock(block) {
  const withUrl = block.match(/<source[^>]+url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/source>/i);
  if (withUrl) {
    return {
      sourceUrl: withUrl[1].trim(),
      sourceLabel: decodeXmlEntities(withUrl[2]).trim(),
    };
  }

  const plain = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
  if (plain) {
    return {
      sourceUrl: '',
      sourceLabel: decodeXmlEntities(plain[1]).trim(),
    };
  }

  return { sourceUrl: '', sourceLabel: '' };
}

export function extractOgImageFromHtml(html) {
  if (!html || typeof html !== 'string') return '';

  const patterns = [
    /property=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image(?::url)?["']/i,
    /name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeXmlEntities(match[1]);
  }

  return '';
}

export function normalizeNewsImageUrl(url) {
  const value = String(url ?? '').trim();
  if (!value) return '';

  if (value.includes('googleusercontent.com')) {
    return value.replace(/=s0-w\d+-?[^/]*/i, '=s0-w800').replace(/=w\d+-h\d+/i, '=w800-h450');
  }

  return value;
}

function resolveSourceFromLink(link, fallbackSource, sourceMeta = {}) {
  if (sourceMeta.sourceLabel) return sourceMeta.sourceLabel;

  try {
    const publisherUrl = sourceMeta.sourceUrl || link;
    const host = new URL(publisherUrl).hostname.replace(/^www\./, '');
    if (host.includes('fifa.com')) return 'FIFA';
    if (host.includes('google.com') && link.includes('url=')) {
      const wrapped = new URL(link).searchParams.get('url');
      if (wrapped) {
        const innerHost = new URL(wrapped).hostname.replace(/^www\./, '');
        if (innerHost.includes('fifa.com')) return 'FIFA';
        return innerHost;
      }
    }
    if (host.includes('google.com')) return fallbackSource;
    return host || fallbackSource;
  } catch {
    return fallbackSource;
  }
}

function resolveArticleUrl(link) {
  try {
    const parsed = new URL(link);
    const wrapped = parsed.searchParams.get('url');
    return wrapped || link;
  } catch {
    return link;
  }
}

export function parseRssItems(xml) {
  if (!xml || typeof xml !== 'string') return [];

  const items = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    if (!title || !link) continue;

    const pubDateRaw = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const imageUrl = normalizeNewsImageUrl(extractImageFromBlock(block));
    const publishedAt = pubDateRaw ? new Date(pubDateRaw).toISOString() : null;
    const source = extractSourceFromBlock(block);

    items.push({
      title,
      link,
      summary: description.slice(0, 280),
      imageUrl,
      publishedAt,
      sourceUrl: source.sourceUrl,
      sourceLabel: source.sourceLabel,
    });
  }

  return items;
}

export function normalizeNewsArticle(raw, feedMeta) {
  if (!raw?.title || !raw?.link) return null;

  const url = resolveArticleUrl(raw.link) || raw.link;
  const sourceMeta = { sourceUrl: raw.sourceUrl, sourceLabel: raw.sourceLabel };
  const sourceName = resolveSourceFromLink(url, feedMeta.sourceName, sourceMeta);
  const isOfficial =
    feedMeta.official ||
    sourceName === 'FIFA' ||
    String(raw.sourceUrl ?? '').includes('fifa.com');

  return {
    id: Buffer.from(raw.link).toString('base64url').slice(0, 32),
    title: raw.title.trim(),
    summary: String(raw.summary ?? '').trim(),
    url,
    pageUrl: raw.link,
    imageUrl: normalizeNewsImageUrl(raw.imageUrl),
    sourceName,
    isOfficial,
    publishedAt: raw.publishedAt || null,
  };
}

async function fetchOgImage(pageUrl, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OG_IMAGE_TIMEOUT_MS);

  try {
    const res = await fetchImpl(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) return '';
    const html = await res.text();
    return normalizeNewsImageUrl(extractOgImageFromHtml(html));
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function enrichArticlesWithImages(articles, fetchImpl = fetch) {
  const targets = articles
    .map((article, index) => ({ article, index }))
    .filter(({ article }) => !article.imageUrl)
    .slice(0, OG_IMAGE_ENRICH_LIMIT);

  if (!targets.length) return articles;

  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const current = targets[cursor];
      cursor += 1;
      const imageUrl = await fetchOgImage(current.article.pageUrl || current.article.url, fetchImpl);
      if (!imageUrl) continue;
      articles[current.index] = { ...articles[current.index], imageUrl };
    }
  }

  await Promise.all(Array.from({ length: OG_IMAGE_CONCURRENCY }, () => worker()));

  return articles.map(({ pageUrl, ...article }) => article);
}

async function fetchFeedXml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function dedupeArticles(articles) {
  const seen = new Set();
  return articles.filter((article) => {
    const key = article.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchWorldCupNews({ force = false } = {}) {
  const now = Date.now();
  if (!force && newsCache.fetchedAt && now - newsCache.fetchedAt < NEWS_TTL_MS) {
    return { articles: newsCache.articles, fetchedAt: new Date(newsCache.fetchedAt).toISOString(), cached: true };
  }

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const xml = await fetchFeedXml(feed.url);
      const parsed = parseRssItems(xml);
      return parsed
        .map((item) => normalizeNewsArticle(item, feed))
        .filter(Boolean);
    })
  );

  const merged = [];
  for (const result of results) {
    if (result.status === 'fulfilled') merged.push(...result.value);
  }

  let articles = dedupeArticles(merged)
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 24);

  articles = await enrichArticlesWithImages(articles);

  newsCache = { articles, fetchedAt: now };

  return {
    articles,
    fetchedAt: new Date(now).toISOString(),
    cached: false,
  };
}

export function __resetNewsCacheForTests() {
  newsCache = { articles: [], fetchedAt: 0 };
}
