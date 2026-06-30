/**
 * Recalcula puntos de todos los partidos finalizados (p. ej. tras corregir marcador KO).
 * Uso prod: heroku run "npm run rescore:finished -w backend" -a mundial2026-pred
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { recalculateAllFinishedMatches } from '../services/matchScoringService.js';

dotenv.config();

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI requerido');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await recalculateAllFinishedMatches();
  console.log('Rescore finished matches:', result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
