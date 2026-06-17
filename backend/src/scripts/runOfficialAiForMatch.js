/**
 * Ejecuta predicción IA oficial para un partido (admin/on-demand).
 * Uso: node src/scripts/runOfficialAiForMatch.js <externalId|matchObjectId>
 */
import { connectDb } from '../config/db.js';
import { Match } from '../models/Match.js';
import { runOfficialAiCompetitorPrediction } from '../services/aiPredictionService.js';
import mongoose from 'mongoose';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: node src/scripts/runOfficialAiForMatch.js <externalId|matchObjectId>');
    process.exit(1);
  }

  await connectDb();

  const match = mongoose.Types.ObjectId.isValid(arg)
    ? await Match.findById(arg).lean()
    : await Match.findOne({ externalId: String(arg) }).lean();

  if (!match) {
    console.error(`Partido no encontrado: ${arg}`);
    process.exit(1);
  }

  console.log(`Ejecutando IA oficial: match ${match.externalId} (${match.homeTeamId} vs ${match.awayTeamId})`);
  const result = await runOfficialAiCompetitorPrediction(match._id);
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
