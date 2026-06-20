#!/usr/bin/env node
/**
 * Descarga el backup full-database.json.gz más reciente de GitHub y lo restaura
 * en MongoDB local (mundial2026_local). No toca Atlas/producción.
 *
 * Requiere en .env: BACKUP_GITHUB_TOKEN, BACKUP_GITHUB_REPO (default GyGSol/mundial2026-db-backups)
 *
 * Uso:
 *   npm run db:clone-from-prod
 *   npm run db:clone-from-prod:dry-run
 */
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { LOCAL_QA_URI } from '../backend/src/config/testDbGuard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

dotenv.config({ path: join(ROOT, '.env') });
if (!process.env.BACKUP_GITHUB_TOKEN && existsSync(join(ROOT, '.env.local-qa'))) {
  dotenv.config({ path: join(ROOT, '.env.local-qa'), override: true });
}
const BACKUP_DIR = join(ROOT, '.local', 'backups');
const DEFAULT_REPO = 'GyGSol/mundial2026-db-backups';
const dryRun = process.env.DRY_RUN === '1';

function parseRepo(repo) {
  const trimmed = String(repo || '').trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0) {
    throw new Error('BACKUP_GITHUB_REPO must be owner/repo');
  }
  return { owner: trimmed.slice(0, slash), repo: trimmed.slice(slash + 1) };
}

async function githubFetch(path, { token, accept = 'application/vnd.github+json' } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} ${path}: ${text.slice(0, 400)}`);
  }
  return res;
}

async function findLatestFullBackup({ owner, repo, token, branch }) {
  const treeRes = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { token }
  );
  const tree = await treeRes.json();
  const paths = (tree.tree || [])
    .filter((entry) => entry.type === 'blob' && entry.path.endsWith('full-database.json.gz'))
    .map((entry) => entry.path)
    .sort();

  if (!paths.length) {
    throw new Error(`No full-database.json.gz found in ${owner}/${repo}@${branch}`);
  }

  return paths[paths.length - 1];
}

async function downloadBackupFile({ owner, repo, token, branch, path, destPath }) {
  const metaRes = await githubFetch(
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    { token }
  );
  const meta = await metaRes.json();
  if (!meta.download_url) {
    throw new Error(`Missing download_url for ${path}`);
  }

  const fileRes = await fetch(meta.download_url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Download failed ${fileRes.status} for ${path}`);
  }

  await mkdir(dirname(destPath), { recursive: true });
  await pipeline(fileRes.body, createWriteStream(destPath));
}

async function main() {
  const token = process.env.BACKUP_GITHUB_TOKEN;
  const repoName = process.env.BACKUP_GITHUB_REPO || DEFAULT_REPO;
  const branch = process.env.BACKUP_GITHUB_BRANCH || 'main';

  if (!token) {
    console.error('BACKUP_GITHUB_TOKEN is required in .env (PAT con read en el repo de backups).');
    console.error('Alternativa manual: descargar full-database.json.gz y ejecutar:');
    console.error(
      `  MONGODB_URI="${LOCAL_QA_URI}" BACKUP_RESTORE_DROP=1 CONFIRM=1 npm run backup:restore -w backend -- --file=/ruta/full-database.json.gz`
    );
    process.exit(1);
  }

  const { owner, repo } = parseRepo(repoName);
  console.log(`Searching latest backup in ${owner}/${repo}@${branch}...`);

  const remotePath = await findLatestFullBackup({ owner, repo, token, branch });
  const localName = remotePath.replace(/\//g, '__');
  const localPath = join(BACKUP_DIR, localName);

  console.log(`Latest: ${remotePath}`);
  console.log(`Target DB: ${LOCAL_QA_URI}`);

  if (dryRun) {
    console.log(`DRY_RUN: would download to ${localPath} and restore with BACKUP_RESTORE_DROP=1`);
    return;
  }

  console.log(`Downloading → ${localPath}`);
  await downloadBackupFile({ owner, repo, token, branch, path: remotePath, destPath: localPath });

  const manifest = {
    clonedAt: new Date().toISOString(),
    remotePath,
    localPath,
    targetUri: LOCAL_QA_URI,
  };
  await writeFile(join(BACKUP_DIR, 'last-clone.json'), JSON.stringify(manifest, null, 2));

  console.log('Restoring to local MongoDB (BACKUP_RESTORE_DROP=1)...');
  const restore = spawnSync(
    'node',
    ['src/scripts/restoreDatabaseFromBackup.js', '--file', localPath],
    {
      cwd: join(ROOT, 'backend'),
      env: {
        ...process.env,
        MONGODB_URI: LOCAL_QA_URI,
        CONFIRM: '1',
        BACKUP_RESTORE_DROP: '1',
      },
      stdio: 'inherit',
    }
  );

  if (restore.status !== 0) {
    process.exit(restore.status ?? 1);
  }

  console.log('\nClone complete. Start QA with: npm run dev:local-qa');
  console.log(`Verify: curl http://localhost:5000/api/health  → databaseName: mundial2026_local`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
