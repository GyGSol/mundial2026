/** Clave estable side + dorsal (o nombre si no hay dorsal). Usado en admin y ranking. */
export function formationOverrideKey(side, shirtNumber, name) {
  const sideNorm = side === 'away' ? 'away' : 'home';
  const num = shirtNumber != null && shirtNumber !== '' ? String(shirtNumber) : null;
  const id = num ?? String(name ?? '').trim();
  if (!id) return null;
  return `${sideNorm}:${id}`;
}

export function applyFormationGridOverridesToLineupPlayers(lineup, players = {}) {
  if (!lineup || !players || !Object.keys(players).length) return lineup;

  const patchSide = (sideKey) => {
    const side = lineup[sideKey];
    if (!side?.players?.length) return side;
    return {
      ...side,
      players: side.players.map((player) => {
        const key = formationOverrideKey(sideKey, player.shirtNumber, player.name);
        const override = key ? players[key] : null;
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
