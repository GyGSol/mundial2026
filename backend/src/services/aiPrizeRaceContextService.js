import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { getLeaderboard } from './leaderboardService.js';
import { projectPrizeDistribution } from './prizePoolService.js';
import { goalDiffScore } from './goalDiffStats.js';

function buildStrategicNote({ rank, winnersCount, enZonaPremio, diffToCutoff, points }) {
  if (enZonaPremio) {
    return `Estás en zona de premio (puesto ${rank} de ${winnersCount} premiados). Priorizá precisión y Gdif para sostener posición.`;
  }
  if (diffToCutoff != null && diffToCutoff >= -6 && diffToCutoff < 0) {
    const needed = Math.abs(diffToCutoff);
    return `Cerca del corte de premios (${needed} pts). Priorizá acertar ganador/empate (3 pts) en este partido.`;
  }
  if (diffToCutoff != null && diffToCutoff < -6) {
    return `Lejos del corte de premios. Buscá aciertos de marcador sin arriesgar por consenso del grupo.`;
  }
  return `Ranking intermedio (${points} pts). Maximizá puntos del partido con base en datos, no en copiar al grupo.`;
}

export async function buildPrizeRaceForGroup(groupId, aiUserId) {
  const group = await CompetitionGroup.findById(groupId).select('name prizesWinnersCount').lean();
  if (!group) return null;

  const winnersCount = Math.max(1, group.prizesWinnersCount ?? 3);
  const leaderboard = await getLeaderboard(groupId, Math.max(winnersCount + 2, 10));
  const aiRow = leaderboard.find((r) => r.id === aiUserId.toString());
  if (!aiRow) return null;

  const cutoffRow = leaderboard[winnersCount - 1] ?? null;
  const enZonaPremio = aiRow.rank <= winnersCount;
  const puntosAlCorte = cutoffRow?.totalPoints ?? null;
  const diferenciaAlCorte =
    puntosAlCorte != null ? aiRow.totalPoints - puntosAlCorte : null;

  const leader = leaderboard[0];
  const gdifActual = goalDiffScore(aiRow.difGl, aiRow.difGv, aiRow.pj);
  const gdifLider = leader
    ? goalDiffScore(leader.difGl, leader.difGv, leader.pj)
    : null;

  let fubolsProyectados = 0;
  try {
    const projection = await projectPrizeDistribution(groupId);
    const slot = projection.distribution?.find((d) => d.userId === aiUserId.toString());
    fubolsProyectados = slot?.fubols ?? 0;
  } catch {
    fubolsProyectados = 0;
  }

  return {
    grupo: group.name,
    grupoId: groupId.toString(),
    rankActual: aiRow.rank,
    puestosPremiados: winnersCount,
    enZonaPremio,
    puntosTotales: aiRow.totalPoints,
    puntosAlCorte,
    diferenciaAlCorte,
    gdifActual: Number(gdifActual.toFixed(3)),
    gdifLider: gdifLider != null ? Number(gdifLider.toFixed(3)) : null,
    fubolsProyectadosSiTerminaAsi: fubolsProyectados,
    pa: aiRow.pa,
    pb: aiRow.pb,
    notaEstrategica: buildStrategicNote({
      rank: aiRow.rank,
      winnersCount,
      enZonaPremio,
      diffToCutoff: diferenciaAlCorte,
      points: aiRow.totalPoints,
    }),
  };
}

export async function buildPrizeRaceContext(aiUserId, focusGroupId = null) {
  const memberships = await UserGroupMembership.find({ userId: aiUserId }).select('groupId').lean();
  if (!memberships.length) return { grupoFoco: null, carreras: [] };

  const groupIds = focusGroupId
    ? [focusGroupId]
    : memberships.map((m) => m.groupId);

  const carreras = [];
  for (const gid of groupIds) {
    const race = await buildPrizeRaceForGroup(gid, aiUserId);
    if (race) carreras.push(race);
  }

  if (!focusGroupId && memberships.length > 1) {
    for (const m of memberships) {
      if (groupIds.some((id) => id.toString() === m.groupId.toString())) continue;
      const race = await buildPrizeRaceForGroup(m.groupId, aiUserId);
      if (race) carreras.push(race);
    }
  }

  const grupoFoco =
    carreras.find((c) => c.diferenciaAlCorte != null && c.diferenciaAlCorte >= -6 && !c.enZonaPremio) ??
    carreras.find((c) => c.enZonaPremio) ??
    carreras[0] ??
    null;

  return {
    grupoFoco: grupoFoco?.grupo ?? null,
    carreraPremios: grupoFoco,
    todasLasCarreras: carreras,
  };
}
