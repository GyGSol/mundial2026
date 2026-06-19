#!/usr/bin/env node
import { readFile } from 'fs/promises';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import {
  loadWikipediaSquadsFromApi,
  syncWikipediaSquadsToDatabase,
  writeWikipediaSquadsArtifacts,
  WIKIPEDIA_SQUADS_JSON,
} from '../services/wikipediaSquadsService.js';
import { parseWikipediaSquadsWikitext } from '../utils/wikipediaSquadsParser.js';

const inputPath = process.argv[2] || '';

async function loadSquads() {
  if (inputPath) {
    const wikitext = await readFile(inputPath, 'utf8');
    return parseWikipediaSquadsWikitext(wikitext, { sourceUrl: inputPath });
  }
  try {
    return JSON.parse(await readFile(WIKIPEDIA_SQUADS_JSON, 'utf8'));
  } catch {
    return loadWikipediaSquadsFromApi();
  }
}

async function main() {
  const squads = await loadSquads();
  await writeWikipediaSquadsArtifacts(squads);

  await connectDb();
  const result = await syncWikipediaSquadsToDatabase(squads);
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
