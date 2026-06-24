import { env } from '../config/env.js';

// Datos estructurales de plantel: Football-Data.org (plan Deep Data para squads completos).
// Con plan gratuito, el roster base se carga desde playersSeed.json;
// esta API complementa lineups en vivo e historial de partidos.
// Lesiones y posición habitual: ver playerInjuriesSeed.json (referencia Transfermarkt).

const MIN_REQUEST_INTERVAL_MS = 6500;
const CIRCUIT_DISABLED_MS = 24 * 60 * 60 * 1000;
const CIRCUIT_DEFAULT_MS = 15 * 60 * 1000;

let lastRequestAt = 0;
let throttleChain = Promise.resolve();
let circuitBlockedUntil = 0;
let circuitReason = '';
let circuitLoggedAt = 0;

function hasToken() {
  return Boolean(env.footballDataApiToken);
}

export function isFootballDataCircuitOpen(now = Date.now()) {
  return circuitBlockedUntil > now;
}

/** Token presente y la API no está en circuit-breaker (403 cuenta deshabilitada, etc.). */
export function isFootballDataRequestAllowed(now = Date.now()) {
  return hasToken() && !isFootballDataCircuitOpen(now);
}

export function isFootballDataUnavailableError(err) {
  const message = String(err?.message ?? err ?? '');
  return (
    message.includes('FOOTBALL_DATA_API_TOKEN no configurado') ||
    message.includes('Football-Data unavailable:') ||
    /Football-Data 40[13]:/.test(message)
  );
}

function parseCircuitFromResponse(status, bodyText = '') {
  const body = String(bodyText);
  if (status === 403 && /account has been disabled/i.test(body)) {
    return { ms: CIRCUIT_DISABLED_MS, reason: 'account disabled' };
  }
  if (status === 401) {
    return { ms: CIRCUIT_DISABLED_MS, reason: 'unauthorized token' };
  }
  if (status === 429) {
    const waitMatch = /Wait (\d+) seconds/i.exec(body);
    const waitMs = waitMatch ? Number(waitMatch[1]) * 1000 : CIRCUIT_DEFAULT_MS;
    return { ms: Math.max(waitMs, 60_000), reason: 'rate limited' };
  }
  return null;
}

function openFootballDataCircuit(status, bodyText = '') {
  const trip = parseCircuitFromResponse(status, bodyText);
  if (!trip) return;

  const until = Date.now() + trip.ms;
  if (until <= circuitBlockedUntil) return;

  circuitBlockedUntil = until;
  circuitReason = trip.reason;

  const shouldLog = Date.now() - circuitLoggedAt > 60_000;
  if (shouldLog) {
    circuitLoggedAt = Date.now();
    const resumeAt = new Date(circuitBlockedUntil).toISOString();
    console.warn(
      `Football-Data circuit open (${circuitReason}, HTTP ${status}): skipping API calls until ${resumeAt}`
    );
  }
}

export function resetFootballDataClientStateForTests() {
  lastRequestAt = 0;
  throttleChain = Promise.resolve();
  circuitBlockedUntil = 0;
  circuitReason = '';
  circuitLoggedAt = 0;
}

/** Solo tests: simula respuesta HTTP fatal sin llamar a la API. */
export function tripFootballDataCircuitForTests(status, bodyText = '') {
  openFootballDataCircuit(status, bodyText);
}

async function throttle() {
  const run = throttleChain.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    lastRequestAt = Date.now();
  });
  throttleChain = run.catch(() => {});
  await run;
}

async function request(path, options = {}) {
  if (!hasToken()) {
    throw new Error('FOOTBALL_DATA_API_TOKEN no configurado');
  }
  if (isFootballDataCircuitOpen()) {
    throw new Error(`Football-Data unavailable: ${circuitReason || 'circuit open'}`);
  }

  await throttle();
  const base = env.footballDataApiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    headers: {
      'X-Auth-Token': env.footballDataApiToken,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    openFootballDataCircuit(res.status, text);
    throw new Error(`Football-Data ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

export function mapFootballDataPosition(raw) {
  const value = String(raw ?? '').toUpperCase();
  if (value.includes('GOALKEEPER') || value === 'GK') return 'GK';
  if (value.includes('DEFENCE') || value.includes('DEFENDER') || value === 'DEF') return 'DEF';
  if (value.includes('MIDFIELD') || value === 'MID') return 'MID';
  if (value.includes('OFFENCE') || value.includes('FORWARD') || value === 'FWD') return 'FWD';
  return 'MID';
}

export function normalizeFootballDataPerson(person, teamMeta = {}) {
  const id = person.id ?? person.personId;
  const fullName = person.name ?? [person.firstName, person.lastName].filter(Boolean).join(' ');
  const slug = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const fifaCode = teamMeta.fifaCode || '';
  const externalId = id
    ? `fd-${id}`
    : `${fifaCode || teamMeta.externalId || 'team'}-${slug || 'player'}`;

  const dateOfBirth = person.dateOfBirth ? new Date(person.dateOfBirth) : null;
  const age = dateOfBirth
    ? Math.floor((Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : person.age ?? null;

  const currentTeam = person.currentTeam ?? null;
  const running = currentTeam?.runningCompetitions?.[0] ?? null;

  return {
    externalId,
    footballDataPersonId: id ? Number(id) : undefined,
    fullName,
    teamExternalId: teamMeta.externalId || '',
    fifaCode,
    position: mapFootballDataPosition(person.position),
    currentClub: currentTeam?.name ?? '',
    clubCountry: currentTeam?.area?.name ?? '',
    clubCrestUrl: currentTeam?.crest ?? (currentTeam?.id ? `https://crests.football-data.org/${currentTeam.id}.png` : ''),
    footballDataClubId: currentTeam?.id ? Number(currentTeam.id) : undefined,
    leagueName: running?.name ?? '',
    leagueEmblemUrl: running?.emblem ?? (running?.code ? `https://crests.football-data.org/${running.code}.png` : ''),
    age: age ?? undefined,
    shirtNumber: person.shirtNumber ?? undefined,
    nationality: person.nationality ?? '',
    healthStatus: 'available',
    injuryInfo: '',
    dataSources: { structural: 'football-data.org', injuries: '' },
    raw: person,
  };
}

export async function fetchWorldCupTeams() {
  const data = await request('/competitions/WC/teams');
  return data?.teams ?? [];
}

export async function fetchTeamWithSquad(teamId) {
  const data = await request(`/teams/${teamId}`);
  return data;
}

export async function fetchCompetitionMatchesOnDate(competitionCode, date) {
  const data = await request(
    `/competitions/${competitionCode}/matches?dateFrom=${date}&dateTo=${date}`
  );
  return data?.matches ?? [];
}

export async function fetchMatchDetails(matchId) {
  return request(`/matches/${matchId}`, {
    headers: {
      'X-Unfold-Lineups': 'true',
      'X-Unfold-Bookings': 'true',
      'X-Unfold-Subs': 'true',
    },
  });
}

export async function fetchMatchLineups(matchId) {
  return fetchMatchDetails(matchId);
}

export async function resolveFootballDataMatchId(match, homeTeam, awayTeam) {
  const cached = match.raw?.footballDataMatchId ?? match.raw?.fdMatchId;
  if (cached) return Number(cached);

  const homeFdId = homeTeam?.footballDataTeamId;
  const awayFdId = awayTeam?.footballDataTeamId;
  if (!homeFdId || !awayFdId || !match.kickoffAt) return null;

  const date = match.kickoffAt.toISOString().slice(0, 10);
  const dayMatches = await fetchCompetitionMatchesOnDate('WC', date);
  const found = dayMatches.find(
    (entry) => entry.homeTeam?.id === homeFdId && entry.awayTeam?.id === awayFdId
  );
  return found?.id ?? null;
}

export async function fetchPersonMatches(personId, { limit = 8, dateFrom } = {}) {
  const performance = await fetchPersonPerformance(personId, { limit, dateFrom });
  return performance.recentMatches;
}

const NATIONAL_COMPETITION_PATTERN =
  /world cup|qualif|nations league|friendly|international|copa america|gold cup|euro|afcon|asian cup|concacaf|ofc|friendlies/i;

function emptyTotals() {
  return {
    matches: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

function addTotals(target, delta) {
  target.matches += delta.matches ?? 0;
  target.starts += delta.starts ?? 0;
  target.minutes += delta.minutes ?? 0;
  target.goals += delta.goals ?? 0;
  target.assists += delta.assists ?? 0;
  target.yellowCards += delta.yellowCards ?? 0;
  target.redCards += delta.redCards ?? 0;
}

function inferMatchScope(competitionName = '', competitionCode = '') {
  const label = `${competitionName} ${competitionCode}`.trim();
  if (NATIONAL_COMPETITION_PATTERN.test(label)) return 'national';
  if (label) return 'club';
  return 'unknown';
}

function parsePersonMatchEntry(match) {
  const home = match.homeTeam?.shortName ?? match.homeTeam?.name ?? '?';
  const away = match.awayTeam?.shortName ?? match.awayTeam?.name ?? '?';
  const score = `${match.score?.fullTime?.home ?? '-'}:${match.score?.fullTime?.away ?? '-'}`;
  const competition = match.competition?.name ?? '';
  const competitionCode = match.competition?.code ?? '';
  const scope = inferMatchScope(competition, competitionCode);

  const goals = Number(match.goals ?? match.statistics?.goals ?? 0) || 0;
  const assists = Number(match.assists ?? match.statistics?.assists ?? 0) || 0;
  const minutes = Number(match.minutes ?? match.statistics?.minutesPlayed ?? 0) || 0;
  const yellowCards =
    Number(match.yellowCards ?? match.statistics?.yellowCards ?? 0) || 0;
  const redCards = Number(match.redCards ?? match.statistics?.redCards ?? 0) || 0;
  const started = match.lineup === 'STARTING' || match.starting === true || minutes >= 60;

  return {
    date: match.utcDate?.slice(0, 10) ?? '',
    opponent: `${home} vs ${away}`,
    result: score,
    minutes: minutes || null,
    goals,
    assists,
    yellowCards,
    redCards,
    started,
    scope,
    competition,
    totals: {
      matches: minutes > 0 || goals > 0 || assists > 0 ? 1 : 0,
      starts: started ? 1 : 0,
      minutes,
      goals,
      assists,
      yellowCards,
      redCards,
    },
  };
}

function aggregationsToTotals(aggregations = {}) {
  return {
    matches: Number(aggregations.matchesOnPitch ?? 0) || 0,
    starts: Number(aggregations.startingXI ?? 0) || 0,
    minutes: Number(aggregations.minutesPlayed ?? 0) || 0,
    goals: Number(aggregations.goals ?? 0) || 0,
    assists: Number(aggregations.assists ?? 0) || 0,
    yellowCards: Number(aggregations.yellowCards ?? 0) || 0,
    redCards:
      (Number(aggregations.redCards ?? 0) + Number(aggregations.yellowRedCards ?? 0)) || 0,
  };
}

export async function fetchPersonPerformance(personId, { limit = 12, dateFrom } = {}) {
  const year = new Date().getFullYear();
  const from = dateFrom || `${year}-01-01`;
  const query = new URLSearchParams({
    dateFrom: from,
    status: 'FINISHED',
    limit: String(Math.min(Math.max(limit, 1), 30)),
  });

  const data = await request(`/persons/${personId}/matches?${query.toString()}`);
  const matches = data?.matches ?? [];
  const parsed = matches.map(parsePersonMatchEntry);

  const club = emptyTotals();
  const nationalTeam = emptyTotals();
  for (const entry of parsed) {
    if (entry.scope === 'national') addTotals(nationalTeam, entry.totals);
    else addTotals(club, entry.totals);
  }

  const apiTotals = aggregationsToTotals(data?.aggregations);
  if (!club.matches && !nationalTeam.matches && apiTotals.matches) {
    addTotals(club, apiTotals);
  }

  return {
    seasonYear: year,
    fetchedAt: new Date(),
    source: 'football-data.org',
    club,
    nationalTeam,
    recentMatches: parsed.map(({ totals: _totals, ...match }) => match),
    apiAggregations: apiTotals,
  };
}

export {
  hasToken,
  inferMatchScope,
  parsePersonMatchEntry,
  aggregationsToTotals,
};
