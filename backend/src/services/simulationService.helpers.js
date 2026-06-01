export function randomScore() {
  return Math.floor(Math.random() * 5);
}

export function buildPairings(teams, count) {
  if (teams.length < 2) {
    throw new Error('Se necesitan al menos 2 equipos para simular partidos');
  }

  const pairings = [];
  for (let i = 0; i < count; i += 1) {
    const home = teams[i % teams.length];
    let away = teams[(i + 1 + Math.floor(i / teams.length)) % teams.length];
    if (away.externalId === home.externalId) {
      away = teams[(i + 2) % teams.length];
    }
    pairings.push({ home, away });
  }
  return pairings;
}
