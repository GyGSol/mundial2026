#!/usr/bin/env node
/**
 * Comprime caricaturas de jugadores/DT para subir a GitHub (menor peso).
 * Usa sharp. Mantiene PNG y nombres de archivo.
 *
 * Documentación: docs/PLAYER_PHOTOS.md
 *
 * Uso:
 *   npm run photos:compress -- austria
 *   npm run photos:compress -- --all-published
 *   npm run photos:compress -- austria --width 512 --quality 75
 *   npm run photos:compress -- --all-published --dry-run
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = join(process.cwd(), 'imagenes-jugadores');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keepOriginal = !args.includes('--no-keep-original');
const allPublished = args.includes('--all-published');

function readArg(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

const folderArg = args.find((arg) => !arg.startsWith('--')) ?? '';
const maxWidth = Number(readArg('--width', '512'));
const quality = Number(readArg('--quality', '75'));

if (!Number.isFinite(maxWidth) || maxWidth < 64) {
  console.error('--width inválido');
  process.exit(1);
}

function listPublishedFolders() {
  try {
    execSync('git fetch origin main', { stdio: 'ignore' });
  } catch {
    console.warn('No se pudo hacer fetch de origin/main; se usa el ref local.');
  }

  const raw = execSync('git ls-tree -r origin/main --name-only imagenes-jugadores/', {
    encoding: 'utf8',
  });

  const folders = new Set();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.endsWith('.png')) continue;
    const rel = trimmed.replace(/^imagenes-jugadores\//, '');
    const folder = rel.split('/')[0];
    if (folder && folder !== 'generador') folders.add(folder);
  }
  return [...folders].sort();
}

async function compressFolder(folder) {
  const inputDir = join(ROOT, folder);
  if (!existsSync(inputDir)) {
    return { folder, skipped: true, reason: 'missing-dir', files: 0 };
  }

  const originalsDir = join(ROOT, '.originals', folder);
  const files = (await readdir(inputDir)).filter((name) => name.endsWith('.png')).sort();

  if (!files.length) {
    return { folder, skipped: true, reason: 'no-png', files: 0 };
  }

  const results = [];
  for (const filename of files) {
    const inputPath = join(inputDir, filename);
    const before = await stat(inputPath);

    if (dryRun) {
      const buf = await sharp(inputPath)
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .png({ quality, compressionLevel: 9, palette: true, effort: 10 })
        .toBuffer();
      results.push({ filename, beforeBytes: before.size, afterBytes: buf.length });
      continue;
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
    results.push({ filename, beforeBytes: before.size, afterBytes: output.length });
  }

  const totalBefore = results.reduce((sum, row) => sum + row.beforeBytes, 0);
  const totalAfter = results.reduce((sum, row) => sum + row.afterBytes, 0);

  return {
    folder,
    skipped: false,
    files: results.length,
    totalBeforeMb: Number((totalBefore / 1024 / 1024).toFixed(2)),
    totalAfterMb: Number((totalAfter / 1024 / 1024).toFixed(2)),
    reductionPct:
      totalBefore > 0
        ? Number((100 - (totalAfter / totalBefore) * 100).toFixed(1))
        : 0,
    originalsDir: keepOriginal && !dryRun ? resolve(originalsDir) : null,
  };
}

async function main() {
  if (!allPublished && !folderArg) {
    console.error('Indicá carpeta o --all-published, ej: npm run photos:compress -- austria');
    process.exit(1);
  }

  const folders = allPublished ? listPublishedFolders() : [folderArg];
  const summaries = [];

  for (const folder of folders) {
    summaries.push(await compressFolder(folder));
  }

  const processed = summaries.filter((row) => !row.skipped);
  const totalBeforeMb = processed.reduce((sum, row) => sum + (row.totalBeforeMb ?? 0), 0);
  const totalAfterMb = processed.reduce((sum, row) => sum + (row.totalAfterMb ?? 0), 0);
  const totalFiles = processed.reduce((sum, row) => sum + (row.files ?? 0), 0);

  console.log(
    JSON.stringify(
      {
        mode: allPublished ? 'all-published' : 'single',
        dryRun,
        maxWidth,
        quality,
        folders: folders.length,
        processedFolders: processed.length,
        files: totalFiles,
        totalBeforeMb: Number(totalBeforeMb.toFixed(2)),
        totalAfterMb: Number(totalAfterMb.toFixed(2)),
        reductionPct:
          totalBeforeMb > 0
            ? Number((100 - (totalAfterMb / totalBeforeMb) * 100).toFixed(1))
            : 0,
        perFolder: summaries,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
