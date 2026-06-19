import { WIKIPEDIA_COUNTRY_TO_FIFA } from '../data/wikipediaSquadCountryMap.js';
import {
  fetchWikiSummary,
  fetchWikiWikitext,
  searchWikiTitle,
} from '../utils/wikiClient.js';
import { extractWikiSection, stripWikiMarkup } from './playerWikiService.js';

const WIKI_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SUMMARY_CHARS = 700;
const MAX_SECTION_CHARS = 1400;

const FIFA_TO_COUNTRY = Object.fromEntries(
  Object.entries(WIKIPEDIA_COUNTRY_TO_FIFA).map(([country, code]) => [code, country])
);

const wikiCache = new Map();

function parseInfoboxText(wikitext, fields) {
  for (const field of fields) {
    const re = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|]+)`, 'i');
    const match = wikitext.match(re);
    if (match) return stripWikiMarkup(match[1]);
  }
  return '';
}

function isCoachPage(wikitext, summary = '') {
  const blob = `${wikitext}\n${summary}`.toLowerCase();
  return (
    blob.includes('football manager') ||
    blob.includes('manager (association football)') ||
    (blob.includes(' manager') && blob.includes('football')) ||
    blob.includes('coaching career') ||
    blob.includes('managerial career')
  );
}

function extractWikiSectionRaw(wikitext, headings) {
  const pattern = headings.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`==\\s*(?:${pattern})\\s*==\\s*([\\s\\S]*?)(?=\\n==[^=]|$)`, 'i');
  const match = wikitext.match(re);
  return match ? match[1] : '';
}

function extractSubsectionRaw(block, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`===\\s*${escaped}\\s*===\\s*([\\s\\S]*?)(?=\\n===|$)`, 'i');
  const match = block.match(re);
  return match ? match[1] : '';
}

function cleanWikiText(value) {
  return stripWikiMarkup(value)
    .replace(/^=+\s*/gm, '')
    .replace(/\n(?:Notes|References|External links|Honours).*$/is, '')
    .replace(/\nCategory:.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTeamManagerSection(wikitext, teamName) {
  if (!teamName) return '';

  const managerialBlock = extractWikiSectionRaw(wikitext, [
    'Coaching career',
    'Managerial career',
    'Manager career',
  ]);

  if (managerialBlock) {
    for (const heading of [`${teamName} national team`, teamName]) {
      const subsection = extractSubsectionRaw(managerialBlock, heading);
      if (subsection) return cleanWikiText(subsection).slice(0, MAX_SECTION_CHARS);
    }

    const blob = cleanWikiText(managerialBlock);
    const sentences = blob.split(/(?<=[.!?])\s+/);
    const hits = sentences.filter((sentence) => {
      const lower = sentence.toLowerCase();
      if (!lower.includes(teamName.toLowerCase())) return false;
      if (/youth|under-\d|u-\d{1,2}\b|world youth/i.test(sentence)) return false;
      return /manager|coach|appointed|led|head coach|national team/i.test(sentence);
    });

    if (hits.length) return hits.join(' ').slice(0, MAX_SECTION_CHARS);
  }

  return '';
}

export function parseManagerWorldCups(wikitext) {
  const years = [];
  const seen = new Set();
  const section = extractWikiSectionRaw(wikitext, [
    'Coaching career',
    'Managerial career',
    'Manager career',
  ]);

  for (const match of section.matchAll(/\b((?:19|20)\d{2})\s+FIFA World Cup\b/gi)) {
    const year = Number(match[1]);
    if (!Number.isFinite(year) || seen.has(year)) continue;
    seen.add(year);
    years.push(year);
  }

  return years.sort((a, b) => a - b);
}

export function parseCoachWikiFromWikitext(
  wikitext,
  { summary = '', wikiTitle = '', wikiUrl = '', teamName = '' } = {}
) {
  const nationality = parseInfoboxText(wikitext, ['nationality', 'citizenship']);
  const currentTeam = parseInfoboxText(wikitext, ['currentclub', 'team', 'clubs']);
  const managerYears = parseInfoboxText(wikitext, ['manageryears', 'years', 'managerclubs']);
  const birthDateRaw = parseInfoboxText(wikitext, ['birth_date', 'dateofbirth']);
  const birthDate = birthDateRaw.includes('{{') ? '' : birthDateRaw;

  const managerialSection = extractWikiSection(wikitext, [
    'Managerial career',
    'Manager career',
    'Coaching career',
    'International',
  ]);
  const teamSection = extractTeamManagerSection(wikitext, teamName);
  const worldCupAsManager = parseManagerWorldCups(wikitext);

  const highlights = [];
  if (nationality) highlights.push(`Nacionalidad: ${nationality}`);
  if (birthDate) highlights.push(`Nacimiento: ${birthDate}`);
  if (currentTeam) highlights.push(`Club/selección reciente: ${currentTeam}`);
  if (managerYears) highlights.push(`Trayectoria: ${managerYears}`);
  for (const year of worldCupAsManager) {
    highlights.push(`Mundial ${year} como DT`);
  }
  if (teamName) highlights.push(`Selección en foco: ${teamName}`);

  return {
    wikiTitle,
    wikiUrl,
    summary: String(summary).slice(0, MAX_SUMMARY_CHARS),
    nationality: nationality || null,
    birthDate: birthDate || null,
    currentTeam: currentTeam || null,
    managerYears: managerYears || null,
    teamSection: teamSection || null,
    managerialSection: managerialSection.slice(0, MAX_SECTION_CHARS) || null,
    worldCupAsManager,
    highlights,
  };
}

export async function resolveWikiTitleForCoach(
  { name, teamName = '', fifaCode = '' },
  { fetchImpl = fetch } = {}
) {
  const country = teamName || FIFA_TO_COUNTRY[fifaCode] || '';
  const candidates = [
    `${name} (football manager)`,
    country ? `${name} (${country} football manager)` : null,
    country ? `${name} ${country} national football team manager` : null,
    name,
  ].filter(Boolean);

  for (const title of candidates) {
    const wikitext = await fetchWikiWikitext(title, { fetchImpl });
    if (wikitext && isCoachPage(wikitext)) return title;
  }

  const searchQuery = country
    ? `${name} ${country} football manager`
    : `${name} football manager`;
  const results = await searchWikiTitle(searchQuery, { fetchImpl, limit: 8 });
  for (const title of results) {
    if (!/manager|football|coach/i.test(title)) continue;
    const wikitext = await fetchWikiWikitext(title, { fetchImpl });
    if (wikitext && isCoachPage(wikitext)) return title;
  }

  return null;
}

export async function fetchCoachWiki(
  { name, fifaCode = '', teamName = '' },
  { fetchImpl = fetch } = {}
) {
  const cacheKey = `${fifaCode}|${name}`.toLowerCase();
  const cached = wikiCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < WIKI_TTL_MS) {
    return cached.data;
  }

  const title = await resolveWikiTitleForCoach({ name, teamName, fifaCode }, { fetchImpl });
  if (!title) return null;

  const [wikitext, summaryData] = await Promise.all([
    fetchWikiWikitext(title, { fetchImpl }),
    fetchWikiSummary(title, { fetchImpl }),
  ]);
  if (!wikitext) return null;

  const parsed = parseCoachWikiFromWikitext(wikitext, {
    summary: summaryData?.extract ?? '',
    wikiTitle: title,
    wikiUrl: summaryData?.url ?? '',
    teamName,
  });

  wikiCache.set(cacheKey, { data: parsed, fetchedAt: Date.now() });
  return parsed;
}
