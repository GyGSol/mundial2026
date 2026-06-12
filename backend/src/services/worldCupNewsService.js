const NEWS_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; Mundial2026Bot/1.0; +https://mundial2026-pred.herokuapp.com)';

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
  const mediaMatch = block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch?.[1]) return mediaMatch[1];

  const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosureMatch?.[1]) return enclosureMatch[1];

  const description = extractTag(block, 'description');
  const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) return imgMatch[1];

  return '';
}

function resolveSourceFromLink(link, fallbackSource) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, '');
    if (host.includes('fifa.com')) return 'FIFA';
    if (host.includes('google.com') && link.includes('url=')) {
      const wrapped = new URL(link).searchParams.get('url');
      if (wrapped) {
        const innerHost = new URL(wrapped).hostname.replace(/^www\./, '');
        if (innerHost.includes('fifa.com')) return 'FIFA';
        return innerHost;
      }
    }
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
    const imageUrl = extractImageFromBlock(block);
    const publishedAt = pubDateRaw ? new Date(pubDateRaw).toISOString() : null;

    items.push({
      title,
      link: resolveArticleUrl(link),
      summary: description.slice(0, 280),
      imageUrl,
      publishedAt,
    });
  }

  return items;
}

export function normalizeNewsArticle(raw, feedMeta) {
  if (!raw?.title || !raw?.link) return null;

  const url = resolveArticleUrl(raw.link);
  const sourceName = resolveSourceFromLink(url, feedMeta.sourceName);
  const isOfficial = feedMeta.official || sourceName === 'FIFA';

  return {
    id: Buffer.from(url).toString('base64url').slice(0, 32),
    title: raw.title.trim(),
    summary: String(raw.summary ?? '').trim(),
    url,
    imageUrl: String(raw.imageUrl ?? '').trim(),
    sourceName,
    isOfficial,
    publishedAt: raw.publishedAt || null,
  };
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

  const articles = dedupeArticles(merged)
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 24);

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
