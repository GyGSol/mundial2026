import { Player } from '../models/Player.js';

/** Mínimo de titulares confirmados por equipo para considerar formación publicada. */
export const MIN_CONFIRMED_STARTERS_PER_TEAM = 9;

function serializeStarter(player) {
  return {
    nombre: player.fullName,
    posicion: player.position ?? null,
    dorsal: player.shirtNumber ?? null,
  };
}

export async function countConfirmedStarters(teamExternalId) {
  if (!teamExternalId) return 0;
  return Player.countDocuments({ teamExternalId, lineupStatus: 'starter' });
}

export async function hasConfirmedLineupsForMatch(match) {
  if (!match?.homeTeamId || !match?.awayTeamId) return false;
  const [homeCount, awayCount] = await Promise.all([
    countConfirmedStarters(match.homeTeamId),
    countConfirmedStarters(match.awayTeamId),
  ]);
  return (
    homeCount >= MIN_CONFIRMED_STARTERS_PER_TEAM &&
    awayCount >= MIN_CONFIRMED_STARTERS_PER_TEAM
  );
}

export async function buildConfirmedLineupContext(match) {
  if (!match?.homeTeamId || !match?.awayTeamId) {
    return { confirmada: false, local: [], visitante: [], titularesLocal: 0, titularesVisitante: 0 };
  }

  const [homeStarters, awayStarters] = await Promise.all([
    Player.find({ teamExternalId: match.homeTeamId, lineupStatus: 'starter' })
      .sort({ shirtNumber: 1 })
      .lean(),
    Player.find({ teamExternalId: match.awayTeamId, lineupStatus: 'starter' })
      .sort({ shirtNumber: 1 })
      .lean(),
  ]);

  const confirmada = await hasConfirmedLineupsForMatch(match);

  return {
    confirmada,
    titularesLocal: homeStarters.length,
    titularesVisitante: awayStarters.length,
    local: homeStarters.map(serializeStarter),
    visitante: awayStarters.map(serializeStarter),
    nota: confirmada
      ? 'Formación oficial confirmada (titulares publicados). Priorizá este XI sobre titulares probables.'
      : 'Formación aún no confirmada en la base de datos.',
  };
}
