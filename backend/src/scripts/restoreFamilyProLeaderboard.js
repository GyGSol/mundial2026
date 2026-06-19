/**
 * Restaura predicciones y ranking de FamilyPro tras wipe de producción.
 *
 * Fuentes:
 * - Humanos + IA: capturas del ranking (23 PJ, jun 2026) → predicciones sintéticas agregadas
 *
 * Uso:
 *   DRY_RUN=1 node src/scripts/restoreFamilyProLeaderboard.js
 *   CONFIRM=1 node src/scripts/restoreFamilyProLeaderboard.js
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import {
  aggregateFromBreakdowns,
  buildRecoveredPredictionDocs,
  buildSnapshotBreakdowns,
  distributeGoalDiffs,
} from './leaderboardSnapshotSynth.js';
import { getLeaderboard, recalculateUserTotalPoints } from '../services/leaderboardService.js';
import { goalDiffScore } from '../services/goalDiffStats.js';

const FAMILY_GROUP_ID = '6a1d9d3aec2a89a22a36a279';
const SNAPSHOT_PJ = 23;

const dryRun = process.env.DRY_RUN === '1';
const confirm = process.env.CONFIRM === '1';

/** Stats desde capturas image-1c9d63f7 / image-f6b5d04d (23 PJ). */
const PLAYER_SNAPSHOTS = [
  { userId: '6a1db76595430167a4afc241', name: 'Gisela', pa: 13, gl: 5, gv: 12, gdif: 0.197, gt: 4, pb: 0, pts: 60 },
  { userId: '6a1d9cdeec2a89a22a36a033', name: 'Gonzalo', pa: 13, gl: 5, gv: 6, gdif: 0.265, gt: 2, pb: 0, pts: 52 },
  { userId: '6a21f9a7d64dde09c5ce49a0', name: 'Raguccito', pa: 11, gl: 5, gv: 8, gdif: 0.264, gt: 3, pb: 0, pts: 49 },
  { userId: '6a1deea195430167a4b09047', name: 'Marcelo', pa: 8, gl: 11, gv: 7, gdif: 0.306, gt: 5, pb: 0, pts: 47 },
  { userId: '6a231b5474b3c1c88ed7c398', name: 'Tixe', pa: 9, gl: 7, gv: 9, gdif: 0.264, gt: 3, pb: 0, pts: 46 },
  { userId: '6a1d9ff0ec2a89a22a36b121', name: 'Yago', pa: 9, gl: 5, gv: 9, gdif: 0.359, gt: 4, pb: 0, pts: 45 },
  { userId: '6a205b4e82c32257e3fa6429', name: 'Ramdow Player', pa: 8, gl: 4, gv: 9, gdif: 0.38, gt: 3, pb: 0, pts: 40 },
  { userId: '6a24628774b3c1c88edc6c63', name: 'Jorge', pa: 9, gl: 2, gv: 8, gdif: 0.359, gt: 1, pb: 0, pts: 38 },
  { userId: '6a29fe7df669726d8cdbea37', name: 'Guido', pa: 6, gl: 3, gv: 7, gdif: 0.466, gt: 1, pb: 1, pts: 30 },
  { userId: '6a1f3bdbd66246b92f066559', name: 'Martin', pa: 6, gl: 3, gv: 7, gdif: 0.466, gt: 1, pb: 1, pts: 30 },
  // Tisho no aparece en top-10 de capturas; estimado conservador (#11-12)
  { userId: '6a1f9d665cffc04b2a1e8511', name: 'Tisho', pa: 6, gl: 2, gv: 6, gdif: 0.49, gt: 2, pb: 0, pts: 28, estimated: true },
  { userId: '6a2b833a3993730b6b456e3e', name: '@predictivemodeling', pa: 11, gl: 5, gv: 6, gdif: 0.298, gt: 5, pb: 0, pts: 49 },
];

function verifySnapshot(snapshot) {
  const breakdowns = buildSnapshotBreakdowns({ pj: SNAPSHOT_PJ, ...snapshot });
  const goalDiffs = distributeGoalDiffs(breakdowns, snapshot.gdif);
  const agg = aggregateFromBreakdowns(breakdowns, goalDiffs);
  const gdif = goalDiffScore(agg.difGl, agg.difGv, SNAPSHOT_PJ);
  const issues = [];
  if (agg.totalPoints !== snapshot.pts) issues.push(`pts ${agg.totalPoints}≠${snapshot.pts}`);
  if (agg.pa !== snapshot.pa) issues.push(`pa ${agg.pa}≠${snapshot.pa}`);
  if (agg.gl !== snapshot.gl) issues.push(`gl ${agg.gl}≠${snapshot.gl}`);
  if (agg.gv !== snapshot.gv) issues.push(`gv ${agg.gv}≠${snapshot.gv}`);
  if (agg.gt !== snapshot.gt) issues.push(`gt ${agg.gt}≠${snapshot.gt}`);
  if (agg.pb !== snapshot.pb) issues.push(`pb ${agg.pb}≠${snapshot.pb}`);
  return { ok: issues.length === 0, issues, gdif };
}

async function getSnapshotMatchIds() {
  const matches = await Match.find({
    status: 'finished',
    externalId: { $nin: ['finished-only'] },
    homeScore: { $ne: null },
  })
    .sort({ kickoffAt: 1 })
    .select('_id externalId kickoffAt')
    .lean();

  if (matches.length < SNAPSHOT_PJ) {
    throw new Error(`Need ${SNAPSHOT_PJ} finished matches, found ${matches.length}`);
  }
  return matches.slice(0, SNAPSHOT_PJ).map((m) => m._id);
}

async function main() {
  if (!dryRun && !confirm) {
    console.error('Set DRY_RUN=1 to preview or CONFIRM=1 to apply.');
    process.exit(1);
  }

  await connectDb();
  console.log(`Mode: ${dryRun ? 'DRY_RUN' : 'CONFIRM'}`);
  console.log(`Snapshot PJ: ${SNAPSHOT_PJ}\n`);

  console.log('Verifying snapshot synthesis:');
  for (const snap of PLAYER_SNAPSHOTS) {
    const check = verifySnapshot(snap);
    const flag = snap.estimated ? ' (estimado)' : '';
    console.log(
      ` - ${snap.name}${flag}: ${check.ok ? 'OK' : 'WARN ' + check.issues.join(', ')}`
    );
  }
  console.log('');

  const matchIds = await getSnapshotMatchIds();
  console.log(`Using ${matchIds.length} matches for snapshot\n`);

  const familyUserIds = PLAYER_SNAPSHOTS.map((s) => new mongoose.Types.ObjectId(s.userId));

  const existing = await Prediction.countDocuments({ userId: { $in: familyUserIds } });
  if (existing > 0) {
    console.log(`Clearing ${existing} existing FamilyPro predictions...`);
    if (!dryRun && confirm) {
      await Prediction.deleteMany({ userId: { $in: familyUserIds } });
    }
  }

  const allDocs = [];
  for (const snap of PLAYER_SNAPSHOTS) {
    const docs = buildRecoveredPredictionDocs(
      new mongoose.Types.ObjectId(snap.userId),
      matchIds,
      { pj: SNAPSHOT_PJ, pa: snap.pa, gl: snap.gl, gv: snap.gv, gt: snap.gt, pb: snap.pb, pts: snap.pts, gdif: snap.gdif }
    );
    allDocs.push(...docs);
    console.log(`${snap.name}: ${docs.length} predictions, pts=${snap.pts}`);
  }

  console.log(`\nTotal to insert: ${allDocs.length}`);

  if (!dryRun && confirm) {
    await Prediction.insertMany(allDocs, { ordered: false });

    for (const uid of familyUserIds) {
      await recalculateUserTotalPoints(uid);
    }
  }

  if (!dryRun && confirm) {
    const board = await getLeaderboard(FAMILY_GROUP_ID);
    console.log('\n=== Leaderboard restaurado ===');
    for (const row of board) {
      const gdif = goalDiffScore(row.difGl, row.difGv, row.pj).toFixed(3);
      console.log(
        `${row.rank}. ${row.name} PJ=${row.pj} PA=${row.pa} GL=${row.gl} GV=${row.gv} Gdif=${gdif} GT=${row.gt} PB=${row.pb} Pts=${row.totalPoints}`
      );
    }
  }

  console.log('\n⚠️  Predicciones humanas son agregados desde capturas (no marcadores reales).');
  console.log('    Tisho usa stats estimados — actualizar si tenés captura con su fila.');
  console.log('    Partidos posteriores al snapshot (PJ>23) quedan sin predicción hasta que carguen.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
