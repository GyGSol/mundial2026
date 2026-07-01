import {
  applyFormationGridOverridesToLineupPlayers,
  formationOverrideKey,
} from '../../../shared/formationGridOverrides.js';

const LOG_PREFIX = '[admin-formations]';

/** Registra un movimiento de jugador en consola (F12) para replicar en código. */
export function logFormationPlayerMove(entry) {
  const payload = {
    type: 'formation_player_move',
    ...entry,
    loggedAt: new Date().toISOString(),
  };
  console.info(LOG_PREFIX, JSON.stringify(payload, null, 2));
  return payload;
}

export { formationOverrideKey };

export function applyGridOverridesToLineup(lineup, gridOverrides = {}) {
  if (!lineup || !Object.keys(gridOverrides).length) return lineup;
  return applyFormationGridOverridesToLineupPlayers(lineup, gridOverrides);
}
