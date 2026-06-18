import { Match } from '../models/Match.js';
import { buildUserPredictedMatchContext } from './predictedMatchContextService.js';
import { isGroupPhaseMatch } from './groupStandingsUtils.js';

function standingForTeam(standings, teamExternalId) {
  return standings?.find((row) => row.teamId === teamExternalId) ?? null;
}

function summarizeTeamStakes(row, groupLetter) {
  if (!row) {
    return { grupo: groupLetter, posicion: null, zona: null, puntos: null, notas: ['Sin datos en tabla proyectada'] };
  }

  const notes = [];
  const zone = row.qualificationZone ?? null;

  if (zone === 'direct') {
    notes.push('Zona de clasificación directa (top 2)');
  } else if (zone === 'third_provisional') {
    notes.push('Tercero en carrera por mejor tercero (provisional)');
  } else if (zone === 'third_possible') {
    notes.push('Tercero: depende de otros grupos para mejor tercero');
  } else if (row.rank === 4) {
    notes.push('Último del grupo en proyección actual');
  }

  return {
    grupo: groupLetter,
    posicion: row.rank ?? null,
    zona: zone,
    puntos: row.points ?? 0,
    pj: row.played ?? 0,
    dg: row.goalDiff ?? 0,
    notas: notes,
  };
}

function countRemainingGroupMatches(groupLetter, allMatches, beforeKickoffMs) {
  return allMatches.filter((m) => {
    if (!isGroupPhaseMatch(m)) return false;
    if (String(m.group || '').toUpperCase() !== groupLetter) return false;
    if (m.status !== 'upcoming') return false;
    const kickoff = m.kickoffAt ? new Date(m.kickoffAt).getTime() : NaN;
    if (Number.isFinite(beforeKickoffMs) && Number.isFinite(kickoff) && kickoff < beforeKickoffMs) {
      return false;
    }
    return true;
  }).length;
}

export async function buildMatchStakesContext(match, aiUserId, { userPredictedCtx = null } = {}) {
  const ctx = userPredictedCtx ?? (await buildUserPredictedMatchContext(aiUserId));
  const groupLetter = match.group ? String(match.group).toUpperCase() : null;
  const beforeKickoffMs = match.kickoffAt ? new Date(match.kickoffAt).getTime() : undefined;

  const allMatches = await Match.find().select('-raw').sort({ kickoffAt: 1 }).lean();

  const homeId = match.homeTeamId;
  const awayId = match.awayTeamId;

  let homeStakes = null;
  let awayStakes = null;
  let groupProjected = null;

  if (groupLetter) {
    const groupEntry = ctx.groups.find((g) => g.group === groupLetter);
    groupProjected = groupEntry?.standings?.map((row) => ({
      rank: row.rank,
      team: row.nameEn ?? row.teamId,
      points: row.points,
      played: row.played,
      goalDiff: row.goalDiff,
      qualificationZone: row.qualificationZone ?? null,
    }));

    homeStakes = summarizeTeamStakes(standingForTeam(groupEntry?.standings, homeId), groupLetter);
    awayStakes = summarizeTeamStakes(standingForTeam(groupEntry?.standings, awayId), groupLetter);
  }

  const thirdPlace = {
    ranked: (ctx.thirdPlaceRanked?.ranked ?? []).map((row) => ({
      group: row.group,
      team: row.nameEn ?? row.teamId,
      points: row.points,
      goalDiff: row.goalDiff,
    })),
    combinationKey: ctx.thirdPlaceRanked?.combinationKey ?? null,
    provisional: Boolean(ctx.thirdPlaceRanked?.provisional),
  };

  return {
    fase: groupLetter ? 'grupo' : 'eliminatoria',
    grupo: groupLetter,
    partidosRestantesGrupo: groupLetter
      ? countRemainingGroupMatches(groupLetter, allMatches, beforeKickoffMs)
      : null,
    stakesLocal: homeStakes,
    stakesVisitante: awayStakes,
    tablaProyectadaIA: groupProjected,
    mejoresTerceros: thirdPlace,
    knockoutProgress: ctx.knockout?.progress ?? null,
  };
}

export async function buildTablaYClasificacionContext(match, aiUserId, crowdStandings = null) {
  const ctx = await buildUserPredictedMatchContext(aiUserId);
  const groupLetter = match.group ? String(match.group).toUpperCase() : null;
  if (!groupLetter) return null;

  const groupEntry = ctx.groups.find((g) => g.group === groupLetter);
  const crowdEntry = crowdStandings?.find((g) => g.group === groupLetter);

  return {
    grupo: groupLetter,
    tablaProyectadaIA: groupEntry?.standings?.map((row) => ({
      rank: row.rank,
      team: row.nameEn ?? row.teamId,
      points: row.points,
      qualificationZone: row.qualificationZone ?? null,
    })),
    tablaProyectadaConsenso: crowdEntry?.standings?.map((row) => ({
      rank: row.rank,
      team: row.nameEn ?? row.teamId,
      points: row.points,
      qualificationZone: row.qualificationZone ?? null,
    })),
  };
}
