#!/usr/bin/env node
/**
 * Genera backend/src/data/playerPhotoManifest.json con las photoKeys
 * presentes en origin/main (GitHub raw). Heroku usa esto para no devolver
 * URLs de PNG que aún no existen en el remoto.
 *
 * Uso: npm run photos:build-manifest
 */
import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'backend/src/data/playerPhotoManifest.json');

try {
  execSync('git fetch origin main', { stdio: 'ignore' });
} catch {
  console.warn('No se pudo hacer fetch de origin/main; se usa el ref local.');
}

const raw = execSync('git ls-tree -r origin/main --name-only imagenes-jugadores/', {
  encoding: 'utf8',
});

const keys = raw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.endsWith('.png'))
  .map((line) => line.replace(/^imagenes-jugadores\//, ''))
  .sort();

await writeFile(OUT, `${JSON.stringify(keys, null, 2)}\n`);

console.log(JSON.stringify({ output: OUT, count: keys.length }, null, 2));
