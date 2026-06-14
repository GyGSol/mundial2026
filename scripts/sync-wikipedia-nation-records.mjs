#!/usr/bin/env node
/**
 * Descarga historial por selección desde Wikipedia y actualiza
 * backend/src/data/worldCupHistory.json → recordsByNation
 *
 * Uso: node scripts/sync-wikipedia-nation-records.mjs
 * Ejecución manual (rate limit Wikipedia ~300ms entre países).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = path.join(__dirname, '../backend/src/data/worldCupHistory.json');
const PROFILES_PATH = path.join(__dirname, '../backend/src/data/nationFootballProfiles.json');
const USER_AGENT = 'Mundial2026-Pred/1.0 (https://mundial2026-pred.herokuapp.com)';
const FETCH_DELAY_MS = 350;

/** FIFA code → título exacto en Wikipedia (en). */
const WIKI_TITLE_BY_CODE = {
  ARG: 'Argentina at the FIFA World Cup',
  ESP: 'Spain at the FIFA World Cup',
  FRA: 'France at the FIFA World Cup',
  ENG: 'England at the FIFA World Cup',
  POR: 'Portugal at the FIFA World Cup',
  BRA: 'Brazil at the FIFA World Cup',
  MAR: 'Morocco at the FIFA World Cup',
  NED: 'Netherlands at the FIFA World Cup',
  BEL: 'Belgium at the FIFA World Cup',
  GER: 'Germany at the FIFA World Cup',
  CRO: 'Croatia at the FIFA World Cup',
  ITA: 'Italy at the FIFA World Cup',
  COL: 'Colombia at the FIFA World Cup',
  MEX: 'Mexico at the FIFA World Cup',
  SEN: 'Senegal at the FIFA World Cup',
  URU: 'Uruguay at the FIFA World Cup',
  USA: 'United States at the FIFA World Cup',
  JPN: 'Japan at the FIFA World Cup',
  SUI: 'Switzerland at the FIFA World Cup',
  IRN: 'Iran at the FIFA World Cup',
  DEN: 'Denmark at the FIFA World Cup',
  TUR: 'Turkey at the FIFA World Cup',
  ECU: 'Ecuador at the FIFA World Cup',
  AUT: 'Austria at the FIFA World Cup',
  KOR: 'South Korea at the FIFA World Cup',
  NGA: 'Nigeria at the FIFA World Cup',
  AUS: 'Australia at the FIFA World Cup',
  ALG: 'Algeria at the FIFA World Cup',
  EGY: 'Egypt at the FIFA World Cup',
  CAN: 'Canada at the FIFA World Cup',
  NOR: 'Norway at the FIFA World Cup',
  CIV: "Ivory Coast at the FIFA World Cup",
  PAN: 'Panama at the FIFA World Cup',
  POL: 'Poland at the FIFA World Cup',
  WAL: 'Wales at the FIFA World Cup',
  SWE: 'Sweden at the FIFA World Cup',
  CZE: 'Czech Republic at the FIFA World Cup',
  PAR: 'Paraguay at the FIFA World Cup',
  SCO: 'Scotland at the FIFA World Cup',
  SRB: 'Serbia at the FIFA World Cup',
  CMR: 'Cameroon at the FIFA World Cup',
  TUN: 'Tunisia at the FIFA World Cup',
  COD: 'DR Congo at the FIFA World Cup',
  UZB: 'Uzbekistan at the FIFA World Cup',
  QAT: 'Qatar at the FIFA World Cup',
  IRQ: 'Iraq at the FIFA World Cup',
  RSA: 'South Africa at the FIFA World Cup',
  SAU: 'Saudi Arabia at the FIFA World Cup',
  JOR: 'Jordan at the FIFA World Cup',
  BIH: 'Bosnia and Herzegovina at the FIFA World Cup',
  CPV: 'Cape Verde at the FIFA World Cup',
  GHA: 'Ghana at the FIFA World Cup',
  CUW: 'Curaçao at the FIFA World Cup',
  HAI: 'Haiti at the FIFA World Cup',
  NZL: 'New Zealand at the FIFA World Cup',
};

const ROUND_DEPTH = {
  champions: 100,
  '1st': 100,
  winner: 100,
  runners: 90,
  'runners-up': 90,
  '2nd': 90,
  'third place': 80,
  '3rd': 80,
  'fourth place': 70,
  '4th': 70,
  semi: 75,
  quarter: 60,
  'round of 16': 50,
  'second group': 40,
  group: 30,
  'did not qualify': 0,
  'withdrew': 0,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWikiPage(title) {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    formatversion: '2',
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia ${res.status} for ${title}`);
  const data = await res.json();
  const page = data?.query?.pages?.[0];
  if (page?.missing) return null;
  return page?.revisions?.[0]?.slots?.main?.content ?? null;
}

function stripWiki(text) {
  return String(text ?? '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^/]*\/>/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'''+/g, '')
    .replace(/rowspan="?\d+"?\s*\|/gi, '')
    .replace(/bgcolor="[^"]*"/gi, '')
    .replace(/bgcolor=[^\s|]+/gi, '')
    .replace(/style="[^"]*"/gi, '')
    .replace(/rowspan="\d+"/gi, '')
    .replace(/colspan="\d+"/gi, '')
    .trim();
}

function parseYear(cell) {
  const m =
    cell.match(/\[\[(\d{4}) FIFA World Cup\|(\d{4})\]\]/) ||
    cell.match(/\[\[(\d{4}) FIFA World Cup\]\]/) ||
    cell.match(/(\d{4})/);
  return m ? Number(m[2] ?? m[1]) : null;
}

function parseIntCell(cell) {
  const cleaned = stripWiki(cell).replace(/[^\d-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function roundDepth(round, position) {
  const text = `${stripWiki(round)} ${stripWiki(position)}`.toLowerCase();
  if (text.includes('champion') || text.includes('1st')) return 100;
  if (text.includes('world cup final') || /\bfinal\b/.test(text)) return 95;
  if (text.includes('runner') || text.includes('2nd')) return 90;
  if (text.includes('third') || text.includes('3rd')) return 80;
  if (text.includes('fourth') || text.includes('4th')) return 70;
  if (text.includes('semi')) return 75;
  if (text.includes('quarter')) return 60;
  if (text.includes('round of 16') || text.includes('round 2')) return 50;
  if (text.includes('round 1')) return 40;
  if (text.includes('group')) return 30;
  for (const [key, depth] of Object.entries(ROUND_DEPTH)) {
    if (text.includes(key)) return depth;
  }
  return 20;
}

function findStandardRecordTable(wikitext) {
  const pattern = /\{\|\s*class="wikitable[\s\S]*?\|\}/g;
  const tables = wikitext.match(pattern) ?? [];

  for (const table of tables) {
    const header = table.slice(0, 600).toLowerCase();
    if (!header.includes('year')) continue;
    if (!header.includes('round')) continue;
    if (!header.includes('position')) continue;
    return table;
  }
  return null;
}

export function parseStandardTournamentTable(wikitext) {
  const table = findStandardRecordTable(wikitext);
  if (!table) return [];

  const rows = table.split('|-').slice(1);
  const records = [];

  for (const row of rows) {
    const rawCells = row
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('|') && !line.startsWith('|}'))
      .flatMap((line) => line.replace(/^\|/, '').split('||'))
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (rawCells.length < 3) continue;

    const cells = rawCells;

    const year = parseYear(cells[0]);
    if (!year || year < 1930 || year > 2030) continue;

    const round = stripWiki(cells[1]);
    const position = stripWiki(cells[2]);
    if (!round && !position) continue;

    records.push({
      year,
      round: round || null,
      position: position || null,
      played: cells[3] != null ? parseIntCell(cells[3]) : null,
      won: cells[4] != null ? parseIntCell(cells[4]) : null,
      drawn: cells[5] != null ? parseIntCell(cells[5]) : null,
      lost: cells[6] != null ? parseIntCell(cells[6]) : null,
      goalsFor: cells[7] != null ? parseIntCell(cells[7]) : null,
      goalsAgainst: cells[8] != null ? parseIntCell(cells[8]) : null,
    });
  }

  return records.sort((a, b) => a.year - b.year);
}

/** Fallback: tabla Year/Round/Opponents (ej. Alemania). */
export function parseMatchListTournamentTable(wikitext) {
  const idx = wikitext.search(/!Year\s*\n!Round\s*\n!Opponents/i);
  if (idx < 0) return [];

  const start = wikitext.lastIndexOf('{|', idx);
  if (start < 0) return [];

  let depth = 0;
  let table = '';
  for (let i = start; i < wikitext.length; i += 1) {
    if (wikitext.slice(i, i + 2) === '{|') depth += 1;
    if (wikitext.slice(i, i + 2) === '|}') {
      depth -= 1;
      table += '|}';
      if (depth === 0) break;
    }
    table += wikitext[i];
  }

  const rows = table.split('|-').slice(1);
  const byYear = new Map();
  let currentYear = null;

  for (const row of rows) {
    const cells = row
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('|') && !line.startsWith('|}'))
      .flatMap((line) => line.replace(/^\|/, '').split('||'))
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (!cells.length) continue;

    let year = null;
    let yearCellIdx = -1;

    for (let i = 0; i < cells.length; i += 1) {
      const y = parseYear(cells[i]);
      if (y) {
        year = y;
        yearCellIdx = i;
        currentYear = y;
        break;
      }
    }

    if (!year) year = currentYear;
    if (!year || year < 1930 || year > 2030) continue;

    const round = stripWiki(
      yearCellIdx >= 0 ? cells[yearCellIdx + 1] ?? '' : cells[0] ?? ''
    );
    if (!round || round.length < 3) continue;

    const depthScore = roundDepth(round, '');
    const existing = byYear.get(year);
    if (!existing || depthScore > existing.depthScore) {
      byYear.set(year, {
        year,
        round: round || null,
        position: inferPositionFromRound(round),
        depthScore,
        played: null,
        won: null,
        drawn: null,
        lost: null,
        goalsFor: null,
        goalsAgainst: null,
      });
    }
  }

  return [...byYear.values()]
    .map(({ depthScore, ...rest }) => rest)
    .sort((a, b) => a.year - b.year);
}

function inferPositionFromRound(round) {
  const text = String(round ?? '').toLowerCase();
  if (text.includes('champion') || text.includes('final') && text.includes('win')) return '1st';
  if (text.includes('runner')) return '2nd';
  if (text.includes('third')) return '3rd';
  if (text.includes('semi')) return '4th';
  if (text.includes('quarter')) return '5th–8th';
  if (text.includes('round of 16')) return '9th–16th';
  if (text.includes('group')) return 'Group stage';
  return null;
}

export function parseNationTournamentRecords(wikitext) {
  if (!wikitext) return [];
  const standard = parseStandardTournamentTable(wikitext);
  if (standard.length) return standard;
  return parseMatchListTournamentTable(wikitext);
}

async function main() {
  const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  const codes = Object.keys(profiles.profiles ?? {});

  const recordsByNation = {};
  const fetchLog = { ok: 0, missing: 0, empty: 0, errors: [] };

  for (const code of codes) {
    const title = WIKI_TITLE_BY_CODE[code];
    if (!title) {
      recordsByNation[code] = [];
      fetchLog.missing += 1;
      continue;
    }

    try {
      const wikitext = await fetchWikiPage(title);
      if (!wikitext) {
        recordsByNation[code] = [];
        fetchLog.missing += 1;
      } else {
        const records = parseNationTournamentRecords(wikitext);
        recordsByNation[code] = records;
        if (records.length) fetchLog.ok += 1;
        else fetchLog.empty += 1;
      }
    } catch (err) {
      recordsByNation[code] = [];
      fetchLog.errors.push({ code, message: err.message });
    }

    await sleep(FETCH_DELAY_MS);
  }

  history.recordsByNation = recordsByNation;
  history.recordsByNationSyncedAt = new Date().toISOString();
  history.recordsByNationSource = 'Wikipedia (en) — nation tournament tables';

  fs.writeFileSync(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);

  console.log(
    `Updated ${HISTORY_PATH}: ${fetchLog.ok} with records, ${fetchLog.empty} empty, ${fetchLog.missing} missing pages`
  );
  if (fetchLog.errors.length) {
    console.warn('Errors:', fetchLog.errors);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
