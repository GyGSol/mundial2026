#!/usr/bin/env node
import { syncAllTeamKitsFromWiki, TEAM_KITS_JSON } from '../services/teamKitWikiService.js';

async function main() {
  console.log('Sincronizando indumentaria desde Wikipedia (en)...');
  const doc = await syncAllTeamKitsFromWiki();
  console.log(`Guardado en ${TEAM_KITS_JSON}`);
  console.log(JSON.stringify({
    fetchedAt: doc.fetchedAt,
    teamCount: doc.teamCount,
    kitCount: doc.kitCount,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
