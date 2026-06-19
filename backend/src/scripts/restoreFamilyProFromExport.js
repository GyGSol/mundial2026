/**
 * Restaura emails reales y predicciones humanas de FamilyPro desde export 15-jun-2026.
 * No modifica al jugador IA (@predictivemodeling).
 *
 * Uso:
 *   DRY_RUN=1 node src/scripts/restoreFamilyProFromExport.js
 *   CONFIRM=1 node src/scripts/restoreFamilyProFromExport.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { User } from '../models/User.js';
import { getLeaderboard, recalculateUserTotalPoints } from '../services/leaderboardService.js';
import { goalDiffScore } from '../services/goalDiffStats.js';
import { calculatePoints, calculateGoalDiff } from '../services/scoringService.js';
import { recalculateConsolationBonuses } from '../services/consolationBonusService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_PATH = path.join(
  __dirname,
  '../../data/exports/familypro-predictions-2026-06-15.json'
);

const FAMILY_GROUP_ID = '6a1d9d3aec2a89a22a36a279';
const AI_USER_ID = '6a2b833a3993730b6b456e3e';

const EMAIL_TO_USER_ID = {
  'giselaragucci@gmail.com': '6a1db76595430167a4afc241',
  'gonzalomlopolito@gmail.com': '6a1d9cdeec2a89a22a36a033',
  'gonzalomlopolitoadm@gmail.com': '6a205b4e82c32257e3fa6429',
  'ramiroragucci@hotmail.com': '6a21f9a7d64dde09c5ce49a0',
  'tomasgonzalez200648@gmail.com': '6a1deea195430167a4b09047',
  'tixeibz@gmail.com': '6a231b5474b3c1c88ed7c398',
  'yagolopolito@hotmail.com': '6a1d9ff0ec2a89a22a36b121',
  'guido.catelani@gmail.com': '6a29fe7df669726d8cdbea37',
  'jorgedudo@hotmail.com': '6a24628774b3c1c88edc6c63',
  'martindieste06@gmail.com': '6a1f3bdbd66246b92f066559',
  'schvarzmanpatricio@gmail.com': '6a1f9d665cffc04b2a1e8511',
};

const USER_ID_TO_EMAIL = Object.fromEntries(
  Object.entries(EMAIL_TO_USER_ID).map(([email, id]) => [id, email])
);

const HUMAN_USER_IDS = Object.values(EMAIL_TO_USER_ID).map(
  (id) => new mongoose.Types.ObjectId(id)
);

const dryRun = process.env.DRY_RUN === '1';
const confirm = process.env.CONFIRM === '1';
const scoreOnly = process.env.SCORE_ONLY === '1';

function parseExternalId(partido) {
  const m = String(partido || '').match(/^#(\d+)/);
  return m ? m[1] : null;
}

function parseScore(marcador) {
  const parts = String(marcador || '').split('-');
  if (parts.length !== 2) return null;
  const homeGoals = Number(parts[0]);
  const awayGoals = Number(parts[1]);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return null;
  return { homeGoals, awayGoals };
}

function mapPredictionSource(origen) {
  const allowed = ['user', 'ai', 'admin', 'default'];
  const src = String(origen || 'user').toLowerCase();
  return allowed.includes(src) ? src : 'user';
}

function loadExport() {
  if (!fs.existsSync(EXPORT_PATH)) {
    throw new Error(`Export not found: ${EXPORT_PATH}`);
  }
  return JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
}

async function buildImportPlan(exportData) {
  const externalIds = [
    ...new Set(
      exportData.predicciones
        .map((row) => parseExternalId(row.partido))
        .filter(Boolean)
    ),
  ];

  const matches = await Match.find({ externalId: { $in: externalIds } })
    .select('_id externalId status')
    .lean();
  const matchByExternalId = Object.fromEntries(matches.map((m) => [m.externalId, m]));

  const perPlayer = {};
  const skipped = { unknownEmail: 0, noExternalId: 0, badScore: 0, noMatch: 0 };
  const docs = [];
  const finishedMatchIds = new Set();

  for (const row of exportData.predicciones) {
    const email = String(row.email || '').toLowerCase().trim();
    const userIdStr = EMAIL_TO_USER_ID[email];
    if (!userIdStr) {
      skipped.unknownEmail += 1;
      continue;
    }

    const externalId = parseExternalId(row.partido);
    if (!externalId) {
      skipped.noExternalId += 1;
      continue;
    }

    const score = parseScore(row.marcador);
    if (!score) {
      skipped.badScore += 1;
      continue;
    }

    const match = matchByExternalId[externalId];
    if (!match) {
      skipped.noMatch += 1;
      continue;
    }

    const userId = new mongoose.Types.ObjectId(userIdStr);
    const matchId = match._id;

    if (!perPlayer[row.usuario || email]) {
      perPlayer[row.usuario || email] = { email, import: 0, skippedMatch: 0 };
    }
    perPlayer[row.usuario || email].import += 1;

    if (match.status === 'finished') {
      finishedMatchIds.add(matchId.toString());
    }

    const updatedAt = row.actualizado ? new Date(row.actualizado) : new Date();

    docs.push({
      userId,
      matchId,
      homeGoals: score.homeGoals,
      awayGoals: score.awayGoals,
      userSubmitted: row.enviado === 'sí',
      predictionSource: mapPredictionSource(row.origen),
      pointsEarned: row.puntos ?? null,
      bonusPoint: 0,
      bonusReason: null,
      createdAt: updatedAt,
      updatedAt,
    });
  }

  return { docs, perPlayer, skipped, finishedMatchIds };
}

async function verifyEmailCollisions() {
  const issues = [];
  for (const [userIdStr, email] of Object.entries(USER_ID_TO_EMAIL)) {
    const collision = await User.findOne({
      email,
      _id: { $ne: new mongoose.Types.ObjectId(userIdStr) },
    }).lean();
    if (collision) {
      issues.push(`${email} already used by ${collision.name} (${collision._id})`);
    }
  }
  return issues;
}

async function rescoreImportedPredictions(finishedMatchIds) {
  const matchObjectIds = [...finishedMatchIds].map((id) => new mongoose.Types.ObjectId(id));
  const matches = await Match.find({ _id: { $in: matchObjectIds } }).lean();
  const matchById = Object.fromEntries(matches.map((m) => [m._id.toString(), m]));

  const predictions = await Prediction.find({
    userId: { $in: HUMAN_USER_IDS },
    matchId: { $in: matchObjectIds },
  }).lean();

  const bulkOps = [];
  for (const prediction of predictions) {
    const match = matchById[prediction.matchId.toString()];
    if (!match || match.status !== 'finished') continue;

    const actualHome = match.homeScore ?? 0;
    const actualAway = match.awayScore ?? 0;
    const predicted = { home: prediction.homeGoals, away: prediction.awayGoals };
    const actual = { home: actualHome, away: actualAway };
    const { total, breakdown } = calculatePoints(predicted, actual);
    const goalDiff = calculateGoalDiff(predicted, actual);

    bulkOps.push({
      updateOne: {
        filter: { _id: prediction._id },
        update: {
          $set: {
            pointsEarned: total,
            pointsBreakdown: breakdown,
            goalDiffHome: goalDiff.home,
            goalDiffAway: goalDiff.away,
            bonusPoint: 0,
            bonusReason: null,
          },
        },
      },
    });
  }

  if (bulkOps.length) {
    await Prediction.bulkWrite(bulkOps, { ordered: false });
  }

  for (const uid of HUMAN_USER_IDS) {
    await recalculateConsolationBonuses(uid);
    await recalculateUserTotalPoints(uid);
  }

  return bulkOps.length;
}

async function updateUserEmails() {
  for (const [userIdStr, email] of Object.entries(USER_ID_TO_EMAIL)) {
    await User.updateOne(
      { _id: new mongoose.Types.ObjectId(userIdStr) },
      {
        $set: {
          email,
          mustChangePassword: false,
        },
      }
    );
    console.log(`  email → ${email}`);
  }
}

async function main() {
  if (!dryRun && !confirm) {
    console.error('Set DRY_RUN=1 to preview or CONFIRM=1 to apply.');
    process.exit(1);
  }

  await connectDb();
  console.log(`Mode: ${dryRun ? 'DRY_RUN' : 'CONFIRM'}`);
  console.log(`Export: ${EXPORT_PATH}`);
  console.log(`Humans: ${HUMAN_USER_IDS.length} (IA ${AI_USER_ID} excluded)\n`);

  const exportData = loadExport();
  const { docs, perPlayer, skipped, finishedMatchIds } = await buildImportPlan(exportData);

  console.log('Per player (to import):');
  for (const [name, stats] of Object.entries(perPlayer).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${name} <${stats.email}>: ${stats.import}`);
  }
  console.log('\nSkipped rows:', skipped);
  console.log(`Total docs to upsert: ${docs.length}`);
  console.log(`Finished matches to rescore: ${finishedMatchIds.size}\n`);

  const emailIssues = await verifyEmailCollisions();
  if (emailIssues.length) {
    console.error('Email collisions — aborting:');
    emailIssues.forEach((line) => console.error(' -', line));
    process.exit(1);
  }

  const existingHuman = await Prediction.countDocuments({ userId: { $in: HUMAN_USER_IDS } });
  const existingAi = await Prediction.countDocuments({
    userId: new mongoose.Types.ObjectId(AI_USER_ID),
  });
  console.log(`Existing predictions — humans: ${existingHuman}, IA: ${existingAi} (IA untouched)\n`);

  if (!dryRun && confirm) {
    if (!scoreOnly) {
      console.log('Deleting human FamilyPro predictions...');
      const del = await Prediction.deleteMany({ userId: { $in: HUMAN_USER_IDS } });
      console.log(`  deleted ${del.deletedCount}`);

      console.log('Upserting restored predictions...');
      const ops = docs.map((doc) => ({
        updateOne: {
          filter: { userId: doc.userId, matchId: doc.matchId },
          update: { $set: doc },
          upsert: true,
        },
      }));
      const bulk = await Prediction.bulkWrite(ops, { ordered: false });
      console.log(`  upserted ${bulk.upsertedCount}, modified ${bulk.modifiedCount}`);
    } else {
      console.log('SCORE_ONLY — skipping delete/import');
    }

    console.log('Rescoring finished predictions...');
    const rescored = await rescoreImportedPredictions(finishedMatchIds);
    console.log(`  scored ${rescored} predictions`);

    const pollution = await Prediction.deleteMany({
      userId: { $in: HUMAN_USER_IDS },
      predictionSource: 'default',
    });
    if (pollution.deletedCount) {
      console.log(`  removed ${pollution.deletedCount} default pollution predictions`);
      for (const uid of HUMAN_USER_IDS) {
        await recalculateUserTotalPoints(uid);
      }
    }

    console.log('\nUpdating user emails:');
    await updateUserEmails();

    const board = await getLeaderboard(FAMILY_GROUP_ID);
    console.log('\n=== Leaderboard after restore ===');
    for (const row of board) {
      const gdif = goalDiffScore(row.difGl, row.difGv, row.pj).toFixed(3);
      console.log(
        `${row.rank}. ${row.name} PJ=${row.pj} PA=${row.pa} GL=${row.gl} GV=${row.gv} Gdif=${gdif} GT=${row.gt} PB=${row.pb} Pts=${row.totalPoints}`
      );
    }
  } else {
    console.log('DRY_RUN — no writes. Run CONFIRM=1 to apply.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
