#!/usr/bin/env node
/**
 * Deploy a producción Heroku solo con confirmación explícita.
 *
 * Uso:
 *   CONFIRM_PRODUCTION=1 npm run deploy:production
 */
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const PROD_APP = 'mundial2026-pred';
const PROD_URL = 'https://mundial2026-pred-34de76763ecc.herokuapp.com/';

async function main() {
  console.log('\n⚠️  Deploy a PRODUCCIÓN');
  console.log(`   App:  ${PROD_APP}`);
  console.log(`   URL:  ${PROD_URL}`);
  console.log('\n   Requisitos previos:');
  console.log('   - Probado en local con npm run dev:local-qa');
  console.log('   - GET /api/health en local → databaseName: mundial2026_local');
  console.log('   - Usuario confirmó en el chat\n');

  if (process.env.CONFIRM_PRODUCTION !== '1') {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question('Escribí "production" para continuar: ');
    await rl.close();
    if (answer.trim().toLowerCase() !== 'production') {
      console.error('Deploy cancelado.');
      process.exit(1);
    }
  }

  const push = spawnSync('git', ['push', 'heroku', 'main'], { stdio: 'inherit' });
  if (push.status !== 0) {
    process.exit(push.status ?? 1);
  }

  console.log(`\nDeploy enviado. Verificar: curl ${PROD_URL}api/health`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
