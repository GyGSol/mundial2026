#!/usr/bin/env node
/**
 * Comprime caricaturas de jugadores/DT para subir a GitHub (menor peso).
 * Usa sharp (frontend). Mantiene PNG y nombres de archivo.
 *
 * Uso:
 *   npm run photos:compress -- austria
 *   npm run photos:compress -- austria --width 512 --quality 75
 *   npm run photos:compress -- austria --dry-run
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = join(process.cwd(), 'imagenes-jugadores');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keepOriginal = !args.includes('--no-keep-original');

function readArg(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

const folder = args.find((arg) => !arg.startsWith('--')) ?? '';
const maxWidth = Number(readArg('--width', '512'));
const quality = Number(readArg('--quality', '75'));

if (!folder) {
  console.error('Indicá la carpeta, ej: npm run photos:compress -- austria');
  process.exit(1);
}

if (!Number.isFinite(maxWidth) || maxWidth < 64) {
  console.error('--width inválido');
  process.exit(1);
}

const inputDir = join(ROOT, folder);
if (!existsSync(inputDir)) {
  console.error(`No existe: ${inputDir}`);
  process.exit(1);
}

const originalsDir = join(ROOT, '.originals', folder);

async function compressOne(filename) {
  const inputPath = join(inputDir, filename);
  const before = await stat(inputPath);

  if (dryRun) {
    const buf = await sharp(inputPath)
      .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
      .png({ quality, compressionLevel: 9, palette: true, effort: 10 })
      .toBuffer();
    return { filename, beforeBytes: before.size, afterBytes: buf.length, saved: true };
  }

  if (keepOriginal) {
    await mkdir(originalsDir, { recursive: true });
    const originalPath = join(originalsDir, filename);
    if (!existsSync(originalPath)) {
      await copyFile(inputPath, originalPath);
    }
  }

  const output = await sharp(inputPath)
    .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
    .png({ quality, compressionLevel: 9, palette: true, effort: 10 })
    .toBuffer();

  await writeFile(inputPath, output);

  return {
    filename,
    beforeBytes: before.size,
    afterBytes: output.length,
    saved: true,
  };
}

const files = (await readdir(inputDir))
  .filter((name) => name.endsWith('.png'))
  .sort();

if (!files.length) {
  console.error(`Sin PNG en ${inputDir}`);
  process.exit(1);
}

const results = [];
for (const filename of files) {
  results.push(await compressOne(filename));
}

const totalBefore = results.reduce((sum, row) => sum + row.beforeBytes, 0);
const totalAfter = results.reduce((sum, row) => sum + row.afterBytes, 0);

console.log(
  JSON.stringify(
    {
      folder,
      dryRun,
      maxWidth,
      quality,
      files: results.length,
      totalBeforeMb: Number((totalBefore / 1024 / 1024).toFixed(2)),
      totalAfterMb: Number((totalAfter / 1024 / 1024).toFixed(2)),
      reductionPct: Number((100 - (totalAfter / totalBefore) * 100).toFixed(1)),
      originalsDir: keepOriginal && !dryRun ? resolve(originalsDir) : null,
      samples: results.slice(0, 3),
    },
    null,
    2
  )
);
