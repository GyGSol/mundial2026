import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { env } from '../config/env.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

function hasOddsApi() {
  return Boolean(env.oddsApiKey);
}

function hasApiFootball() {
  return Boolean(env.apiFootballKey);
}

function normalizeProbabilities(home, draw, away) {
  const h = Number(home) || 0;
  const d = Number(draw) || 0;
  const a = Number(away) || 0;
  const sum = h + d + a || 1;
  return {
    home: Number((h / sum).toFixed(3)),
    draw: Number((d / sum).toFixed(3)),
    away: Number((a / sum).toFixed(3)),
  };
}

function oddsToImplied(americanOrDecimal) {
  const o = Number(americanOrDecimal);
  if (!Number.isFinite(o) || o <= 1) return 0;
  return 1 / o;
}

function expectedGoalsFromProbs(probs) {
  const pHome = probs.home ?? 0.33;
  const pDraw = probs.draw ?? 0.34;
  const pAway = probs.away ?? 0.33;
  const homeExpected = 1.1 + pHome * 1.4 - pAway * 0.5;
  const awayExpected = 1.1 + pAway * 1.4 - pHome * 0.5;
  return {
    home: Number(Math.max(0.3, homeExpected).toFixed(2)),
    away: Number(Math.max(0.3, awayExpected).toFixed(2)),
  };
}

async function fetchOddsFromApi(homeTeam, awayTeam, { fetchImpl = fetch } = {}) {
  if (!hasOddsApi()) return null;

  try {
    const sport = env.oddsApiSport || 'soccer_fifa_world_cup';
    const url = `${ODDS_API_BASE}/sports/${sport}/odds/?apiKey=${encodeURIComponent(env.oddsApiKey)}&regions=us&markets=h2h&oddsFormat=decimal`;
    const res = await fetchImpl(url);
    if (!res.ok) return null;

    const events = await res.json();
    if (!Array.isArray(events)) return null;

    const homeName = String(homeTeam?.nameEn ?? '').toLowerCase();
    const awayName = String(awayTeam?.nameEn ?? '').toLowerCase();

    const event = events.find((e) => {
      const h = String(e.home_team ?? '').toLowerCase();
      const a = String(e.away_team ?? '').toLowerCase();
      return (
        (h.includes(homeName.slice(0, 4)) && a.includes(awayName.slice(0, 4))) ||
        (h.includes(awayName.slice(0, 4)) && a.includes(homeName.slice(0, 4)))
      );
    });

    if (!event?.bookmakers?.[0]?.markets?.[0]?.outcomes) return null;

    const outcomes = event.bookmakers[0].markets[0].outcomes;
    let homeOdds = null;
    let drawOdds = null;
    let awayOdds = null;

    for (const o of outcomes) {
      const name = String(o.name ?? '').toLowerCase();
      if (name === 'draw') drawOdds = o.price;
      else if (homeOdds == null) homeOdds = o.price;
      else awayOdds = o.price;
    }

    if (homeOdds == null || awayOdds == null) return null;

    const implied = normalizeProbabilities(
      oddsToImplied(homeOdds),
      oddsToImplied(drawOdds ?? 3.2),
      oddsToImplied(awayOdds)
    );

    return {
      odds: { home: homeOdds, draw: drawOdds, away: awayOdds, source: 'the-odds-api' },
      impliedProbabilities: implied,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('externalMatchIntel odds fetch failed:', err.message);
    return null;
  }
}

async function fetchXgFromApiFootball(match, homeTeam, awayTeam, { fetchImpl = fetch } = {}) {
  if (!hasApiFootball()) return null;

  try {
    const base = env.apiFootballUrl || 'https://v3.football.api-sports.io';
    const headers = {
      'x-apisports-key': env.apiFootballKey,
    };

    const homeCode = homeTeam?.fifaCode ?? homeTeam?.externalId;
    const season = env.apiFootballSeason || '2026';

    const searchUrl = `${base}/fixtures?team=${homeCode}&season=${season}&next=1`;
    const res = await fetchImpl(searchUrl, { headers });
    if (!res.ok) return null;

    const data = await res.json();
    const fixture = data?.response?.[0];
    if (!fixture?.fixture?.id) return null;

    const statsUrl = `${base}/fixtures/statistics?fixture=${fixture.fixture.id}`;
    const statsRes = await fetchImpl(statsUrl, { headers });
    if (!statsRes.ok) return null;

    const statsData = await statsRes.json();
    const teams = statsData?.response ?? [];
    let homeXg = null;
    let awayXg = null;

    for (const block of teams) {
      const xgStat = block.statistics?.find((s) =>
        String(s.type ?? '').toLowerCase().includes('expected')
      );
      const val = Number(xgStat?.value);
      if (!Number.isFinite(val)) continue;
      if (block.team?.id === fixture.teams?.home?.id) homeXg = val;
      if (block.team?.id === fixture.teams?.away?.id) awayXg = val;
    }

    if (homeXg == null && awayXg == null) return null;

    return {
      homeExpected: homeXg,
      awayExpected: awayXg,
      source: 'api-football',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('externalMatchIntel xG fetch failed:', err.message);
    return null;
  }
}

function readCachedIntel(match) {
  const intel = match?.raw?.externalIntel;
  if (!intel?.fetchedAt) return null;
  const age = Date.now() - new Date(intel.fetchedAt).getTime();
  if (age > CACHE_TTL_MS) return null;
  return intel;
}

export async function fetchExternalMatchIntel(match, { fetchImpl = fetch, force = false } = {}) {
  if (!match) return null;

  if (!force) {
    const cached = readCachedIntel(match);
    if (cached) return cached;
  }

  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);

  const [oddsBlock, xgBlock] = await Promise.all([
    fetchOddsFromApi(homeTeam, awayTeam, { fetchImpl }),
    fetchXgFromApiFootball(match, homeTeam, awayTeam, { fetchImpl }),
  ]);

  let implied = oddsBlock?.impliedProbabilities ?? null;
  let xg = xgBlock;

  if (!xg && implied) {
    xg = { ...expectedGoalsFromProbs(implied), source: 'derived-from-odds' };
  }

  const intel = {
    odds: oddsBlock?.odds ?? null,
    impliedProbabilities: implied,
    xg,
    fetchedAt: new Date().toISOString(),
  };

  try {
    await Match.updateOne(
      { _id: match._id },
      { $set: { 'raw.externalIntel': intel } }
    );
  } catch {
    // non-fatal
  }

  return intel;
}

export function formatExternalIntelForPrompt(intel) {
  if (!intel) return null;
  return {
    cuotas: intel.odds,
    probabilidadesImplicitas: intel.impliedProbabilities,
    xgEsperado: intel.xg,
    actualizado: intel.fetchedAt,
  };
}

function normalizeIntelShape(intel) {
  if (!intel) return null;
  if (intel.xg || intel.impliedProbabilities) return intel;
  if (intel.xgEsperado || intel.probabilidadesImplicitas) {
    return {
      xg: intel.xgEsperado ?? null,
      impliedProbabilities: intel.probabilidadesImplicitas ?? null,
    };
  }
  return intel;
}

export function scoreFromExternalIntel(intel) {
  const normalized = normalizeIntelShape(intel);
  if (!normalized) return null;

  if (normalized.xg?.homeExpected != null && normalized.xg?.awayExpected != null) {
    return {
      homeGoals: Math.round(normalized.xg.homeExpected),
      awayGoals: Math.round(normalized.xg.awayExpected),
      reasoning: 'Heurística por xG externo',
      source: 'heuristic-xg',
    };
  }

  if (normalized.impliedProbabilities) {
    const xg = expectedGoalsFromProbs(normalized.impliedProbabilities);
    return {
      homeGoals: Math.round(xg.home),
      awayGoals: Math.round(xg.away),
      reasoning: 'Heurística por probabilidades de mercado',
      source: 'heuristic-odds',
    };
  }

  return null;
}
