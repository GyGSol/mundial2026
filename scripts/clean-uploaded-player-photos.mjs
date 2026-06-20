#!/usr/bin/env node
/**
 * Borra PNG locales ya presentes en origin/main (staging post-upload).
 * Las imágenes siguen en GitHub para producción (GitHub raw).
 * NO hacer `git add -A` en imagenes-jugadores/ tras esto — restauraría borrados al remoto.
 *
 * Uso: npm run photos:clean-local
 *      npm run photos:clean-local -- --dry-run
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'imagenes-jugadores');
const dryRun = process.argv.includes('--dry-run');

function remoteHas(relPath) {
  try {
    execSync(`git cat-file -e "origin/main:${relPath}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

try {
  execSync('git fetch origin main', { stdio: 'ignore' });
} catch {
  console.warn('No se pudo hacer fetch de origin/main; se usa el ref local.');
}

let deleted = 0;
let kept = 0;
let skippedRemote = 0;

const entries = await readdir(ROOT, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name === 'generador') continue;

  const dir = join(ROOT, entry.name);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.png'));

  for (const filename of files) {
    const rel = `imagenes-jugadores/${entry.name}/${filename}`;
    if (!remoteHas(rel)) {
      console.log(`SKIP (no en origin/main): ${rel}`);
      skippedRemote += 1;
      continue;
    }

    const path = join(dir, filename);
    if (dryRun) {
      console.log(`DRY-RUN delete: ${rel}`);
    } else {
      await unlink(path);
    }
    deleted += 1;
  }

  const gitkeep = join(dir, '.gitkeep');
  if (!dryRun && !existsSync(gitkeep)) {
    await writeFile(gitkeep, '');
  }
  kept += 1;
}

console.log(
  JSON.stringify(
    {
      dryRun,
      folders: kept,
      deletedLocalPng: deleted,
      skippedNotOnRemote: skippedRemote,
    },
    null,
    2
  )
);
