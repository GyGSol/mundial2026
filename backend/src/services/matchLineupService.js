import { fetchMatchDetails, hasToken } from './footballDataApiClient.js';
import { Team } from '../models/Team.js';
import {
  fetchFixtureLineups,
  hasApiFootballKey,
  mergeGridOntoPlayers,
  resolveApiFootballFixtureId,
} from './apiFootballLineupClient.js';
import {
  buildProbableSide,
  DEFAULT_PROBABLE_FORMATION,
  isConfirmedSnapshot,
  serializeFdLineupPlayer,
} from './probableLineupService.js';
import { assignPlayersToFormation, mapFootballDataPositionText } from '../utils/formationLayout.js';

function parseFdTeamSide(teamSide) {
  if (!teamSide) return { formation: DEFAULT_PROBABLE_FORMATION, players: [], coach: null };
  const formation = teamSide.formation || DEFAULT_PROBABLE_FORMATION;
  const players = (teamSide.lineup ?? []).map(serializeFdLineupPlayer);
  return {
    formation,
    coach: teamSide.coach?.name ?? null,
    players,
  };
}

/** Extrae local/visitante del payload Football-Data v4. */
export function parseFootballDataMatchLineups(matchData, homeFdId, awayFdId) {
  if (matchData?.homeTeam?.lineup?.length || matchData?.awayTeam?.lineup?.length) {
    return {
      home: parseFdTeamSide(matchData.homeTeam),
      away: parseFdTeamSide(matchData.awayTeam),
    };
  }

  const lineups = matchData?.lineups ?? [];
  let home = { formation: DEFAULT_PROBABLE_FORMATION, players: [], coach: null };
  let away = { formation: DEFAULT_PROBABLE_FORMATION, players: [], coach: null };

  for (const side of lineups) {
    const teamId = side.team?.id ?? side.teamId;
    const xi = side.startXI ?? side.startingXI ?? side.startingEleven ?? [];
    const players = xi.map((entry) => {
      const person = entry.player ?? entry;
      return {
        playerId: person.id ? `fd-${person.id}` : null,
        footballDataPersonId: person.id ? Number(person.id) : null,
        name: person.name ?? '',
        shirtNumber: person.shirtNumber ?? person.number ?? null,
        position: mapFootballDataPositionText(person.position ?? person.pos),
        positionDetail: person.position ?? person.pos ?? null,
        isStarter: true,
      };
    });
    const parsed = {
      formation: side.formation || DEFAULT_PROBABLE_FORMATION,
      coach: side.coach?.name ?? null,
      players,
    };
    if (teamId && homeFdId && teamId === homeFdId) home = parsed;
    else if (teamId && awayFdId && teamId === awayFdId) away = parsed;
  }

  return { home, away };
}

export const LINEUP_LAYOUT_VERSION = 3;

function normalizePlayerForFormation(player) {
  const detail = player.positionDetail ?? player.position;
  const mapped = mapFootballDataPositionText(detail);
  return {
    ...player,
    position: mapped,
  };
}

function applyGridsToSide(side) {
  if (!side?.players?.length) return side;
  const players = side.players.map(normalizePlayerForFormation);
  const withGrids = assignPlayersToFormation(
    players,
    side.formation || DEFAULT_PROBABLE_FORMATION
  );
  return { ...side, players: withGrids };
}

export function buildLineupSnapshotFromSources({
  fdSides,
  apiSides = null,
  source = 'football-data',
} = {}) {
  let home = fdSides?.home ?? { formation: DEFAULT_PROBABLE_FORMATION, players: [], coach: null };
  let away = fdSides?.away ?? { formation: DEFAULT_PROBABLE_FORMATION, players: [], coach: null };

  if (apiSides?.home?.players?.length) {
    home = {
      formation: apiSides.home.formation || home.formation,
      coach: apiSides.home.coach || home.coach,
      players: mergeGridOntoPlayers(home.players, apiSides.home.players),
    };
  }
  if (apiSides?.away?.players?.length) {
    away = {
      formation: apiSides.away.formation || away.formation,
      coach: apiSides.away.coach || away.coach,
      players: mergeGridOntoPlayers(away.players, apiSides.away.players),
    };
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    source: apiSides ? 'api-football' : source,
    layoutVersion: LINEUP_LAYOUT_VERSION,
    home: applyGridsToSide(home),
    away: applyGridsToSide(away),
  };

  return snapshot;
}

function refreshSnapshotGrids(snapshot) {
  if (!snapshot) return snapshot;
  return {
    ...snapshot,
    home: snapshot.home?.players?.length ? applyGridsToSide(snapshot.home) : snapshot.home,
    away: snapshot.away?.players?.length ? applyGridsToSide(snapshot.away) : snapshot.away,
  };
}

export function formatLineupPayload(snapshot) {
  if (!snapshot?.home?.players?.length && !snapshot?.away?.players?.length) {
    return {
      status: 'unavailable',
      updatedAt: null,
      source: null,
      home: { formation: null, players: [], coach: null },
      away: { formation: null, players: [], coach: null },
    };
  }

  const refreshed = refreshSnapshotGrids(snapshot);
  const confirmed = isConfirmedSnapshot(refreshed);
  return {
    status: confirmed ? 'confirmed' : 'probable',
    updatedAt: refreshed.fetchedAt ?? null,
    source: refreshed.source ?? 'heuristic',
    layoutVersion: LINEUP_LAYOUT_VERSION,
    home: {
      formation: refreshed.home?.formation ?? null,
      coach: refreshed.home?.coach ?? null,
      players: refreshed.home?.players ?? [],
    },
    away: {
      formation: refreshed.away?.formation ?? null,
      coach: refreshed.away?.coach ?? null,
      players: refreshed.away?.players ?? [],
    },
  };
}

export async function buildProbableLineupPayload(match) {
  const [homeSide, awaySide] = await Promise.all([
    buildProbableSide(match.homeTeamId),
    buildProbableSide(match.awayTeamId),
  ]);

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    source: 'heuristic',
    home: homeSide,
    away: awaySide,
  };

  return formatLineupPayload(snapshot);
}

function sideNeedsPositionDetailRefresh(side) {
  return (side?.players ?? []).some(
    (player) => !player.positionDetail || String(player.positionDetail).length <= 3
  );
}

async function refreshLineupSnapshotFromFootballData(match) {
  const fdMatchId = match.raw?.footballDataMatchId ?? match.raw?.fdMatchId;
  if (!fdMatchId || !hasToken()) return null;

  const { homeTeam, awayTeam } = await loadMatchTeams(match);
  if (!homeTeam || !awayTeam) return null;

  const matchData = await fetchMatchDetails(fdMatchId);
  const fdSides = parseFootballDataMatchLineups(
    matchData,
    homeTeam.footballDataTeamId,
    awayTeam.footballDataTeamId
  );
  let snapshot = buildLineupSnapshotFromSources({ fdSides, source: 'football-data' });
  snapshot = await fetchAndMergeApiFootballGrids(match, homeTeam, awayTeam, snapshot);
  snapshot.layoutVersion = LINEUP_LAYOUT_VERSION;
  return snapshot;
}

export async function buildMatchLineupPayload(match) {
  if (!match?.homeTeamId || !match?.awayTeamId) {
    return formatLineupPayload(null);
  }

  let snapshot = match.raw?.lineupSnapshot;
  if (snapshot?.home?.players?.length || snapshot?.away?.players?.length) {
    if (
      snapshot.layoutVersion !== LINEUP_LAYOUT_VERSION &&
      (sideNeedsPositionDetailRefresh(snapshot.home) ||
        sideNeedsPositionDetailRefresh(snapshot.away))
    ) {
      try {
        const refreshed = await refreshLineupSnapshotFromFootballData(match);
        if (refreshed?.home?.players?.length || refreshed?.away?.players?.length) {
          snapshot = refreshed;
          if (match._id) {
            await Match.updateOne(
              { _id: match._id },
              { $set: { 'raw.lineupSnapshot': refreshed } }
            );
          }
        }
      } catch (err) {
        console.warn(`Lineup snapshot refresh skip ${match.externalId}:`, err.message);
      }
    }
    return formatLineupPayload(snapshot);
  }

  return buildProbableLineupPayload(match);
}

export async function enrichMatchesWithLineups(matches) {
  if (!matches?.length) return matches;
  const payloads = await Promise.all(matches.map((m) => buildMatchLineupPayload(m)));
  return matches.map((match, index) => ({
    ...match,
    lineup: payloads[index],
  }));
}

/** Último XI confirmado de un equipo en partidos ya jugados del torneo. */
export async function findLastConfirmedSideForTeam(teamExternalId) {
  const priorMatches = await Match.find({
    status: { $in: ['finished', 'live'] },
    $or: [{ homeTeamId: teamExternalId }, { awayTeamId: teamExternalId }],
    'raw.lineupSnapshot': { $exists: true },
  })
    .sort({ kickoffAt: -1 })
    .limit(5)
    .lean();

  for (const prior of priorMatches) {
    const snap = prior.raw?.lineupSnapshot;
    if (!snap) continue;
    const side =
      prior.homeTeamId === teamExternalId
        ? snap.home
        : prior.awayTeamId === teamExternalId
          ? snap.away
          : null;
    if ((side?.players?.length ?? 0) >= 9) return side;
  }
  return null;
}

export async function fetchAndMergeApiFootballGrids(match, homeTeam, awayTeam, fdSnapshot) {
  if (!hasApiFootballKey() || !fdSnapshot) return fdSnapshot;

  try {
    const fixtureId = await resolveApiFootballFixtureId(match, homeTeam, awayTeam);
    if (!fixtureId) return fdSnapshot;

    const apiLineups = await fetchFixtureLineups(fixtureId);
    if (!apiLineups?.home && !apiLineups?.away) return fdSnapshot;

    return buildLineupSnapshotFromSources({
      fdSides: fdSnapshot,
      apiSides: apiLineups,
      source: 'api-football',
    });
  } catch (err) {
    console.warn(`API-Football lineup grid skip match ${match.externalId}:`, err.message);
    return fdSnapshot;
  }
}

export async function loadMatchTeams(match) {
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);
  return { homeTeam, awayTeam };
}
