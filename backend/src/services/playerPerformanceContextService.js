import { Player } from '../models/Player.js';
import {
  fetchPersonPerformance,
  isFootballDataRequestAllowed,
  isFootballDataUnavailableError,
} from './footballDataApiClient.js';

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_FETCHES = 10;

function currentSeasonYear(now = new Date()) {
  return now.getFullYear();
}

function isSnapshotFresh(snapshot, now = Date.now()) {
  if (!snapshot?.fetchedAt) return false;
  if (snapshot.seasonYear !== currentSeasonYear(new Date(now))) return false;
  return now - new Date(snapshot.fetchedAt).getTime() < SNAPSHOT_TTL_MS;
}

function totalsFromRecentMatches(recentMatches = [], scope) {
  const totals = {
    matches: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
  };

  for (const match of recentMatches) {
    if (scope && match.scope !== scope) continue;
    totals.matches += 1;
    if (match.started) totals.starts += 1;
    totals.minutes += Number(match.minutes ?? 0) || 0;
    totals.goals += Number(match.goals ?? 0) || 0;
    totals.assists += Number(match.assists ?? 0) || 0;
    totals.yellowCards += Number(match.yellowCards ?? 0) || 0;
    totals.redCards += Number(match.redCards ?? 0) || 0;
  }

  return totals;
}

function estimateKmPerMatchAvg(totals) {
  const matches = Number(totals?.matches ?? 0);
  const minutes = Number(totals?.minutes ?? 0);
  if (!matches || !minutes) return null;
  const avgMinutes = minutes / matches;
  // Aproximación orientativa: ~0.11 km/min en cancha (9-11 km por 90').
  return Math.round(((avgMinutes * 0.11 * matches) / matches) * 10) / 10;
}

export function buildCompactPerformanceContext(player) {
  const snapshot = player.performanceSnapshot;
  const recentMatches = snapshot?.recentMatches?.length
    ? snapshot.recentMatches
    : player.recentMatches ?? [];

  const club = snapshot?.club ?? totalsFromRecentMatches(recentMatches, 'club');
  const nationalTeam =
    snapshot?.nationalTeam ?? totalsFromRecentMatches(recentMatches, 'national');
  const combinedMinutes = (club.minutes ?? 0) + (nationalTeam.minutes ?? 0);
  const combinedMatches = (club.matches ?? 0) + (nationalTeam.matches ?? 0);

  const recent = recentMatches.slice(0, 6).map((m) => ({
    date: m.date,
    rival: m.opponent,
    resultado: m.result,
    min: m.minutes ?? null,
    goles: m.goals ?? 0,
    asist: m.assists ?? 0,
    TA: m.yellowCards ?? 0,
    TR: m.redCards ?? 0,
    ambito: m.scope === 'national' ? 'Selección' : m.scope === 'club' ? 'Club' : '?',
    torneo: m.competition ?? '',
  }));

  return {
    temporada: snapshot?.seasonYear ?? currentSeasonYear(),
    fuente: snapshot?.source || (recentMatches.length ? 'local' : 'sin_datos'),
    actualizado: snapshot?.fetchedAt ?? null,
    club: {
      PJ: club.matches ?? 0,
      titularidades: club.starts ?? 0,
      minutos: club.minutes ?? 0,
      goles: club.goals ?? 0,
      asistencias: club.assists ?? 0,
      amarillas: club.yellowCards ?? 0,
      rojas: club.redCards ?? 0,
      kmPromedioPartido: estimateKmPerMatchAvg(club),
    },
    seleccion: {
      PJ: nationalTeam.matches ?? 0,
      titularidades: nationalTeam.starts ?? 0,
      minutos: nationalTeam.minutes ?? 0,
      goles: nationalTeam.goals ?? 0,
      asistencias: nationalTeam.assists ?? 0,
      amarillas: nationalTeam.yellowCards ?? 0,
      rojas: nationalTeam.redCards ?? 0,
      kmPromedioPartido: estimateKmPerMatchAvg(nationalTeam),
    },
    acumuladoTemporada: {
      PJ: combinedMatches,
      minutos: combinedMinutes,
      kmPromedioPartido: estimateKmPerMatchAvg({
        matches: combinedMatches,
        minutes: combinedMinutes,
      }),
    },
    ultimosPartidos: recent,
  };
}

export async function refreshPlayerPerformanceSnapshot(player, { fetchImpl = fetch } = {}) {
  if (!isFootballDataRequestAllowed() || !player?.footballDataPersonId) return null;

  try {
    const performance = await fetchPersonPerformance(player.footballDataPersonId);
    await Player.findByIdAndUpdate(player._id, {
      $set: {
        performanceSnapshot: performance,
        recentMatches: performance.recentMatches,
      },
    });
    return performance;
  } catch (err) {
    if (!isFootballDataUnavailableError(err)) {
      console.warn(`Performance snapshot skip ${player.externalId}:`, err.message);
    }
    return null;
  }
}

export async function hydrateRosterPerformanceSnapshots(
  rosterPlayers = [],
  { maxFetches = DEFAULT_MAX_FETCHES, force = false } = {}
) {
  if (!isFootballDataRequestAllowed()) {
    return { fetched: 0, skipped: rosterPlayers.length, reason: 'football_data_unavailable' };
  }

  const now = Date.now();
  const candidates = rosterPlayers
    .filter((p) => p.footballDataPersonId)
    .filter((p) => force || !isSnapshotFresh(p.performanceSnapshot, now))
    .sort((a, b) => {
      const aTime = a.performanceSnapshot?.fetchedAt
        ? new Date(a.performanceSnapshot.fetchedAt).getTime()
        : 0;
      const bTime = b.performanceSnapshot?.fetchedAt
        ? new Date(b.performanceSnapshot.fetchedAt).getTime()
        : 0;
      return aTime - bTime;
    })
    .slice(0, Math.max(0, maxFetches));

  let fetched = 0;
  for (const player of candidates) {
    const snapshot = await refreshPlayerPerformanceSnapshot(player);
    if (snapshot) {
      player.performanceSnapshot = snapshot;
      player.recentMatches = snapshot.recentMatches;
      fetched += 1;
    }
  }

  return {
    fetched,
    skipped: rosterPlayers.length - fetched,
    pending: Math.max(
      0,
      rosterPlayers.filter((p) => p.footballDataPersonId).length - fetched
    ),
  };
}

export async function reloadRosterPlayersWithPerformance(rosterPlayers = []) {
  const ids = rosterPlayers.map((p) => p._id);
  const fresh = await Player.find({ _id: { $in: ids } }).lean();
  const byId = new Map(fresh.map((p) => [String(p._id), p]));
  return rosterPlayers.map((p) => byId.get(String(p._id)) ?? p);
}
