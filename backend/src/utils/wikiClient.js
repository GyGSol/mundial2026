const USER_AGENT = 'Mundial2026-Pred/1.0 (https://mundial2026-pred.herokuapp.com)';

export const WIKI_API = 'https://en.wikipedia.org/w/api.php';
export const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1';

export function getWikiEndpoints(lang = 'en') {
  const base = `https://${lang}.wikipedia.org`;
  return {
    api: `${base}/w/api.php`,
    rest: `${base}/api/rest_v1`,
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function wikiApiQuery(params, { fetchImpl = fetch, retries = 3, lang = 'en' } = {}) {
  const { api } = getWikiEndpoints(lang);
  const url = `${api}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status === 429 && attempt < retries) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
    return res.json();
  }

  throw new Error('Wikipedia API 429');
}

export async function fetchWikiSummary(title, { fetchImpl = fetch, retries = 3, lang = 'en' } = {}) {
  const { rest } = getWikiEndpoints(lang);
  const encoded = encodeURIComponent(title.replace(/ /g, '_'));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetchImpl(`${rest}/page/summary/${encoded}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.status === 404) return null;
    if (res.status === 429 && attempt < retries) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Wikipedia REST ${res.status}`);
    const data = await res.json();
    return {
      title: data.title,
      extract: data.extract ?? '',
      description: data.description ?? '',
      url: data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encoded}`,
    };
  }

  throw new Error('Wikipedia REST 429');
}

export async function fetchWikiWikitext(title, { fetchImpl = fetch, lang = 'en' } = {}) {
  const data = await wikiApiQuery(
    {
      action: 'query',
      titles: title,
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
    },
    { fetchImpl, lang }
  );
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.revisions?.[0]?.slots?.main?.content ?? null;
}

export async function searchWikiTitle(query, { fetchImpl = fetch, limit = 5, lang = 'en' } = {}) {
  const data = await wikiApiQuery(
    {
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: String(limit),
    },
    { fetchImpl, lang }
  );
  return (data?.query?.search ?? []).map((row) => row.title);
}
