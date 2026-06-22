import mongoose from 'mongoose';
import { Prediction } from '../models/Prediction.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { computePredictedGroupStandings } from './predictedGroupStandingsService.js';
import { annotateGroupQualification } from './worldCupStatsService.js';
import { isGroupPhaseMatch } from './groupStandingsUtils.js';

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function outcomeFromScore(home, away) {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'draw';
}

function modeOutcome(outcomes) {
  if (!outcomes.length) return null;
  const counts = { home: 0, draw: 0, away: 0 };
  for (const o of outcomes) counts[o] = (counts[o] ?? 0) + 1;
  let best = 'draw';
  let bestCount = -1;
  for (const [key, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  const pct = Math.round((bestCount / outcomes.length) * 100);
  return { outcome: best, percent: pct, distribution: counts };
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(2));
}

async function humanUserIdsInGroup(groupId) {
  const memberIds = await UserGroupMembership.find({ groupId }).distinct('userId');
  if (!memberIds.length) return [];
  const humans = await User.find({
    _id: { $in: memberIds },
    isAiUser: { $ne: true },
  })
    .select('_id')
    .lean();
  return humans.map((u) => u._id);
}

export function aggregateMatchPredictions(predictions) {
  const homes = predictions.map((p) => p.homeGoals).filter((n) => Number.isFinite(n));
  const aways = predictions.map((p) => p.awayGoals).filter((n) => Number.isFinite(n));
  const outcomes = predictions.map((p) => outcomeFromScore(p.homeGoals, p.awayGoals));

  const medHome = median(homes);
  const medAway = median(aways);
  const mode = modeOutcome(outcomes);

  return {
    muestras: predictions.length,
    mediana: {
      local: medHome != null ? Math.round(medHome) : null,
      visitante: medAway != null ? Math.round(medAway) : null,
    },
    resultadoFrecuente:
      mode?.outcome === 'home'
        ? 'victoria local'
        : mode?.outcome === 'away'
          ? 'victoria visitante'
          : 'empate',
    porcentajeResultadoFrecuente: mode?.percent ?? null,
    dispersion: {
      local: stdDev(homes),
      visitante: stdDev(aways),
    },
    distribucionResultados: mode?.distribution ?? null,
  };
}

function medianPredictionsByMatch(predictionsByMatch) {
  const byMatch = new Map();
  for (const p of predictionsByMatch) {
    const key = p.matchId.toString();
    if (!byMatch.has(key)) byMatch.set(key, []);
    byMatch.get(key).push(p);
  }

  const medianMap = new Map();
  for (const [matchId, preds] of byMatch.entries()) {
    const agg = aggregateMatchPredictions(preds);
    medianMap.set(matchId, {
      homeGoals: agg.mediana.local ?? 0,
      awayGoals: agg.mediana.visitante ?? 0,
      userSubmitted: true,
    });
  }
  return medianMap;
}

export async function buildCrowdConsensusForMatch(match, groupId) {
  const humanIds = await humanUserIdsInGroup(groupId);
  if (!humanIds.length) {
    return { muestras: 0, mediana: null, nota: 'Sin predicciones humanas en el grupo' };
  }

  const preds = await Prediction.find({
    userId: { $in: humanIds },
    matchId: match._id,
    userSubmitted: true,
  })
    .select('homeGoals awayGoals')
    .lean();

  return aggregateMatchPredictions(preds);
}

export async function buildCrowdProjectedStandings(groupId, groupLetter) {
  const humanIds = await humanUserIdsInGroup(groupId);
  if (!humanIds.length) return null;

  const [teams, matches, preds] = await Promise.all([
    Team.find({ group: groupLetter }).lean(),
    Match.find({ group: groupLetter }).sort({ kickoffAt: 1 }).lean(),
    Prediction.find({ userId: { $in: humanIds }, userSubmitted: true })
      .select('matchId homeGoals awayGoals userSubmitted')
      .lean(),
  ]);

  const groupMatches = matches.filter(isGroupPhaseMatch);
  const matchIds = new Set(groupMatches.map((m) => m._id.toString()));
  const relevantPreds = preds.filter((p) => matchIds.has(p.matchId.toString()));

  const medianMap = medianPredictionsByMatch(relevantPreds);
  const raw = computePredictedGroupStandings(teams, groupMatches, medianMap);
  return annotateGroupQualification(raw);
}

export async function buildCrowdContextForCompetitor(match, aiUserId, { includeAllGroups = false } = {}) {
  const memberships = await UserGroupMembership.find({ userId: aiUserId })
    .select('groupId')
    .lean();

  if (!memberships.length) {
    return { grupoFoco: null, consensoPartido: null, tablasConsenso: [] };
  }

  const groupIds = memberships.map((m) => m.groupId);
  const { CompetitionGroup } = await import('../models/CompetitionGroup.js');
  const groups = await CompetitionGroup.find({ _id: { $in: groupIds } })
    .select('name prizesWinnersCount')
    .lean();

  const groupLetter = match.group ? String(match.group).toUpperCase() : null;
  const focusGroupId = await pickFocusGroupId(aiUserId);

  const consensoByGroup = [];
  for (const g of groups) {
    const consenso = await buildCrowdConsensusForMatch(match, g._id);
    const projected =
      groupLetter != null
        ? await buildCrowdProjectedStandings(g._id, groupLetter)
        : null;

    consensoByGroup.push({
      grupoId: g._id.toString(),
      grupoNombre: g.name,
      consensoPartido: consenso,
      tablaProyectadaConsenso: projected,
    });
  }

  const focusId = focusGroupId?.toString();
  const focus =
    (focusId && consensoByGroup.find((c) => c.grupoId === focusId)) ??
    consensoByGroup.find((c) => c.consensoPartido?.muestras > 0) ??
    consensoByGroup[0];

  return {
    grupoFoco: focus?.grupoNombre ?? null,
    consensoPartido: focus?.consensoPartido ?? null,
    tablasConsenso: includeAllGroups
      ? consensoByGroup
          .filter((c) => c.tablaProyectadaConsenso)
          .map((c) => ({
            grupo: c.grupoNombre,
            standings: c.tablaProyectadaConsenso?.[0]?.standings?.map((row) => ({
              rank: row.rank,
              team: row.nameEn ?? row.teamId,
              points: row.points,
              qualificationZone: row.qualificationZone ?? null,
            })),
          }))
      : focus?.tablaProyectadaConsenso
        ? [
            {
              grupo: focus.grupoNombre,
              standings: focus.tablaProyectadaConsenso?.[0]?.standings?.map((row) => ({
                rank: row.rank,
                team: row.nameEn ?? row.teamId,
                points: row.points,
                qualificationZone: row.qualificationZone ?? null,
              })),
            },
          ]
        : [],
    ...(includeAllGroups
      ? {
          todosLosGrupos: consensoByGroup.map((c) => ({
            grupo: c.grupoNombre,
            muestras: c.consensoPartido?.muestras ?? 0,
            mediana: c.consensoPartido?.mediana ?? null,
          })),
        }
      : {}),
  };
}

export async function pickFocusGroupId(aiUserId) {
  const memberships = await UserGroupMembership.find({ userId: aiUserId }).lean();
  if (!memberships.length) return null;

  const { CompetitionGroup } = await import('../models/CompetitionGroup.js');
  const { getLeaderboard } = await import('./leaderboardService.js');
  const { projectPrizeDistribution } = await import('./prizePoolService.js');

  let best = null;
  let bestScore = Infinity;

  for (const m of memberships) {
    const groupId = m.groupId.toString();
    const group = await CompetitionGroup.findById(m.groupId).select('prizesWinnersCount name').lean();
    const winners = group?.prizesWinnersCount ?? 3;
    const leaderboard = await getLeaderboard(groupId, Math.max(winners, 10));
    const aiRow = leaderboard.find((r) => r.id === aiUserId.toString());
    if (!aiRow) continue;

    const cutoff = leaderboard[winners - 1];
    const diff = cutoff ? aiRow.totalPoints - cutoff.totalPoints : 0;
    const score = Math.abs(diff) + (aiRow.rank > winners ? 10 : 0);

    if (score < bestScore) {
      bestScore = score;
      best = { groupId, groupName: group?.name, diff };
    }
  }

  return best?.groupId ?? memberships[0].groupId;
}
