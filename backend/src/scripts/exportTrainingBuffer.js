#!/usr/bin/env node
/**
 * Exporta TrainingBuffer no exportado a training/data/buffer/*.jsonl
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, disconnectDb } from '../config/db.js';
import { exportTrainingBufferRecords } from '../services/trainingBufferService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../../training/data/buffer');

async function main() {
  await connectDb();
  const result = await exportTrainingBufferRecords({ writeFile: true, outDir: OUT_DIR });
  if (!result.exported) {
    console.log('TrainingBuffer: nada para exportar');
    await disconnectDb();
    return;
  }

  console.log(`Exported ${result.exported} rows → ${path.join(OUT_DIR, result.filename)}`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
