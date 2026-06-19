#!/usr/bin/env node
/**
 * Descarga datos históricos del Mundial desde Wikipedia y genera
 * backend/src/data/worldCupHistory.json
 *
 * Uso: node scripts/sync-wikipedia-history.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../backend/src/data/worldCupHistory.json');
const USER_AGENT = 'Mundial2026-Pred/1.0 (https://mundial2026-pred.herokuapp.com)';

const HOSTS = {
  1930: { hostFifa: 'URU', hostLabel: 'Uruguay' },
  1934: { hostFifa: 'ITA', hostLabel: 'Italia' },
  1938: { hostFifa: 'FRA', hostLabel: 'Francia' },
  1950: { hostFifa: 'BRA', hostLabel: 'Brasil' },
  1954: { hostFifa: 'SUI', hostLabel: 'Suiza' },
  1958: { hostFifa: 'SWE', hostLabel: 'Suecia' },
  1962: { hostFifa: 'CHI', hostLabel: 'Chile' },
  1966: { hostFifa: 'ENG', hostLabel: 'Inglaterra' },
  1970: { hostFifa: 'MEX', hostLabel: 'México' },
  1974: { hostFifa: 'FRG', hostLabel: 'Alemania Occidental' },
  1978: { hostFifa: 'ARG', hostLabel: 'Argentina' },
  1982: { hostFifa: 'ESP', hostLabel: 'España' },
  1986: { hostFifa: 'MEX', hostLabel: 'México' },
  1990: { hostFifa: 'ITA', hostLabel: 'Italia' },
  1994: { hostFifa: 'USA', hostLabel: 'Estados Unidos' },
  1998: { hostFifa: 'FRA', hostLabel: 'Francia' },
  2002: { hostFifa: 'KOR', hostLabel: 'Corea del Sur y Japón' },
  2006: { hostFifa: 'GER', hostLabel: 'Alemania' },
  2010: { hostFifa: 'RSA', hostLabel: 'Sudáfrica' },
  2014: { hostFifa: 'BRA', hostLabel: 'Brasil' },
  2018: { hostFifa: 'RUS', hostLabel: 'Rusia' },
  2022: { hostFifa: 'QAT', hostLabel: 'Catar' },
  2026: { hostFifa: 'USA', hostLabel: 'Estados Unidos, Canadá y México' },
};

const NATION_NAMES = {
  URU: 'Uruguay',
  ARG: 'Argentina',
  ITA: 'Italia',
  TCH: 'Checoslovaquia',
  HUN: 'Hungría',
  BRA: 'Brasil',
  FRG: 'Alemania Occidental',
  SWE: 'Suecia',
  ENG: 'Inglaterra',
  NED: 'Países Bajos',
  GER: 'Alemania',
  FRA: 'Francia',
  ESP: 'España',
  CRO: 'Croacia',
  USA: 'Estados Unidos',
  MEX: 'México',
  SUI: 'Suiza',
  CHI: 'Chile',
  KOR: 'Corea del Sur',
  RSA: 'Sudáfrica',
  RUS: 'Rusia',
  QAT: 'Catar',
  CAN: 'Canadá',
};

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
  if (!page?.revisions?.[0]?.slots?.main?.content) {
    throw new Error(`No content for ${title}`);
  }
  return page.revisions[0].slots.main.content;
}

function extractTable(wikitext, captionIncludes) {
  const idx = wikitext.indexOf(captionIncludes);
  if (idx < 0) return null;
  const start = wikitext.lastIndexOf('{|', idx);
  if (start < 0) return null;

  let depth = 0;
  for (let i = start; i < wikitext.length; i += 1) {
    if (wikitext.slice(i, i + 2) === '{|') depth += 1;
    if (wikitext.slice(i, i + 2) === '|}') {
      depth -= 1;
      if (depth === 0) return wikitext.slice(start, i + 2);
    }
  }
  return null;
}

function wikiLinkName(cell) {
  const m = cell.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  return m ? (m[2] || m[1]).trim() : null;
}

function fbCode(cell) {
  const m = cell.match(/\{\{fb(?:-rt|-icon)?\|([^}|]+)/);
  return m ? m[1].trim().replace(/\|.*$/, '') : null;
}

function parseFinals(wikitext) {
  const table = extractTable(wikitext, '|+List of FIFA World Cup finals');
  if (!table) throw new Error('Finals table not found');

  const rows = table.split('|-').slice(2);
  const finals = [];

  for (const row of rows) {
    const yearMatch = row.match(/\[\[(\d{4}) FIFA World Cup\|(\d{4})\]\]/);
    if (!yearMatch) continue;

    const year = Number(yearMatch[2]);
    if (year > 2022) continue;

    const teams = [...row.matchAll(/\{\{fb(?:-rt|-icon)?\|([^}|]+)/g)].map((m) =>
      m[1].trim().replace(/\|.*$/, '')
    );
    if (teams.length < 2) continue;

    const scoreMatch = row.match(/\[\[[^\]]+final\|([^\]]+)\]\]/);
    let score = scoreMatch ? scoreMatch[1].trim() : null;
    if (score) {
      score = score
        .replace(/\{\{aet\}\}/g, ' a.e.t.')
        .replace(/\{\{sort\|[^}]+\|([^}]+)\}\}/g, '$1')
        .trim();
    }

    if (year === 1950 && !score) score = '2–1';

    const attMatch = row.match(/align=center\|\s*([\d,]+)/);
    const host = HOSTS[year] ?? null;

    finals.push({
      year,
      hostFifa: host?.hostFifa ?? null,
      hostLabel: host?.hostLabel ?? null,
      winnerFifa: teams[0],
      winnerName: NATION_NAMES[teams[0]] ?? teams[0],
      runnerUpFifa: teams[1],
      runnerUpName: NATION_NAMES[teams[1]] ?? teams[1],
      finalScore: score,
      attendance: attMatch ? Number(attMatch[1].replace(/,/g, '')) : null,
      extraTime: row.includes('bgcolor="#FBCEB1"') || row.includes('{{aet}}'),
      penalties: row.includes('bgcolor="#cedff2"') || /\bpen\./i.test(row),
    });
  }

  return finals.sort((a, b) => a.year - b.year);
}

function parseGoalsFromScorerRow(row) {
  const maybeBold = row.match(/\{\{maybe\|'''(\d+)'''\}\}/);
  if (maybeBold) return Number(maybeBold[1]);

  const scope = row.match(/!scope=row(?:\s+rowspan=\d+)?\|\s*(\d+)/i);
  if (scope) return Number(scope[1]);

  const rowspanGoals = row.match(/!rowspan="?\d+"?\s*\|(\d+)/i);
  if (rowspanGoals) return Number(rowspanGoals[1]);

  const decimals = row.match(/\{\{Decimals\|(\d+)\/\d+/i);
  if (decimals) return Number(decimals[1]);

  return null;
}

function parseRankFromScorerRow(row, currentRank) {
  const explicit =
    row.match(/^\s*\|\s*(\d+)\s*\n/m) ||
    row.match(/\|\s*rowspan="?\d+"?\s*\|(\d+)/i) ||
    row.match(/\|\s*rowspan=\d+\|\s*(\d+)/i);
  if (explicit) return Number(explicit[1]);
  return currentRank;
}

function parseTournamentsFromScorerRow(row) {
  const tournamentsMatch = row.match(/data-sort-value="([^"]+)"\s*\|([^<\n]+)/);
  if (!tournamentsMatch) return [];
  return tournamentsMatch[2]
    .replace(/<[^>]+>/g, '')
    .replace(/[()']/g, '')
    .split(',')
    .map((s) => s.replace(/\s*T\s*$/, '').trim())
    .filter((s) => /^\d{4}$/.test(s));
}

function parseAllTimeScorers(wikitext) {
  const table = extractTable(wikitext, '|+Players with at least 5 goals');
  if (!table) throw new Error('All-time scorers table not found');

  const rows = table.split('|-').slice(2);
  const scorers = [];
  let currentRank = null;

  for (const row of rows) {
    const playerName = wikiLinkName(row);
    if (!playerName) continue;

    currentRank = parseRankFromScorerRow(row, currentRank);
    const goals = parseGoalsFromScorerRow(row);
    if (!goals || !currentRank) continue;

    const nation = fbCode(row);
    scorers.push({
      rank: currentRank,
      playerName,
      nationFifa: nation,
      nationName: NATION_NAMES[nation] ?? nation,
      goals,
      tournaments: parseTournamentsFromScorerRow(row),
    });
  }

  return scorers;
}

function parseTournamentTopScorers(wikitext) {
  const table = extractTable(wikitext, 'Top goalscorers at each FIFA World Cup final tournament');
  if (!table) throw new Error('Tournament scorers table not found');

  const rows = table.split('|-').slice(2);
  const byYear = new Map();

  for (const row of rows) {
    const yearMatch = row.match(/data-sort-value="(\d{4})"/);
    if (!yearMatch) continue;

    const year = Number(yearMatch[1]);
    const playerName = wikiLinkName(row);
    const nation = fbCode(row);
    const goalsCells = [...row.matchAll(/align=center\|(\d+)/g)].map((m) => Number(m[1]));
    const goals = goalsCells[0] ?? null;
    if (!playerName || goals == null) continue;

    const entry = {
      playerName,
      nationFifa: nation,
      nationName: NATION_NAMES[nation] ?? nation,
      goals,
      matchesPlayed: goalsCells[1] ?? null,
    };

    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(entry);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, players]) => ({
      year,
      hostLabel: HOSTS[year]?.hostLabel ?? null,
      topScorers: players,
    }));
}

function buildTitlesByNation(finals) {
  const counts = new Map();
  for (const f of finals) {
    counts.set(f.winnerFifa, (counts.get(f.winnerFifa) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([fifa, titles]) => ({
      fifaCode: fifa,
      name: NATION_NAMES[fifa] ?? fifa,
      titles,
    }))
    .sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name));
}

async function main() {
  console.log('Fetching Wikipedia pages…');
  const [finalsWiki, scorersWiki] = await Promise.all([
    fetchWikiPage('List of FIFA World Cup finals'),
    fetchWikiPage('List of FIFA World Cup top goalscorers'),
  ]);

  const finals = parseFinals(finalsWiki);
  const allTimeTopScorers = parseAllTimeScorers(scorersWiki);
  const topScorersByTournament = parseTournamentTopScorers(scorersWiki);
  const titlesByNation = buildTitlesByNation(finals);

  let existing = {};
  if (fs.existsSync(OUT)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    } catch {
      existing = {};
    }
  }

  const payload = {
    source: 'Wikipedia (en)',
    sourceUrls: [
      'https://en.wikipedia.org/wiki/List_of_FIFA_World_Cup_finals',
      'https://en.wikipedia.org/wiki/List_of_FIFA_World_Cup_top_goalscorers',
    ],
    syncedAt: new Date().toISOString(),
    nationNames: { ...(existing.nationNames ?? {}), ...NATION_NAMES },
    titlesByNation,
    finals,
    allTimeTopScorers,
    topScorersByTournament,
    ...(existing.recordsByNation ? { recordsByNation: existing.recordsByNation } : {}),
    ...(existing.recordsByNationSyncedAt
      ? { recordsByNationSyncedAt: existing.recordsByNationSyncedAt }
      : {}),
    ...(existing.recordsByNationSource
      ? { recordsByNationSource: existing.recordsByNationSource }
      : {}),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Wrote ${OUT}: ${finals.length} finals, ${allTimeTopScorers.length} all-time scorers, ${topScorersByTournament.length} editions`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
