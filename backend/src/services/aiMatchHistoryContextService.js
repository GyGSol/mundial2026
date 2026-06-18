import { Player } from '../models/Player.js';
import { getNationProfile } from './nationFootballProfileService.js';
import {
  aggregateTournamentStats,
  buildRecentTournamentResults,
} from './aiTeamMatchContextService.js';

function normalizeTeamToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function opponentMatchesTeam(opponentName, team) {
  const opp = normalizeTeamToken(opponentName);
  if (!opp) return false;
  const tokens = [team?.nameEn, team?.nameEs, team?.fifaCode, team?.externalId]
    .filter(Boolean)
    .map(normalizeTeamToken);
  return tokens.some((token) => opp.includes(token) || token.includes(opp));
}

export async function buildQualificationContextForTeam(team) {
  if (!team?.fifaCode) return null;
  const profile = await getNationProfile(team.fifaCode);
  if (!profile) return null;
  return {
    code: team.fifaCode,
    nombre: profile.name ?? team.nameEn ?? team.fifaCode,
    participacionesMundial: profile.worldCupAppearances ?? null,
    mejorResultadoHistorico: profile.worldCupBestFinish ?? null,
    notaHistoricaYClasificacion: profile.wikiNote ?? null,
  };
}

export function extractHistoricalH2HFromPreTournament(homeCtx, awayCtx, homeTeam, awayTeam) {
  const meetings = [];
  const pushMeeting = (row, perspective) => {
    if (!row?.fecha && !row?.rival) return;
    meetings.push({
      fecha: row.fecha ?? null,
      rival: row.rival ?? null,
      resultado: row.resultado ?? null,
      competicion: row.competicion ?? null,
      perspectiva: perspective,
    });
  };

  for (const row of homeCtx?.preTorneo ?? []) {
    if (opponentMatchesTeam(row.rival, awayTeam)) pushMeeting(row, homeTeam.fifaCode ?? 'local');
  }
  for (const row of awayCtx?.preTorneo ?? []) {
    if (opponentMatchesTeam(row.rival, homeTeam)) pushMeeting(row, awayTeam.fifaCode ?? 'visitante');
  }

  const seen = new Set();
  return meetings
    .filter((row) => {
      const key = `${row.fecha ?? ''}|${row.resultado ?? ''}|${row.perspectiva ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')))
    .slice(0, 8);
}

function avgFromRecent(results, field) {
  if (!results?.length) return null;
  const values = results.map((r) => Number(r[field] ?? 0)).filter((n) => Number.isFinite(n));
  if (!values.length) return null;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

function parseScore(scoreStr) {
  const parts = String(scoreStr ?? '').split('-');
  if (parts.length !== 2) return { for: null, against: null };
  const gf = Number(parts[0]);
  const ga = Number(parts[1]);
  return {
    for: Number.isFinite(gf) ? gf : null,
    against: Number.isFinite(ga) ? ga : null,
  };
}

function buildPreTournamentFromPlayers(teamExternalId) {
  return Player.find({ teamExternalId })
    .select('recentMatches performanceSnapshot')
    .lean()
    .then((players) => {
      const national = [];
      for (const p of players) {
        const matches = p.performanceSnapshot?.recentMatches?.length
          ? p.performanceSnapshot.recentMatches
          : p.recentMatches ?? [];
        for (const m of matches) {
          if (m.scope === 'national' || m.scope === 'unknown') {
            national.push(m);
          }
        }
      }
      national.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
      return national.slice(0, 8).map((m) => ({
        fecha: m.date ?? null,
        rival: m.opponent ?? null,
        resultado: m.result ?? null,
        competicion: m.competition ?? null,
        goles: m.goals ?? 0,
        asistencias: m.assists ?? 0,
      }));
    });
}

export async function buildTeamMatchHistoryContext(
  team,
  { allMatches = [], teamById = {}, beforeKickoffMs, excludeExternalId } = {}
) {
  if (!team?.externalId) return null;

  const recentTournament = buildRecentTournamentResults(
    team.externalId,
    allMatches,
    teamById,
    { beforeKickoffMs, excludeExternalId, limit: 5 }
  );

  const tournamentStats = aggregateTournamentStats(team.externalId, allMatches, {
    beforeKickoffMs,
    excludeExternalId,
  });

  const last3 = recentTournament.slice(0, 3);
  const goalsForLast3 = last3
    .map((r) => parseScore(r.score).for)
    .filter((n) => n != null);
  const goalsAgainstLast3 = last3
    .map((r) => parseScore(r.score).against)
    .filter((n) => n != null);

  const preTournament = await buildPreTournamentFromPlayers(team.externalId);

  const played = tournamentStats.played ?? 0;
  const goalsPerGame =
    played > 0 ? Number((tournamentStats.goalsFor / played).toFixed(2)) : null;
  const concededPerGame =
    played > 0 ? Number((tournamentStats.goalsAgainst / played).toFixed(2)) : null;

  return {
    code: team.fifaCode ?? team.externalId,
    name: team.nameEn ?? team.externalId,
    torneo2026: {
      partidosJugados: played,
      golesFavor: tournamentStats.goalsFor,
      golesContra: tournamentStats.goalsAgainst,
      promedioGolesFavor: goalsPerGame,
      promedioGolesContra: concededPerGame,
      ultimosPartidos: recentTournament,
      forma: recentTournament.map((r) => r.result).join('') || null,
      esPrimerPartidoEnMundial2026: played === 0,
      advertenciaLectura:
        played === 0
          ? 'PJ=0: aún no disputó partidos en este Mundial 2026; no describir como empates sin goles en fase de grupos.'
          : null,
    },
    tendenciaUltimos3: {
      promedioGolesFavor:
        goalsForLast3.length > 0
          ? Number((goalsForLast3.reduce((a, b) => a + b, 0) / goalsForLast3.length).toFixed(2))
          : null,
      promedioGolesContra:
        goalsAgainstLast3.length > 0
          ? Number(
              (goalsAgainstLast3.reduce((a, b) => a + b, 0) / goalsAgainstLast3.length).toFixed(2)
            )
          : null,
    },
    preTorneo: preTournament,
  };
}

export async function buildMatchHistoryContext(
  homeTeam,
  awayTeam,
  { allMatches = [], teamById = {}, match } = {}
) {
  const beforeKickoffMs = match?.kickoffAt ? new Date(match.kickoffAt).getTime() : undefined;
  const excludeExternalId = match?.externalId;

  const [home, away, clasificacionLocal, clasificacionVisitante] = await Promise.all([
    buildTeamMatchHistoryContext(homeTeam, {
      allMatches,
      teamById,
      beforeKickoffMs,
      excludeExternalId,
    }),
    buildTeamMatchHistoryContext(awayTeam, {
      allMatches,
      teamById,
      beforeKickoffMs,
      excludeExternalId,
    }),
    buildQualificationContextForTeam(homeTeam),
    buildQualificationContextForTeam(awayTeam),
  ]);

  const enfrentamientosDirectosHistoricos = extractHistoricalH2HFromPreTournament(
    home,
    away,
    homeTeam,
    awayTeam
  );

  return {
    local: home,
    visitante: away,
    enfrentamientosDirectosHistoricos,
    clasificacionYMundiales: {
      local: clasificacionLocal,
      visitante: clasificacionVisitante,
    },
  };
}
