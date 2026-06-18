import { Player } from '../models/Player.js';
import { PlayerWikiContext } from '../models/PlayerWikiContext.js';
import { SyncMeta } from '../models/SyncMeta.js';
import {
  fetchWikiSummary,
  fetchWikiWikitext,
  searchWikiTitle,
  sleep,
} from '../utils/wikiClient.js';

const WIKI_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_DELAY_MS = 550;
const MAX_SECTION_CHARS = 1800;
const MAX_SUMMARY_CHARS = 600;

const FIFA_TO_COUNTRY = {
  ARG: 'Argentina',
  ESP: 'Spain',
  URU: 'Uruguay',
  BRA: 'Brazil',
  FRA: 'France',
  ENG: 'England',
  GER: 'Germany',
  MEX: 'Mexico',
  USA: 'United States',
  POR: 'Portugal',
  NED: 'Netherlands',
  BEL: 'Belgium',
  CRO: 'Croatia',
  ITA: 'Italy',
  COL: 'Colombia',
  MAR: 'Morocco',
  JPN: 'Japan',
  KOR: 'South Korea',
};

export function stripWikiMarkup(value) {
  return String(value ?? '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/''+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function parseInfoboxNumber(wikitext, fields) {
  for (const field of fields) {
    const re = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|]+)`, 'i');
    const match = wikitext.match(re);
    if (!match) continue;
    const cleaned = stripWikiMarkup(match[1]).replace(/[^\d]/g, '');
    const num = Number(cleaned);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function parseInfoboxText(wikitext, fields) {
  for (const field of fields) {
    const re = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|]+)`, 'i');
    const match = wikitext.match(re);
    if (match) return stripWikiMarkup(match[1]);
  }
  return '';
}

export function extractWikiSection(wikitext, headings) {
  const pattern = headings.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`==\\s*(?:${pattern})\\s*==\\s*([\\s\\S]*?)(?=\\n==[^=]|$)`, 'i');
  const match = wikitext.match(re);
  if (!match) return '';
  return stripWikiMarkup(match[1])
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SECTION_CHARS);
}

export function parseWorldCupAppearances(wikitext) {
  const appearances = [];
  const seen = new Set();

  const patterns = [
    /\b((?:19|20)\d{2})\s+FIFA World Cup\b/gi,
    /\|\s*((?:19|20)\d{2})\s*\|\s*[^|\n]*World Cup/gi,
    /\bWorld Cup\s+((?:19|20)\d{2})\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of wikitext.matchAll(pattern)) {
      const year = Number(match[1]);
      if (!Number.isFinite(year) || year < 1930 || year > 2030 || seen.has(year)) continue;
      seen.add(year);
      appearances.push({ year, notes: '' });
    }
  }

  return appearances.sort((a, b) => a.year - b.year);
}

export function parseInternationalGoalsTable(wikitext) {
  const tableStart = wikitext.search(
    /\{\|\s*class="wikitable[^"]*"[\s\S]*?!.*?Date[\s\S]*?!.*?Opponent/i
  );
  if (tableStart < 0) return [];

  const slice = wikitext.slice(tableStart);
  const end = slice.indexOf('\n|}');
  const table = end >= 0 ? slice.slice(0, end) : slice.slice(0, 8000);
  const rows = table.split('\n|-').slice(1);
  const matches = [];

  for (const row of rows) {
    if (!row.includes('|')) continue;

    let cells = row
      .split('\n')
      .map((line) => line.replace(/^\s*\|\s*/, '').trim())
      .filter(Boolean);

    if (cells.length === 1 && cells[0].includes('||')) {
      cells = cells[0]
        .split('||')
        .map((cell) => cell.replace(/^\|+/, '').trim())
        .filter(Boolean);
    }

    cells = cells.map(stripWikiMarkup);

    if (cells.length < 4) continue;

    const date = cells.find((c) => /\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/.test(c)) ?? cells[0];
    const opponent =
      cells.find((c) => /national football team|^\[\[/.test(c) || /^[A-Z][a-z]+/.test(c)) ??
      cells[2] ??
      cells[1];
    const score = cells.find((c) => /\d+\s*[–-]\s*\d+/.test(c)) ?? '';
    const result = cells.find((c) => /[WLDF]|Win|Loss|Draw/i.test(c)) ?? '';
    const competition = cells[cells.length - 1] ?? '';

    matches.push({
      date,
      opponent: opponent.replace(/\s+national football team/i, '').trim(),
      score,
      result,
      competition,
      goals: Number(cells.find((c) => /^\d+$/.test(c)) ?? 0) || 0,
    });

    if (matches.length >= 12) break;
  }

  return matches.reverse().slice(0, 8);
}

export function parseSquadCallups(wikitext, fifaCode) {
  const callups = [];
  const country = FIFA_TO_COUNTRY[fifaCode] ?? '';
  const patterns = [
    /\b((?:19|20)\d{2})\s+(?:FIFA\s+)?World Cup\b/gi,
    /\bCopa Am[ée]rica\s+((?:19|20)\d{2})\b/gi,
    /\bUEFA Euro\s+((?:19|20)\d{2})\b/gi,
    /\bCONMEBOL\s+((?:19|20)\d{2})\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of wikitext.matchAll(pattern)) {
      const label = stripWikiMarkup(match[0]);
      if (label && !callups.includes(label)) callups.push(label);
    }
  }

  if (country && /2026 FIFA World Cup|2026 World Cup|Mundial 2026/i.test(wikitext)) {
    callups.push('2026 FIFA World Cup (convocatoria / candidato)');
  }

  return callups.slice(0, 10);
}

export function parsePlayerWikiFromWikitext(wikitext, { summary = '', wikiTitle = '', wikiUrl = '' } = {}) {
  const internationalCaps = parseInfoboxNumber(wikitext, [
    'nationalcaps',
    'national_caps',
    'caps',
  ]);
  const internationalGoals = parseInfoboxNumber(wikitext, [
    'nationalgoals',
    'national_goals',
    'goals',
  ]);
  const internationalYears = parseInfoboxText(wikitext, ['nationalyears', 'nationalyears1']);

  const internationalSection = extractWikiSection(wikitext, [
    'International career',
    'International',
    'Senior international career',
  ]);

  const worldCupSection = extractWikiSection(wikitext, [
    'World Cup',
    'FIFA World Cup',
    'International goals',
  ]);

  const worldCupAppearances = parseWorldCupAppearances(wikitext);
  const internationalMatches = parseInternationalGoalsTable(wikitext);

  const careerHighlights = [];
  if (internationalCaps != null) {
    careerHighlights.push(`${internationalCaps} partidos con su selección`);
  }
  if (internationalGoals != null) {
    careerHighlights.push(`${internationalGoals} goles internacionales`);
  }
  for (const wc of worldCupAppearances) {
    careerHighlights.push(`Mundial ${wc.year}`);
  }

  return {
    wikiTitle,
    wikiUrl,
    summary: String(summary).slice(0, MAX_SUMMARY_CHARS),
    internationalCaps,
    internationalGoals,
    internationalYears,
    worldCupAppearances,
    internationalMatches,
    squadCallups: [],
    careerHighlights,
    internationalSection,
    worldCupSection,
  };
}

function isFootballPage(wikitext, summary) {
  const blob = `${wikitext}\n${summary}`.toLowerCase();
  return (
    blob.includes('football') ||
    blob.includes('soccer') ||
    blob.includes('national team') ||
    blob.includes('fifa')
  );
}

export async function resolveWikiTitleForPlayer(player, { fetchImpl = fetch } = {}) {
  const country = FIFA_TO_COUNTRY[player.fifaCode] ?? player.nationality ?? '';
  const candidates = [
    country ? `${player.fullName} (${country} footballer)` : null,
    `${player.fullName} (footballer)`,
    player.fullName,
    country ? `${player.fullName} ${country} football` : null,
  ].filter(Boolean);

  for (const title of candidates) {
    const wikitext = await fetchWikiWikitext(title, { fetchImpl });
    if (wikitext && isFootballPage(wikitext, '')) return title;
  }

  const searchQuery = country
    ? `${player.fullName} ${country} footballer`
    : `${player.fullName} footballer`;
  const results = await searchWikiTitle(searchQuery, { fetchImpl, limit: 6 });
  for (const title of results) {
    if (!/football|footballer|soccer/i.test(title) && !title.includes(player.fullName.split(' ')[0])) {
      continue;
    }
    const wikitext = await fetchWikiWikitext(title, { fetchImpl });
    if (wikitext && isFootballPage(wikitext, '')) return title;
  }

  return null;
}

export async function fetchAndParsePlayerWiki(player, { fetchImpl = fetch } = {}) {
  const title = await resolveWikiTitleForPlayer(player, { fetchImpl });
  if (!title) return null;

  const [wikitext, summaryData] = await Promise.all([
    fetchWikiWikitext(title, { fetchImpl }),
    fetchWikiSummary(title, { fetchImpl }),
  ]);
  if (!wikitext) return null;

  const parsed = parsePlayerWikiFromWikitext(wikitext, {
    summary: summaryData?.extract ?? '',
    wikiTitle: title,
    wikiUrl: summaryData?.url ?? '',
  });
  parsed.squadCallups = parseSquadCallups(wikitext, player.fifaCode);
  return parsed;
}

export function isWikiContextFresh(doc, now = Date.now()) {
  if (!doc?.fetchedAt) return false;
  return now - new Date(doc.fetchedAt).getTime() < WIKI_TTL_MS;
}

export async function upsertPlayerWikiContext(player, wikiData) {
  const payload = {
    playerExternalId: player.externalId,
    playerId: player._id,
    fullName: player.fullName,
    fifaCode: player.fifaCode,
    ...wikiData,
    fetchedAt: new Date(),
    source: 'wikipedia',
  };

  return PlayerWikiContext.findOneAndUpdate(
    { playerExternalId: player.externalId },
    { $set: payload },
    { upsert: true, new: true, lean: true }
  );
}

export async function ensurePlayerWikiContext(
  player,
  { force = false, fetchImpl = fetch } = {}
) {
  const existing = await PlayerWikiContext.findOne({
    playerExternalId: player.externalId,
  }).lean();

  if (existing && !force && isWikiContextFresh(existing)) {
    return existing;
  }

  const parsed = await fetchAndParsePlayerWiki(player, { fetchImpl });
  if (!parsed) {
    if (existing) return existing;
    return null;
  }

  return upsertPlayerWikiContext(player, parsed);
}

export async function getWikiContextMapForExternalIds(externalIds = []) {
  if (!externalIds.length) return new Map();
  const rows = await PlayerWikiContext.find({
    playerExternalId: { $in: externalIds },
  }).lean();
  return new Map(rows.map((row) => [row.playerExternalId, row]));
}

export async function getPlayerWikiContextByExternalId(externalId) {
  if (!externalId) return null;
  return PlayerWikiContext.findOne({ playerExternalId: externalId }).lean();
}

export function buildCompactWikiContextForAi(wikiDoc) {
  if (!wikiDoc) return null;

  return {
    fuente: 'Wikipedia',
    titulo: wikiDoc.wikiTitle || wikiDoc.fullName,
    url: wikiDoc.wikiUrl || '',
    resumen: wikiDoc.summary || '',
    seleccion: {
      caps: wikiDoc.internationalCaps ?? null,
      goles: wikiDoc.internationalGoals ?? null,
      periodo: wikiDoc.internationalYears || null,
    },
    mundiales: (wikiDoc.worldCupAppearances ?? []).map((row) => ({
      anio: row.year,
      notas: row.notes || '',
    })),
    convocatorias: wikiDoc.squadCallups ?? [],
    partidosRecientesSeleccion: (wikiDoc.internationalMatches ?? []).map((m) => ({
      fecha: m.date,
      rival: m.opponent,
      marcador: m.score,
      resultado: m.result,
      competicion: m.competition,
      goles: m.goals,
    })),
    highlights: wikiDoc.careerHighlights ?? [],
    extractoInternacional: wikiDoc.internationalSection || null,
    extractoMundial: wikiDoc.worldCupSection || null,
    actualizado: wikiDoc.fetchedAt ?? null,
  };
}

export async function runPlayerWikiSync({
  fifaCode = '',
  limit = 0,
  force = false,
  fetchImpl = fetch,
} = {}) {
  const filter = {};
  if (fifaCode) filter.fifaCode = fifaCode.toUpperCase();

  let query = Player.find(filter).sort({ fullName: 1 });
  if (limit > 0) query = query.limit(limit);
  const players = await query.lean();

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const player of players) {
    try {
      const existing = await PlayerWikiContext.findOne({
        playerExternalId: player.externalId,
      }).lean();

      if (existing && !force && isWikiContextFresh(existing)) {
        skipped += 1;
        continue;
      }

      const doc = await ensurePlayerWikiContext(player, { force: true, fetchImpl });
      if (doc) synced += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      errors.push({ player: player.fullName, error: err.message });
    }

    await sleep(FETCH_DELAY_MS);
  }

  await SyncMeta.findOneAndUpdate(
    { key: 'player-wiki' },
    {
      $set: {
        lastSyncAt: new Date(),
        playerCount: players.length,
        synced,
        skipped,
        failed,
        lastSyncError: errors[0]?.error ?? '',
      },
    },
    { upsert: true }
  );

  return { total: players.length, synced, skipped, failed, errors: errors.slice(0, 10) };
}

export async function getPlayerWikiSyncMeta() {
  return SyncMeta.findOne({ key: 'player-wiki' }).lean();
}
