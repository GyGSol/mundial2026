#!/usr/bin/env node
/**
 * Descarga planteles oficiales desde Wikipedia y genera:
 * - backend/src/data/wikipediaSquads.json
 * - imagenes-jugadores/generador/{equipo}.txt (para el generador de imágenes)
 */
import { readFile } from 'fs/promises';
import {
  loadWikipediaSquadsFromApi,
  writeWikipediaSquadsArtifacts,
} from '../services/wikipediaSquadsService.js';

const inputPath = process.argv[2] || '';

async function loadSquads() {
  if (inputPath) {
    const { parseWikipediaSquadsWikitext } = await import('../utils/wikipediaSquadsParser.js');
    const wikitext = await readFile(inputPath, 'utf8');
    return parseWikipediaSquadsWikitext(wikitext, { sourceUrl: inputPath });
  }
  return loadWikipediaSquadsFromApi();
}

async function main() {
  const squads = await loadSquads();
  const paths = await writeWikipediaSquadsArtifacts(squads);

  console.log(
    JSON.stringify(
      {
        teams: squads.teamCount,
        players: squads.playerCount,
        json: paths.jsonPath,
        txtDir: paths.txtDir,
        txtFiles: paths.txtCount,
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
