#!/usr/bin/env node
/**
 * Deploy a producción Heroku solo con confirmación explícita.
 *
 * No hace `git push heroku main` directo: arma un commit desde origin/main
 * sin imagenes-jugadores/ (Heroku rechaza checkouts >1 GB). En prod las
 * caricaturas se sirven desde GitHub; Mongo solo guarda photoKey.
 *
 * Uso:
 *   CONFIRM_PRODUCTION=1 npm run deploy:production
 */
import { execSync, spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const PROD_APP = 'mundial2026-pred';
const PROD_URL = 'https://mundial2026-pred-34de76763ecc.herokuapp.com/';
const IMAGES_DIR = 'imagenes-jugadores';
const DEPLOY_BRANCH = 'heroku-deploy-tmp';

function git(...args) {
  return spawnSync('git', args, { stdio: 'inherit' });
}

function gitCapture(...args) {
  return execSync(['git', ...args].join(' '), { encoding: 'utf8' }).trim();
}

function cleanup(originalBranch) {
  spawnSync('git', ['merge', '--abort'], { stdio: 'ignore' });
  spawnSync('git', ['checkout', originalBranch], { stdio: 'inherit' });
  spawnSync('git', ['branch', '-D', DEPLOY_BRANCH], { stdio: 'ignore' });
}

async function main() {
  console.log('\n⚠️  Deploy a PRODUCCIÓN');
  console.log(`   App:  ${PROD_APP}`);
  console.log(`   URL:  ${PROD_URL}`);
  console.log('\n   Requisitos previos:');
  console.log('   - Probado en local con npm run dev:local-qa');
  console.log('   - GET /api/health en local → databaseName: mundial2026_local');
  console.log('   - Usuario confirmó en el chat');
  console.log(`   - El commit desplegado excluye ${IMAGES_DIR}/ (ver docs/DEPLOYMENT.md)\n`);

  if (process.env.CONFIRM_PRODUCTION !== '1') {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question('Escribí "production" para continuar: ');
    await rl.close();
    if (answer.trim().toLowerCase() !== 'production') {
      console.error('Deploy cancelado.');
      process.exit(1);
    }
  }

  const originalBranch = gitCapture('rev-parse', '--abbrev-ref', 'HEAD');
  const porcelain = gitCapture('status', '--porcelain');
  if (porcelain) {
    console.error('\nHay cambios sin commitear. Commiteá o hacé stash antes del deploy.\n');
    process.exit(1);
  }

  console.log('→ git fetch heroku origin');
  if (git('fetch', 'heroku', 'origin').status !== 0) {
    process.exit(1);
  }

  const mainSubject = gitCapture('log', '-1', '--format=%s', 'origin/main');

  console.log(`→ Preparando rama ${DEPLOY_BRANCH} desde heroku/main…`);
  if (git('checkout', '-B', DEPLOY_BRANCH, 'heroku/main').status !== 0) {
    process.exit(1);
  }

  console.log('→ Merge origin/main (el commit final no incluye caricaturas)…');
  const merge = spawnSync('git', ['merge', 'origin/main', '--no-commit', '--no-ff'], {
    stdio: 'inherit',
  });
  if (merge.status !== 0) {
    console.error('\nMerge falló. Revisá divergencia entre origin/main y heroku/main.\n');
    cleanup(originalBranch);
    process.exit(1);
  }

  console.log(`→ Quitando ${IMAGES_DIR}/ del árbol de deploy…`);
  git('rm', '-rf', '--cached', '--ignore-unmatch', IMAGES_DIR);
  spawnSync('rm', ['-rf', IMAGES_DIR]);

  const commit = spawnSync('git', ['commit', '-m', `deploy: ${mainSubject}`], { stdio: 'inherit' });
  if (commit.status !== 0) {
    console.log('\nSin cambios de código respecto a heroku/main; nada que desplegar.\n');
    cleanup(originalBranch);
    process.exit(0);
  }

  console.log('→ git push heroku …:main');
  const push = git('push', 'heroku', `${DEPLOY_BRANCH}:main`);

  cleanup(originalBranch);

  if (push.status !== 0) {
    process.exit(push.status ?? 1);
  }

  console.log(`\nDeploy enviado (checkout sin ${IMAGES_DIR}/).`);
  console.log(`Verificar: curl ${PROD_URL}api/health\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
