import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { WIKIPEDIA_COUNTRY_TO_FIFA } from '../data/wikipediaSquadCountryMap.js';
import { fetchWikiWikitext, sleep, wikiApiQuery } from '../utils/wikiClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TEAM_KITS_JSON = join(__dirname, '../data/teamKitsFromWiki.json');

const FETCH_DELAY_MS = 600;
const MEMORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** @type {Map<string, { data: object | null, fetchedAt: number }>} */
const memoryCache = new Map();

export const FIFA_TO_WIKI_TEAM_PAGE = Object.fromEntries(
  Object.entries(WIKIPEDIA_COUNTRY_TO_FIFA).map(([country, code]) => [
    code,
    `${country} national football team`,
  ])
);

/** @type {{ source?: string, fetchedAt?: string, kits?: Record<string, object> } | null} */
let staticKitDoc = null;

function loadStaticKitDoc() {
  if (staticKitDoc) return staticKitDoc;
  try {
    if (!existsSync(TEAM_KITS_JSON)) {
      staticKitDoc = { source: 'wikipedia', fetchedAt: null, kits: {} };
      return staticKitDoc;
    }
    staticKitDoc = JSON.parse(readFileSync(TEAM_KITS_JSON, 'utf8'));
    return staticKitDoc;
  } catch {
    staticKitDoc = { source: 'wikipedia', fetchedAt: null, kits: {} };
    return staticKitDoc;
  }
}

export function resetTeamKitCacheForTests() {
  staticKitDoc = null;
  memoryCache.clear();
}

function fileTitleToName(title) {
  return String(title ?? '')
    .replace(/^File:/i, '')
    .trim();
}

function wikimediaUrlFromFileName(fileName) {
  const normalized = fileName.replace(/ /g, '_');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(normalized)}`;
}

/**
 * @param {Array<{ title: string, url?: string | null }>} files
 * @returns {{ token: string, parts: Record<string, string> } | null}
 */
export function parseHomeKitFromFileList(files) {
  const entries = (files ?? [])
    .map((row) => {
      const name = fileTitleToName(row.title ?? row);
      const url = row.url ?? wikimediaUrlFromFileName(name);
      return { name, url, lower: name.toLowerCase() };
    })
    .filter((row) => row.name);

  const bodyCandidates = entries.filter((row) =>
    /^kit body [a-z0-9]+h\.png$/i.test(row.name)
  );

  if (!bodyCandidates.length) return null;

  bodyCandidates.sort((a, b) => {
    const a26 = /26/.test(a.name) ? 1 : 0;
    const b26 = /26/.test(b.name) ? 1 : 0;
    if (b26 !== a26) return b26 - a26;
    return b.name.length - a.name.length;
  });

  const body = bodyCandidates[0];
  const tokenMatch = body.name.match(/^Kit body ([a-z0-9]+h)\.png$/i);
  if (!tokenMatch) return null;

  const token = tokenMatch[1];
  const tokenLower = token.toLowerCase();
  const tokenPrefix = tokenLower.replace(/h$/, '');

  const findPart = (pattern) => {
    const hit = entries.find((row) => pattern.test(row.lower));
    return hit?.url ?? null;
  };

  const parts = {
    body: body.url,
    leftArm: findPart(new RegExp(`^kit left arm ${tokenLower}\\.png$`, 'i')),
    rightArm: findPart(new RegExp(`^kit right arm ${tokenLower}\\.png$`, 'i')),
    shorts: findPart(new RegExp(`^kit shorts ${tokenPrefix}h\\d*\\.png$`, 'i')),
  };

  return { token, parts };
}

/**
 * @param {string} wikitext
 * @returns {{ bodyFile?: string, leftArmFile?: string, rightArmFile?: string, shortsFile?: string } | null}
 */
export function parseFootballKitTemplateFromWikitext(wikitext) {
  if (!wikitext) return null;

  const match = wikitext.match(/\{\{Football kit[\s\S]*?\n\}\}/i);
  if (!match) return null;

  const block = match[0];
  const readParam = (keys) => {
    for (const key of keys) {
      const re = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n|]+)`, 'i');
      const hit = block.match(re);
      if (hit) {
        return hit[1].trim().replace(/^\[\[File:([^|\]]+).*\]\]$/i, '$1').replace(/^File:/i, '');
      }
    }
    return null;
  };

  const bodyFile = readParam(['pattern_b', 'body']);
  if (!bodyFile) return null;

  return {
    bodyFile,
    leftArmFile: readParam(['pattern_la', 'leftarm']),
    rightArmFile: readParam(['pattern_ra', 'rightarm']),
    shortsFile: readParam(['shorts']),
  };
}

function kitPayloadFromParsed(fifaCode, wikiPage, parsed) {
  if (!parsed?.parts?.body) return null;

  const parts = {};
  for (const [key, url] of Object.entries(parsed.parts)) {
    if (url) parts[key] = url;
  }

  if (!parts.body) return null;

  return {
    fifaCode,
    wikiPage,
    variant: 'home',
    parts,
    fetchedAt: new Date().toISOString(),
  };
}

function kitPayloadFromTemplate(fifaCode, wikiPage, template) {
  if (!template?.bodyFile) return null;

  const parts = { body: wikimediaUrlFromFileName(template.bodyFile) };
  if (template.leftArmFile) parts.leftArm = wikimediaUrlFromFileName(template.leftArmFile);
  if (template.rightArmFile) parts.rightArm = wikimediaUrlFromFileName(template.rightArmFile);
  if (template.shortsFile) parts.shorts = wikimediaUrlFromFileName(template.shortsFile);

  return {
    fifaCode,
    wikiPage,
    variant: 'home',
    parts,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchPageKitImages(wikiPage, { fetchImpl = fetch } = {}) {
  const data = await wikiApiQuery(
    {
      action: 'query',
      generator: 'images',
      gimlimit: '500',
      titles: wikiPage,
      prop: 'imageinfo',
      iiprop: 'url',
    },
    { fetchImpl }
  );

  const pages = data?.query?.pages ?? [];
  return pages.map((page) => ({
    title: page.title,
    url: page.imageinfo?.[0]?.url ?? null,
  }));
}

export async function fetchTeamKitFromWiki(fifaCode, { fetchImpl = fetch } = {}) {
  const code = String(fifaCode ?? '').trim().toUpperCase();
  const wikiPage = FIFA_TO_WIKI_TEAM_PAGE[code];
  if (!wikiPage) return null;

  const images = await fetchPageKitImages(wikiPage, { fetchImpl });
  let parsed = parseHomeKitFromFileList(images);
  let payload = kitPayloadFromParsed(code, wikiPage, parsed);

  if (!payload) {
    const wikitext = await fetchWikiWikitext(wikiPage, { fetchImpl });
    const template = parseFootballKitTemplateFromWikitext(wikitext);
    payload = kitPayloadFromTemplate(code, wikiPage, template);
  }

  return payload;
}

export async function syncAllTeamKitsFromWiki({ fetchImpl = fetch, delayMs = FETCH_DELAY_MS } = {}) {
  const codes = Object.keys(FIFA_TO_WIKI_TEAM_PAGE).sort();
  /** @type {Record<string, object>} */
  const kits = {};
  let found = 0;

  for (const fifaCode of codes) {
    try {
      const kit = await fetchTeamKitFromWiki(fifaCode, { fetchImpl });
      if (kit) {
        kits[fifaCode] = kit;
        found += 1;
      }
    } catch (err) {
      console.warn(`Kit skip ${fifaCode}:`, err.message);
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  const doc = {
    source: 'wikipedia',
    sourceLang: 'en',
    fetchedAt: new Date().toISOString(),
    teamCount: codes.length,
    kitCount: found,
    kits,
  };

  writeFileSync(TEAM_KITS_JSON, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  staticKitDoc = doc;
  return doc;
}

export async function getTeamKit(fifaCode, { fetchImpl = fetch } = {}) {
  const code = String(fifaCode ?? '').trim().toUpperCase();
  if (!code) return null;

  const cached = memoryCache.get(code);
  if (cached && Date.now() - cached.fetchedAt < MEMORY_TTL_MS) {
    return cached.data;
  }

  const doc = loadStaticKitDoc();
  const fromJson = doc.kits?.[code] ?? null;
  if (fromJson?.parts?.body) {
    memoryCache.set(code, { data: fromJson, fetchedAt: Date.now() });
    return fromJson;
  }

  try {
    const live = await fetchTeamKitFromWiki(code, { fetchImpl });
    memoryCache.set(code, { data: live, fetchedAt: Date.now() });
    return live;
  } catch {
    memoryCache.set(code, { data: null, fetchedAt: Date.now() });
    return null;
  }
}

export function getTeamKitSyncMeta() {
  const doc = loadStaticKitDoc();
  return {
    source: doc.source ?? 'wikipedia',
    fetchedAt: doc.fetchedAt ?? null,
    kitCount: doc.kitCount ?? Object.keys(doc.kits ?? {}).length,
    teamCount: doc.teamCount ?? Object.keys(FIFA_TO_WIKI_TEAM_PAGE).length,
  };
}
