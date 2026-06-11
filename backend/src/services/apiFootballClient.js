import { env } from '../config/env.js';

const MIN_REQUEST_INTERVAL_MS = 6500;
let lastRequestAt = 0;

function hasToken() {
  return Boolean(env.apiFootballKey);
}

async function throttle() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function request(path, params = {}) {
  if (!hasToken()) {
    throw new Error('API_FOOTBALL_KEY no configurado');
  }

  await throttle();
  const base = env.apiFootballUrl.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: {
      'x-apisports-key': env.apiFootballKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API-Football ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football: ${JSON.stringify(data.errors)}`);
  }

  return data.response ?? [];
}

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function mapApiFootballCard(detail) {
  const normalized = String(detail ?? '').toLowerCase();
  if (normalized.includes('second yellow') || normalized.includes('yellow/red')) {
    return 'YELLOW_RED';
  }
  if (normalized.includes('red')) return 'RED';
  return 'YELLOW';
}

export function splitApiFootballEvents(events, homeTeamId, awayTeamId) {
  const homeId = Number(homeTeamId);
  const awayId = Number(awayTeamId);

  const sideOf = (teamId) => {
    if (teamId === homeId) return 'home';
    if (teamId === awayId) return 'away';
    return null;
  };

  const homeBookings = [];
  const awayBookings = [];
  const homeSubstitutions = [];
  const awaySubstitutions = [];

  for (const event of events ?? []) {
    const type = String(event?.type ?? '').toLowerCase();
    const teamId = Number(event?.team?.id);
    const side = sideOf(teamId);
    if (!side) continue;

    const minuteRaw = event?.time?.elapsed ?? event?.time?.extra;
    const minute = Number.isFinite(Number(minuteRaw)) ? Number(minuteRaw) : null;

    if (type === 'card') {
      const player = event?.player?.name;
      if (!player) continue;
      const entry = {
        minute,
        player: String(player).trim(),
        card: mapApiFootballCard(event.detail),
      };
      if (side === 'home') homeBookings.push(entry);
      else awayBookings.push(entry);
      continue;
    }

    if (type === 'subst') {
      const playerIn = event?.player?.name;
      const playerOut = event?.assist?.name;
      if (!playerIn || !playerOut) continue;
      const entry = {
        minute,
        playerOut: String(playerOut).trim(),
        playerIn: String(playerIn).trim(),
      };
      if (side === 'home') homeSubstitutions.push(entry);
      else awaySubstitutions.push(entry);
    }
  }

  const byMinute = (a, b) => (a.minute ?? 0) - (b.minute ?? 0);

  return {
    homeBookings: homeBookings.sort(byMinute),
    awayBookings: awayBookings.sort(byMinute),
    homeSubstitutions: homeSubstitutions.sort(byMinute),
    awaySubstitutions: awaySubstitutions.sort(byMinute),
  };
}

async function findTeamId(team) {
  const cached = team?.apiFootballTeamId ?? team?.raw?.apiFootballTeamId;
  if (cached) return Number(cached);

  const searchName = team?.nameEn || team?.fifaCode;
  if (!searchName) return null;

  const results = await request('/teams', { search: searchName });
  const target = normalizeName(searchName);
  const match =
    results.find((entry) => normalizeName(entry?.team?.name) === target) ??
    results.find((entry) => normalizeName(entry?.team?.name).includes(target)) ??
    results[0];

  return match?.team?.id ? Number(match.team.id) : null;
}

export async function resolveApiFootballFixtureId(match, homeTeam, awayTeam) {
  const cached = match.raw?.apiFootballFixtureId;
  if (cached) return Number(cached);

  if (!match.kickoffAt) return null;

  const homeTeamId = await findTeamId(homeTeam);
  if (!homeTeamId) return null;

  const date = match.kickoffAt.toISOString().slice(0, 10);
  const fixtures = await request('/fixtures', { date, team: homeTeamId });
  const awayTarget = normalizeName(awayTeam?.nameEn);

  const found = fixtures.find((entry) => {
    const awayName = normalizeName(entry?.teams?.away?.name);
    return awayName === awayTarget || awayName.includes(awayTarget) || awayTarget.includes(awayName);
  });

  return found?.fixture?.id ? Number(found.fixture.id) : null;
}

export async function fetchFixtureEvents(fixtureId) {
  return request('/fixtures/events', { fixture: fixtureId });
}

export async function fetchMatchEvents(match, homeTeam, awayTeam) {
  const fixtureId = await resolveApiFootballFixtureId(match, homeTeam, awayTeam);
  if (!fixtureId) return { fixtureId: null, events: null };

  const homeTeamId = await findTeamId(homeTeam);
  const awayTeamId = await findTeamId(awayTeam);
  if (!homeTeamId || !awayTeamId) return { fixtureId, events: null };

  const rawEvents = await fetchFixtureEvents(fixtureId);
  const events = splitApiFootballEvents(rawEvents, homeTeamId, awayTeamId);
  return { fixtureId, events };
}

export { hasToken };
