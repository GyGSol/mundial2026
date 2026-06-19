import { Match } from '../models/Match.js';
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

function applyGridsToSide(side) {
  if (!side?.players?.length) return side;
  const withGrids = assignPlayersToFormation(
    side.players,
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
    home: applyGridsToSide(home),
    away: applyGridsToSide(away),
  };

  return snapshot;
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

  const confirmed = isConfirmedSnapshot(snapshot);
  return {
    status: confirmed ? 'confirmed' : 'probable',
    updatedAt: snapshot.fetchedAt ?? null,
    source: snapshot.source ?? 'heuristic',
    home: {
      formation: snapshot.home?.formation ?? null,
      coach: snapshot.home?.coach ?? null,
      players: snapshot.home?.players ?? [],
    },
    away: {
      formation: snapshot.away?.formation ?? null,
      coach: snapshot.away?.coach ?? null,
      players: snapshot.away?.players ?? [],
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

export async function buildMatchLineupPayload(match) {
  if (!match?.homeTeamId || !match?.awayTeamId) {
    return formatLineupPayload(null);
  }

  const snapshot = match.raw?.lineupSnapshot;
  if (snapshot?.home?.players?.length || snapshot?.away?.players?.length) {
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
