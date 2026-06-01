const API_BASE = process.env.SIMULATION_API_URL || 'http://localhost:5000/api/simulation';
const LIVE_DELAY_MS = Number(process.env.SIMULATION_LIVE_DELAY_MS || 2500);
const BETWEEN_MATCHES_MS = Number(process.env.SIMULATION_BETWEEN_MS || 1200);
const MODE = process.env.SIMULATION_MODE || 'full';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function main() {
  const body =
    MODE === 'quick'
      ? { playerCount: 10, matchCount: 12, mode: 'quick' }
      : { playerCount: 10, matchCount: 12, mode: 'full' };

  console.log(`Creando simulación (${MODE})...`);
  let status = await request('/setup', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  console.log(`Grupo: ${status.group?.name}`);
  console.log(
    `Modo: ${status.mode} · Jugadores: ${status.playerCount} · Partidos planificados: ${status.totalPlannedMatches || status.matchCount}`
  );

  while (status.remainingCount > 0 && status.phase !== 'completed') {
    status = await request('/live', { method: 'POST' });
    const match = status.liveMatch;
    console.log(
      `\n▶ [${status.phase}${status.currentKnockoutRound ? ` / ${status.currentKnockoutRound}` : ''}] ${match?.homeTeam?.nameEn} vs ${match?.awayTeam?.nameEn}${match?.crossover ? ` (${match.crossover})` : ''}`
    );
    await sleep(LIVE_DELAY_MS);

    status = await request('/finish', { method: 'POST' });
    const finished = status.finishedMatches?.at(-1);
    console.log(
      `✓ Final: ${finished?.homeTeam?.nameEn} ${finished?.homeScore}-${finished?.awayScore} ${finished?.awayTeam?.nameEn}`
    );
    console.log(
      `  Total: ${status.finishedCount}/${status.totalPlannedMatches || status.matchCount} · Líder: ${status.leaderboard?.[0]?.name} (${status.leaderboard?.[0]?.totalPoints} pts)`
    );

    if (status.pendingCrossovers?.length) {
      console.log(`  Cruces generados: ${status.pendingCrossovers.length}`);
    }

    await sleep(BETWEEN_MATCHES_MS);
  }

  console.log('\nSimulación completa.');
  status.leaderboard?.forEach((row) => {
    console.log(`${row.rank}. ${row.name} — ${row.totalPoints} pts`);
  });
}

main().catch((err) => {
  console.error('Simulation failed:', err.message);
  console.error('¿Está corriendo el backend en localhost:5000?');
  process.exit(1);
});
