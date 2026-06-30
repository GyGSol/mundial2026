/** Recalcula puntos de partidos finalizados por externalId. */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { recalculateMatchScores } from '../services/matchScoringService.js';

dotenv.config();

const ids = process.argv.slice(2).map((id) => String(id).trim()).filter(Boolean);

async function main() {
  if (!ids.length) {
    console.error('Uso: node rescoreMatchesByExternalId.js 74 75');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  for (const externalId of ids) {
    const match = await Match.findOne({ externalId }).select('_id externalId');
    if (!match) {
      console.warn(`Partido ${externalId} no encontrado`);
      continue;
    }
    const result = await recalculateMatchScores(match._id);
    console.log(`Partido ${externalId}:`, result);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
