import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Prediction } from '../models/Prediction.js';
import {
  loadAiCalibrationStats,
  compareAiVsHumansOnMatch,
} from '../services/aiPredictionCalibrationService.js';
import { goalDiffScore } from '../services/goalDiffStats.js';

async function main() {
  if (!env.mongodbUri) {
    console.error('MONGODB_URI requerido');
    process.exit(1);
  }

  await connectDb();

  const aiUser = await User.findOne({
    $or: [{ isAiUser: true }, { email: env.aiUserEmail }],
  })
    .select('_id email')
    .lean();

  if (!aiUser) {
    console.error('Usuario IA no encontrado. Ejecutá: npm run mark-ai-user');
    process.exit(1);
  }

  const stats = await loadAiCalibrationStats(aiUser._id, { windowSize: 30 });
  const preds = await Prediction.find({
    userId: aiUser._id,
    predictionSource: 'ai',
    pointsEarned: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .limit(30)
    .select('matchId homeGoals awayGoals pointsEarned goalDiffHome goalDiffAway aiCalibrationApplied')
    .lean();

  const totalPoints = preds.reduce((s, p) => s + (p.pointsEarned ?? 0), 0);
  const avgPoints = preds.length ? (totalPoints / preds.length).toFixed(2) : '0';
  const totalGd = preds.reduce(
    (s, p) => s + (p.goalDiffHome ?? 0) + (p.goalDiffAway ?? 0),
    0
  );
  const gdif = preds.length ? goalDiffScore(totalGd, 0, preds.length) : 0;
  const calibrated = preds.filter((p) => p.aiCalibrationApplied).length;

  console.log('=== Evaluación Predictive Modeling (IA) ===');
  console.log(`Usuario: ${aiUser.email}`);
  console.log(`Últimos partidos puntuados: ${preds.length}`);
  console.log(`Promedio pts/partido: ${avgPoints}`);
  console.log(`Gdif rolling (${stats.partidosAnalizados}): ${stats.errorCombinado ?? 'n/a'}`);
  console.log(`Sesgo local: ${stats.sesgoLocal ?? 'n/a'}`);
  console.log(`Sesgo visitante: ${stats.sesgoVisitante ?? 'n/a'}`);
  console.log(`Predicciones con calibración aplicada: ${calibrated}`);
  console.log(`Nota calibración: ${stats.nota}`);

  if (preds[0]?.matchId) {
    const vsHumans = await compareAiVsHumansOnMatch(preds[0].matchId, aiUser._id);
    if (vsHumans) {
      console.log('\nÚltimo partido vs humanos:');
      console.log(`  Gdif IA: ${vsHumans.aiGoalDiff}`);
      console.log(`  Gdif promedio humanos: ${vsHumans.humanAvgGoalDiff} (n=${vsHumans.humanCount})`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
