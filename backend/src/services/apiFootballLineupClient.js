import { env } from '../config/env.js';

const WC_LEAGUE_ID = 1;
const MIN_REQUEST_INTERVAL_MS = 1200;
const GRID_CACHE_MS = 10 * 60 * 1000;

let lastRequestAt = 0;

export function hasApiFootballKey() {
  return Boolean(env.apiFootballKey);
}

async function throttle() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function apiFootballRequest(path, { fetchImpl = fetch } = {}) {
  if (!hasApiFootballKey()) {
    throw new Error('API_FOOTBALL_KEY no configurado');
  }

  await throttle();
  const base = (env.apiFootballUrl || 'https://v3.football.api-sports.io').replace(/\/$/, '');
  const res = await fetchImpl(`${base}${path}`, {
    headers: {
      'x-apisports-key': env.apiFootballKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API-Football ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

function normalizeTeamLabel(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function teamsMatch(fixtureSide, team) {
  const labels = [
    normalizeTeamLabel(fixtureSide?.name),
    normalizeTeamLabel(fixtureSide?.id),
  ].filter(Boolean);
  const candidates = [
    normalizeTeamLabel(team?.nameEn),
    normalizeTeamLabel(team?.fifaCode),
    normalizeTeamLabel(team?.externalId),
  ].filter(Boolean);

  return candidates.some((candidate) =>
    labels.some(
      (label) =>
        label.includes(candidate.slice(0, 4)) || candidate.includes(label.slice(0, 4))
    )
  );
}

import { mapFootballDataPositionText } from '../utils/formationLayout.js';

function mapApiFootballPos(pos) {
  const code = String(pos ?? '').trim().toUpperCase();
  if (code === 'G') return 'GK';
  if (code === 'D') return 'DEF';
  if (code === 'M') return 'MID';
  if (code === 'F') return 'FWD';
  return mapFootballDataPositionText(pos);
}

export function parseApiFootballLineupSide(side) {
  if (!side) return null;
  const formation = side.formation || null;
  const coach = side.coach?.name ?? null;
  const startXI = (side.startXI ?? []).map((entry) => ({
    playerId: entry.player?.id ? `af-${entry.player.id}` : null,
    apiFootballPlayerId: entry.player?.id ?? null,
    name: entry.player?.name ?? '',
    shirtNumber: entry.player?.number ?? null,
    position: mapApiFootballPos(entry.player?.pos),
    positionDetail: entry.player?.pos ?? null,
    gridRaw: entry.player?.grid ?? null,
    isStarter: true,
  }));

  if (!startXI.length) return null;
  return { formation, coach, players: startXI };
}

function lastNameKey(value) {
  const tokens = normalizeTeamLabel(value).split(/\s+/).filter(Boolean);
  return tokens.length ? tokens[tokens.length - 1] : '';
}

function findApiPlayerMatch(player, apiPlayers, byNumber, byName) {
  const num = player.shirtNumber != null ? Number(player.shirtNumber) : null;
  if (num != null && byNumber.get(num)) return byNumber.get(num);

  const exact = byName.get(normalizeTeamLabel(player.name));
  if (exact) return exact;

  const last = lastNameKey(player.name);
  if (!last || last.length < 3) return null;

  const byLastName = apiPlayers.filter((api) => lastNameKey(api.name) === last);
  return byLastName.length === 1 ? byLastName[0] : null;
}

export function mergeGridOntoPlayers(basePlayers, apiPlayers) {
  if (!apiPlayers?.length) return basePlayers;

  const byNumber = new Map(
    apiPlayers
      .filter((p) => p.shirtNumber != null)
      .map((p) => [Number(p.shirtNumber), p])
  );
  const byName = new Map(
    apiPlayers.map((p) => [normalizeTeamLabel(p.name), p])
  );

  return basePlayers.map((player) => {
    const apiMatch = findApiPlayerMatch(player, apiPlayers, byNumber, byName);
    if (!apiMatch) return player;

    return {
      ...player,
      shirtNumber: player.shirtNumber ?? apiMatch.shirtNumber ?? null,
      gridRaw: apiMatch.gridRaw ?? player.gridRaw,
      positionDetail: player.positionDetail ?? apiMatch.positionDetail ?? null,
    };
  });
}

export function shouldRefreshApiFootballGrid(snapshot) {
  if (!snapshot?.fetchedAt) return true;
  if (snapshot.source !== 'api-football') return true;
  const age = Date.now() - new Date(snapshot.fetchedAt).getTime();
  return age > GRID_CACHE_MS;
}

export async function resolveApiFootballFixtureId(match, homeTeam, awayTeam, { fetchImpl = fetch } = {}) {
  const cached = match.raw?.apiFootballFixtureId;
  if (cached) return Number(cached);

  if (!match.kickoffAt || !hasApiFootballKey()) return null;

  const date = match.kickoffAt.toISOString().slice(0, 10);
  const season = env.apiFootballSeason || '2026';
  const data = await apiFootballRequest(
    `/fixtures?league=${WC_LEAGUE_ID}&season=${season}&date=${date}`,
    { fetchImpl }
  );
  const fixtures = data?.response ?? [];

  const found = fixtures.find(
    (entry) =>
      teamsMatch(entry.teams?.home, homeTeam) && teamsMatch(entry.teams?.away, awayTeam)
  );

  return found?.fixture?.id ?? null;
}

export async function fetchFixtureLineups(fixtureId, { fetchImpl = fetch } = {}) {
  if (!fixtureId || !hasApiFootballKey()) return null;
  const data = await apiFootballRequest(`/fixtures/lineups?fixture=${fixtureId}`, { fetchImpl });
  const sides = data?.response ?? [];
  if (!sides.length) return null;

  const homeSide = sides[0] ? parseApiFootballLineupSide(sides[0]) : null;
  const awaySide = sides[1] ? parseApiFootballLineupSide(sides[1]) : null;
  return { home: homeSide, away: awaySide, fixtureId: Number(fixtureId) };
}

export { GRID_CACHE_MS, WC_LEAGUE_ID };
