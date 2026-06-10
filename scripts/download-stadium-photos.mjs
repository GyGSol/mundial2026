#!/usr/bin/env node
/**
 * Descarga miniaturas (~200–250px) de estadios desde Wikipedia/Commons.
 * Uso: node scripts/download-stadium-photos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../frontend/public/stadiums');
const THUMB_WIDTH = 220;
const USER_AGENT = 'Mundial2026-Pred/1.0 (https://mundial2026-pred.herokuapp.com)';

/** slug → artículo en en.wikipedia (imagen destacada del infobox) */
const WIKI_PAGES = {
  azteca: 'Estadio_Azteca',
  akron: 'Estadio_Akron',
  bbva: 'Estadio_BBVA',
  att: 'AT%26T_Stadium',
  nrg: 'NRG_Stadium',
  arrowhead: 'Arrowhead_Stadium',
  'mercedes-benz': 'Mercedes-Benz_Stadium',
  'hard-rock': 'Hard_Rock_Stadium',
  gillette: 'Gillette_Stadium',
  'lincoln-financial': 'Lincoln_Financial_Field',
  metlife: 'MetLife_Stadium',
  bmo: 'BMO_Field',
  'bc-place': 'BC_Place',
  lumen: 'Lumen_Field',
  levis: 'Levi%27s_Stadium',
  sofi: 'SoFi_Stadium',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWikiThumb(wikiTitle) {
  const params = new URLSearchParams({
    action: 'query',
    titles: wikiTitle,
    prop: 'pageimages',
    piprop: 'thumbnail|name',
    pithumbsize: String(THUMB_WIDTH),
    format: 'json',
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  const data = await res.json();
  const page = Object.values(data?.query?.pages ?? {})[0];
  if (!page?.thumbnail?.source) throw new Error('sin miniatura');
  return {
    url: page.thumbnail.source,
    fileName: page.pageimage || page.title,
  };
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4000) throw new Error(`archivo muy chico (${buf.length} bytes)`);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function buildAttribution(results) {
  const lines = [
    '# Fotos de estadios — Wikimedia Commons',
    '',
    'Miniaturas (~220px) para **Predicciones → Partidos**. Cada imagen es la foto destacada del artículo de Wikipedia del estadio; el archivo original está en [Wikimedia Commons](https://commons.wikimedia.org/) con su licencia (CC BY-SA, GFDL, dominio público, etc.).',
    '',
    '| Sede | Artículo Wikipedia | Archivo Commons |',
    '|------|-------------------|-----------------|',
  ];
  for (const { slug, wiki, fileName, ok } of results) {
    const wikiLink = `https://en.wikipedia.org/wiki/${wiki}`;
    const commonsLink = fileName
      ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.replace(/ /g, '_'))}`
      : '—';
    lines.push(
      `| ${slug} | [${wiki.replace(/_/g, ' ')}](${wikiLink}) | ${fileName ? `[${fileName}](${commonsLink})` : '—'}${ok ? '' : ' _(falló)_'} |`
    );
  }
  lines.push('', 'Regenerar: `node scripts/download-stadium-photos.mjs`');
  return lines.join('\n');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];

  for (const [slug, wikiTitle] of Object.entries(WIKI_PAGES)) {
    const dest = path.join(OUT_DIR, `${slug}.jpg`);
    try {
      await sleep(2500);
      const { url, fileName } = await fetchWikiThumb(wikiTitle);
      await sleep(1500);
      const bytes = await download(url, dest);
      console.log(`✓ ${slug}.jpg (${bytes} bytes)`);
      results.push({ slug, wiki: wikiTitle, fileName, ok: true });
    } catch (err) {
      console.error(`✗ ${slug}: ${err.message}`);
      results.push({ slug, wiki: wikiTitle, fileName: null, ok: false });
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'ATTRIBUTION.md'), buildAttribution(results));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exitCode = 1;
}

main();
