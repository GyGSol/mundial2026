#!/usr/bin/env node
/**
 * Exporta TrainingBuffer no exportado a training/data/buffer/*.jsonl
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, disconnectDb } from '../config/db.js';
import {
  listUnexportedTrainingBuffer,
  markTrainingBufferExported,
} from '../services/trainingBufferService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../../training/data/buffer');

function buildPromptFromContext(ctx, predicted, actual) {
  const home = ctx?.match?.homeTeamId ?? ctx?.homeTeam?.code ?? '?';
  const away = ctx?.match?.awayTeamId ?? ctx?.awayTeam?.code ?? '?';
  const group = ctx?.match?.group ?? ctx?.group ?? '';
  return (
    `Mundial 2026${group ? ` grupo ${group}` : ''}\n` +
    `Local: ${home}\nVisitante: ${away}\n` +
    `Predicción previa Oracle: ${predicted.home}-${predicted.away}\n` +
    `Resultado real: ${actual.home}-${actual.away}\n` +
    `Corrige el patrón para minimizar MSE en futuros partidos similares.`
  );
}

async function main() {
  await connectDb();
  const rows = await listUnexportedTrainingBuffer({ limit: 2000 });
  if (!rows.length) {
    console.log('TrainingBuffer: nada para exportar');
    await disconnectDb();
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bucket = rows[0]?.weekBucket ?? 'export';
  const outPath = path.join(OUT_DIR, `buffer-${bucket}.jsonl`);

  const lines = rows.map((row) =>
    JSON.stringify({
      prompt: buildPromptFromContext(
        row.promptContext,
        row.predictedScore,
        row.actualScore
      ),
      completion: `${row.actualScore.home}-${row.actualScore.away}`,
      mseError: row.mseError,
      metadata: {
        source: 'trainingBuffer',
        tournament: 2026,
        phase: 'mundial2026',
        mse_error: row.mseError,
        matchId: String(row.matchId),
        goal_timings: (row.microEvents ?? [])
          .filter((e) => e.type === 'goal')
          .map((e) => ({ minute: e.minute, player: e.playerName })),
      },
    })
  );

  fs.appendFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
  const { updated } = await markTrainingBufferExported(rows.map((r) => r._id));
  console.log(`Exported ${updated} rows → ${outPath}`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
