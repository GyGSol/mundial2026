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

export function applyGridOverridesToLineup(lineup, gridOverrides = {}) {
  if (!lineup || !Object.keys(gridOverrides).length) return lineup;

  const patchSide = (sideKey) => {
    const side = lineup[sideKey];
    if (!side?.players?.length) return side;
    return {
      ...side,
      players: side.players.map((player) => {
        const key = `${sideKey}:${player.shirtNumber ?? player.name}`;
        const override = gridOverrides[key];
        if (!override) return player;
        return {
          ...player,
          gridX: override.gridX,
          gridY: override.gridY,
        };
      }),
    };
  };

  return {
    ...lineup,
    home: patchSide('home'),
    away: patchSide('away'),
  };
}
