import { WIKIPEDIA_COUNTRY_TO_FIFA } from '../data/wikipediaSquadCountryMap.js';
import {
  fetchWikiSummary,
  fetchWikiWikitext,
  searchWikiTitle,
} from '../utils/wikiClient.js';
import { extractWikiSection, stripWikiMarkup } from './playerWikiService.js';

const WIKI_LANG = 'es';
const WIKI_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SUMMARY_CHARS = 700;
const MAX_SECTION_CHARS = 1400;

const FIFA_TO_COUNTRY = Object.fromEntries(
  Object.entries(WIKIPEDIA_COUNTRY_TO_FIFA).map(([country, code]) => [code, country])
);

const COUNTRY_TO_FIFA = Object.fromEntries(
  Object.entries(WIKIPEDIA_COUNTRY_TO_FIFA).map(([country, code]) => [country, code])
);

/** Nombre de la selección en Wikipedia en español (subsecciones «Selección de …»). */
const FIFA_TO_COUNTRY_ES = {
  ALG: 'Argelia',
  ARG: 'Argentina',
  AUS: 'Australia',
  AUT: 'Austria',
  BEL: 'Bélgica',
  BIH: 'Bosnia y Herzegovina',
  BRA: 'Brasil',
  CAN: 'Canadá',
  CIV: 'Costa de Marfil',
  COD: 'República Democrática del Congo',
  COL: 'Colombia',
  CPV: 'Cabo Verde',
  CRO: 'Croacia',
  CUW: 'Curazao',
  CZE: 'República Checa',
  ECU: 'Ecuador',
  EGY: 'Egipto',
  ENG: 'Inglaterra',
  ESP: 'España',
  FRA: 'Francia',
  GER: 'Alemania',
  GHA: 'Ghana',
  HAI: 'Haití',
  IRN: 'Irán',
  IRQ: 'Irak',
  JOR: 'Jordania',
  JPN: 'Japón',
  KOR: 'Corea del Sur',
  KSA: 'Arabia Saudita',
  MAR: 'Marruecos',
  MEX: 'México',
  NED: 'Países Bajos',
  NOR: 'Noruega',
  NZL: 'Nueva Zelanda',
  PAN: 'Panamá',
  PAR: 'Paraguay',
  POR: 'Portugal',
  QAT: 'Catar',
  RSA: 'Sudáfrica',
  SCO: 'Escocia',
  SEN: 'Senegal',
  SUI: 'Suiza',
  SWE: 'Suecia',
  TUN: 'Túnez',
  TUR: 'Turquía',
  URU: 'Uruguay',
  USA: 'Estados Unidos',
  UZB: 'Uzbekistán',
};

const MANAGERIAL_SECTION_HEADINGS = [
  'Carrera como entrenador',
  'Carrera de entrenador',
  'Trayectoria como entrenador',
  'Coaching career',
  'Managerial career',
  'Manager career',
];

const wikiCache = new Map();

function resolveCountryEs(fifaCode, teamName = '') {
  if (fifaCode && FIFA_TO_COUNTRY_ES[fifaCode]) return FIFA_TO_COUNTRY_ES[fifaCode];
  const codeFromName = COUNTRY_TO_FIFA[teamName];
  if (codeFromName && FIFA_TO_COUNTRY_ES[codeFromName]) return FIFA_TO_COUNTRY_ES[codeFromName];
  return teamName || FIFA_TO_COUNTRY[fifaCode] || '';
}

function parseInfoboxText(wikitext, fields) {
  for (const field of fields) {
    const re = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n]+)`, 'i');
    const match = wikitext.match(re);
    if (match) return stripWikiMarkup(match[1]);
  }
  return '';
}

function isCoachPage(wikitext, summary = '') {
  const blob = `${wikitext}\n${summary}`.toLowerCase();
  return (
    blob.includes('ficha de entrenador') ||
    blob.includes('entrenador de fútbol') ||
    blob.includes('carrera como entrenador') ||
    blob.includes('carrera de entrenador') ||
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
    .replace(/\n(?:Notes|References|External links|Honours|Notas|Referencias|Enlaces externos|Palmarés|Honores).*$/is, '')
    .replace(/\nCategory:.*$/gim, '')
    .replace(/\nCategoría:.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTeamManagerSection(wikitext, { teamName = '', countryEs = '' } = {}) {
  const labels = [
    countryEs ? `Selección de ${countryEs}` : '',
    countryEs,
    teamName ? `Selección de ${teamName}` : '',
    teamName,
  ].filter(Boolean);

  const managerialBlock = extractWikiSectionRaw(wikitext, MANAGERIAL_SECTION_HEADINGS);
  if (!managerialBlock) return '';

  for (const heading of labels) {
    const subsection = extractSubsectionRaw(managerialBlock, heading);
    if (subsection) return cleanWikiText(subsection).slice(0, MAX_SECTION_CHARS);
  }

  const searchTerms = [countryEs, teamName].filter(Boolean).map((value) => value.toLowerCase());
  if (!searchTerms.length) return '';

  const blob = cleanWikiText(managerialBlock);
  const sentences = blob.split(/(?<=[.!?])\s+/);
  const hits = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    if (!searchTerms.some((term) => lower.includes(term))) return false;
    if (/juvenil|sub-\d|u-\d{1,2}\b|world youth|youth|under-\d/i.test(sentence)) return false;
    return /entrenador|director técnico|nombrado|designado|lideró|selección|manager|coach|appointed|national team/i.test(
      sentence
    );
  });

  if (hits.length) return hits.join(' ').slice(0, MAX_SECTION_CHARS);
  return '';
}

export function parseManagerWorldCups(wikitext) {
  const years = [];
  const seen = new Set();
  const section = extractWikiSectionRaw(wikitext, MANAGERIAL_SECTION_HEADINGS);

  const patterns = [
    /\b((?:19|20)\d{2})\s+(?:FIFA World Cup|Copa Mundial(?: de Fútbol)?(?: de|:)?)\b/gi,
    /\bCopa Mundial(?: de Fútbol)? de ((?:19|20)\d{2})\b/gi,
    /\bMundial(?: de Fútbol)? de ((?:19|20)\d{2})\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of section.matchAll(pattern)) {
      const year = Number(match[1]);
      if (!Number.isFinite(year) || seen.has(year)) continue;
      seen.add(year);
      years.push(year);
    }
  }

  return years.sort((a, b) => a - b);
}

export function parseCoachWikiFromWikitext(
  wikitext,
  { summary = '', wikiTitle = '', wikiUrl = '', teamName = '', countryEs = '' } = {}
) {
  const nationality = parseInfoboxText(wikitext, ['nacionalidad', 'nationality', 'citizenship']);
  const currentTeam = parseInfoboxText(wikitext, [
    'seleccion',
    'clubactual',
    'currentclub',
    'team',
    'clubs',
    'equipos',
  ]);
  const managerYears = parseInfoboxText(wikitext, [
    'añoscomoentrenador',
    'años1',
    'manageryears',
    'manageryears1',
    'years',
    'managerclubs',
  ]);
  const birthDateRaw = parseInfoboxText(wikitext, [
    'fechadenacimiento',
    'birth_date',
    'dateofbirth',
  ]);
  const birthDate = birthDateRaw.includes('{{') ? '' : birthDateRaw;

  const managerialSection = extractWikiSection(wikitext, MANAGERIAL_SECTION_HEADINGS);
  const teamSection = extractTeamManagerSection(wikitext, { teamName, countryEs });
  const worldCupAsManager = parseManagerWorldCups(wikitext);

  const highlights = [];
  if (nationality) highlights.push(`Nacionalidad: ${nationality}`);
  if (birthDate) highlights.push(`Nacimiento: ${birthDate}`);
  if (currentTeam) highlights.push(`Club/selección reciente: ${currentTeam}`);
  if (managerYears) highlights.push(`Trayectoria: ${managerYears}`);
  for (const year of worldCupAsManager) {
    highlights.push(`Mundial ${year} como DT`);
  }
  if (countryEs || teamName) {
    highlights.push(`Selección en foco: ${countryEs || teamName}`);
  }

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
  const countryEs = resolveCountryEs(fifaCode, teamName);
  const wikiOpts = { fetchImpl, lang: WIKI_LANG };
  const candidates = [
    name,
    `${name} (entrenador de fútbol)`,
    countryEs ? `${name} (${countryEs})` : null,
    `${name} (football manager)`,
  ].filter(Boolean);

  for (const title of candidates) {
    const wikitext = await fetchWikiWikitext(title, wikiOpts);
    if (wikitext && isCoachPage(wikitext)) return title;
  }

  const searchQuery = countryEs
    ? `${name} ${countryEs} entrenador de fútbol`
    : `${name} entrenador de fútbol`;
  const results = await searchWikiTitle(searchQuery, { ...wikiOpts, limit: 8 });
  for (const title of results) {
    if (!/entrenador|fútbol|football|manager|coach/i.test(title)) continue;
    const wikitext = await fetchWikiWikitext(title, wikiOpts);
    if (wikitext && isCoachPage(wikitext)) return title;
  }

  return null;
}

export async function fetchCoachWiki(
  { name, fifaCode = '', teamName = '' },
  { fetchImpl = fetch } = {}
) {
  const cacheKey = `${WIKI_LANG}|${fifaCode}|${name}`.toLowerCase();
  const cached = wikiCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < WIKI_TTL_MS) {
    return cached.data;
  }

  const countryEs = resolveCountryEs(fifaCode, teamName);
  const title = await resolveWikiTitleForCoach({ name, teamName, fifaCode }, { fetchImpl });
  if (!title) return null;

  const wikiOpts = { fetchImpl, lang: WIKI_LANG };
  const [wikitext, summaryData] = await Promise.all([
    fetchWikiWikitext(title, wikiOpts),
    fetchWikiSummary(title, wikiOpts),
  ]);
  if (!wikitext) return null;

  const parsed = parseCoachWikiFromWikitext(wikitext, {
    summary: summaryData?.extract ?? '',
    wikiTitle: title,
    wikiUrl: summaryData?.url ?? '',
    teamName,
    countryEs,
  });

  wikiCache.set(cacheKey, { data: parsed, fetchedAt: Date.now() });
  return parsed;
}
