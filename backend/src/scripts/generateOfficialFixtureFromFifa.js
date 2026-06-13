import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  extractStadiumName,
  extractTeamAbbreviation,
  fetchAllCalendarMatches,
  fifaDateToArtIso,
  resolveFifaEntryStadiumTimezone,
  validateFifaKickoffConsistency,
} from '../services/fifaApiClient.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../data/officialFixtureArgentina.js');

const SPOT_CHECKS = {
  '1': { art: '2026-06-11T16:00', dateUtc: '2026-06-11T19:00:00Z' },
  '5': { art: '2026-06-13T22:00', dateUtc: '2026-06-14T01:00:00Z', home: 'HAI', away: 'SCO' },
  '6': { art: '2026-06-14T01:00', dateUtc: '2026-06-14T04:00:00Z', home: 'AUS', away: 'TUR' },
  '7': { art: '2026-06-13T19:00', dateUtc: '2026-06-13T22:00:00Z', home: 'BRA', away: 'MAR' },
  '8': { art: '2026-06-13T16:00', dateUtc: '2026-06-13T19:00:00Z', home: 'QAT', away: 'SUI' },
};

function buildFixtureFile(kickoffs) {
  const lines = [
    '/**',
    ' * Horarios oficiales del Mundial 2026 en hora de Argentina (ART, UTC-3).',
    ' * Clave: externalId (= número FIFA del partido / worldcup26.ir).',
    ' * Valor: fecha/hora ART "YYYY-MM-DDTHH:mm", derivado de FIFA API `Date` (UTC real).',
    ' * Regenerar: node backend/src/scripts/generateOfficialFixtureFromFifa.js',
    ' */',
    'export const OFFICIAL_KICKOFFS_AR = {',
  ];

  for (const [id, iso] of Object.entries(kickoffs).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    lines.push(`  '${id}': '${iso}',`);
  }

  lines.push('};', '', "export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';", '');
  return lines.join('\n');
}

async function main() {
  const entries = await fetchAllCalendarMatches();
  const groupStage = entries.filter((entry) => Number(entry.MatchNumber) >= 1 && Number(entry.MatchNumber) <= 104);

  if (groupStage.length !== 104) {
    throw new Error(`Se esperaban 104 partidos FIFA, se obtuvieron ${groupStage.length}`);
  }

  const kickoffs = {};
  const consistencyFailures = [];

  for (const entry of groupStage) {
    const id = String(entry.MatchNumber);
    if (kickoffs[id]) {
      throw new Error(`MatchNumber duplicado: ${id}`);
    }

    const artIso = fifaDateToArtIso(entry.Date);
    if (!artIso) {
      throw new Error(`Match ${id}: no se pudo convertir Date=${entry.Date} a ART`);
    }

    const stadiumTimezone = resolveFifaEntryStadiumTimezone(entry);
    const check = validateFifaKickoffConsistency(entry, stadiumTimezone);
    if (!check.ok && !check.skipped) {
      consistencyFailures.push({
        matchNumber: id,
        stadium: extractStadiumName(entry),
        ...check,
      });
    }

    kickoffs[id] = artIso;
  }

  if (consistencyFailures.length) {
    console.error('Validación Date/LocalDate falló en:', consistencyFailures.slice(0, 5));
    throw new Error(`${consistencyFailures.length} partidos con inconsistencia FIFA Date vs LocalDate`);
  }

  for (const [id, expected] of Object.entries(SPOT_CHECKS)) {
    if (kickoffs[id] !== expected.art) {
      throw new Error(`Spot-check ${id}: ART esperado ${expected.art}, obtuvo ${kickoffs[id]}`);
    }
    const entry = groupStage.find((item) => String(item.MatchNumber) === id);
    if (!entry || entry.Date !== expected.dateUtc) {
      throw new Error(`Spot-check ${id}: Date UTC esperado ${expected.dateUtc}, obtuvo ${entry?.Date}`);
    }
    if (expected.home && extractTeamAbbreviation(entry.Home) !== expected.home) {
      throw new Error(`Spot-check ${id}: home esperado ${expected.home}`);
    }
    if (expected.away && extractTeamAbbreviation(entry.Away) !== expected.away) {
      throw new Error(`Spot-check ${id}: away esperado ${expected.away}`);
    }
  }

  fs.writeFileSync(OUTPUT_PATH, buildFixtureFile(kickoffs), 'utf8');
  console.log(`Fixture ART regenerado: ${OUTPUT_PATH} (${Object.keys(kickoffs).length} partidos)`);
  console.log('Muestra 5-8:', Object.fromEntries(['5', '6', '7', '8'].map((id) => [id, kickoffs[id]])));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
