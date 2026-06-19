import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';

function teamLabel(team, fallbackId) {
  if (!team) return fallbackId || '—';
  return team.fifaCode || team.nameEn || team.externalId || fallbackId || '—';
}

function formatPartidoLabel(match, homeLabel, awayLabel) {
  const ext = match.externalId ?? '?';
  const group = match.group ? ` (${match.group})` : '';
  const status = match.status ? ` [${match.status}]` : '';
  return `#${ext} ${homeLabel} vs ${awayLabel}${group}${status}`;
}

export async function buildPredictionsExport() {
  const predictions = await Prediction.find({})
    .populate('userId', 'name email isAiUser')
    .populate(
      'matchId',
      'externalId homeTeamId awayTeamId status homeScore awayScore group kickoffAt'
    )
    .lean();

  const teamIds = new Set();
  for (const p of predictions) {
    if (p.matchId?.homeTeamId) teamIds.add(p.matchId.homeTeamId);
    if (p.matchId?.awayTeamId) teamIds.add(p.matchId.awayTeamId);
  }

  const teams = teamIds.size
    ? await Team.find({ externalId: { $in: [...teamIds] } }).lean()
    : [];
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  const predicciones = predictions
    .filter((p) => p.userId && p.matchId)
    .map((p) => {
      const match = p.matchId;
      const homeLabel = teamLabel(teamMap[match.homeTeamId], match.homeTeamId);
      const awayLabel = teamLabel(teamMap[match.awayTeamId], match.awayTeamId);
      return {
        usuario: p.userId.name,
        email: p.userId.email,
        partido: formatPartidoLabel(match, homeLabel, awayLabel),
        marcador: `${p.homeGoals}-${p.awayGoals}`,
        enviado: p.userSubmitted ? 'sí' : 'no',
        origen: p.predictionSource ?? 'user',
        puntos: p.pointsEarned ?? null,
        actualizado: (p.updatedAt ?? p.createdAt)?.toISOString?.() ?? null,
      };
    });

  const emails = new Set(predicciones.map((r) => r.email).filter(Boolean));

  return {
    version: 1,
    type: 'predictions_export',
    exportedAt: new Date().toISOString(),
    total: predicciones.length,
    jugadores: emails.size,
    predicciones,
  };
}
