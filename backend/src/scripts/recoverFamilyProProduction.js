/**
 * Recupera usuarios y grupo FamilyPro borrados por tests contra producción.
 * NO restaura predicciones ni puntos (requieren backup Atlas / mongodump).
 *
 * Uso:
 *   DRY_RUN=1 node src/scripts/recoverFamilyProProduction.js   # solo muestra plan
 *   CONFIRM=1 node src/scripts/recoverFamilyProProduction.js   # aplica cambios
 *
 * Variables opcionales:
 *   RECOVERY_TEMP_PASSWORD — contraseña temporal (default Mundial2026!)
 *   GONZALO_EMAIL — default gonzalomlopolito@gmail.com
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import {
  AI_USER_DEFAULT_EMAIL,
  AI_USER_DISPLAY_NAME,
} from '../constants/aiUser.js';

const FAMILY_GROUP_ID = '6a1d9d3aec2a89a22a36a279';
const GROUP_NAME = 'FamilyPro 🇺🇾 🇪🇦 🇦🇷';

const dryRun = process.env.DRY_RUN === '1';
const confirm = process.env.CONFIRM === '1';
const tempPassword = process.env.RECOVERY_TEMP_PASSWORD || 'Mundial2026!';
const gonzaloEmail = (process.env.GONZALO_EMAIL || 'gonzalomlopolito@gmail.com').toLowerCase();

/** IDs y nombres conocidos (emails desconocidos → recovery.*@mundial2026.local). */
const PLAYERS = [
  {
    _id: '6a1d9cdeec2a89a22a36a033',
    name: 'Gonzalo',
    email: gonzaloEmail,
    role: 'owner',
    isAiUser: false,
  },
  {
    _id: '6a2b833a3993730b6b456e3e',
    name: AI_USER_DISPLAY_NAME,
    email: AI_USER_DEFAULT_EMAIL,
    role: 'member',
    isAiUser: true,
  },
  { _id: '6a1d9ff0ec2a89a22a36b121', name: 'Yago', email: 'recovery.yago@mundial2026.local', role: 'member' },
  { _id: '6a1db76595430167a4afc241', name: 'Gisela', email: 'recovery.gisela@mundial2026.local', role: 'member' },
  {
    _id: '6a205b4e82c32257e3fa6429',
    name: 'Ramdow Player',
    email: 'gonzalomlopolitoadm@gmail.com',
    role: 'member',
  },
  { _id: '6a21f9a7d64dde09c5ce49a0', name: 'Raguccito', email: 'recovery.raguccito@mundial2026.local', role: 'member' },
  { _id: '6a1deea195430167a4b09047', name: 'Marcelo', email: 'recovery.marcelo@mundial2026.local', role: 'member' },
  { _id: '6a231b5474b3c1c88ed7c398', name: 'Tixe', email: 'recovery.tixe@mundial2026.local', role: 'member' },
  { _id: '6a1f3bdbd66246b92f066559', name: 'Martin', email: 'recovery.martin@mundial2026.local', role: 'member' },
  { _id: '6a29fe7df669726d8cdbea37', name: 'Guido', email: 'recovery.guido@mundial2026.local', role: 'member' },
  { _id: '6a24628774b3c1c88edc6c63', name: 'Jorge', email: 'recovery.jorge@mundial2026.local', role: 'member' },
  { _id: '6a1f9d665cffc04b2a1e8511', name: 'Tisho', email: 'recovery.tisho@mundial2026.local', role: 'member' },
];

async function lastBalances(db, userIds) {
  const txs = await db
    .collection('fuboltransactions')
    .find({ userId: { $in: userIds } })
    .sort({ createdAt: 1 })
    .toArray();
  const balances = {};
  for (const t of txs) {
    balances[t.userId.toString()] = t.balanceAfter ?? 0;
  }
  return balances;
}

async function cleanupTestPollution(db) {
  const actions = [];

  const stale = await User.findOne({ email: 'stale@example.com' }).lean();
  if (stale) {
    actions.push(`delete user stale@example.com (${stale._id})`);
    if (!dryRun && confirm) {
      await User.deleteOne({ _id: stale._id });
      await db.collection('predictions').deleteMany({ userId: stale._id });
    }
  }

  const testGroups = await CompetitionGroup.find({
    name: { $in: [/^Test$/i, /^Elim /] },
  }).lean();
  for (const g of testGroups) {
    actions.push(`delete test group "${g.name}" (${g._id})`);
    if (!dryRun && confirm) {
      await db.collection('predictions').deleteMany({ userId: { $in: await db.collection('usergroupmemberships').distinct('userId', { groupId: g._id }) } });
      await UserGroupMembership.deleteMany({ groupId: g._id });
      await db.collection('tournamentenrollments').deleteMany({ groupId: g._id });
      await db.collection('eliminationtournaments').deleteMany({ groupId: g._id });
      await CompetitionGroup.deleteOne({ _id: g._id });
    }
  }

  const testUsers = await User.find({ email: /@test\.local$|@example\.com$/ }).lean();
  for (const u of testUsers) {
    if (u.email === 'stale@example.com') continue;
    actions.push(`delete test user ${u.email}`);
    if (!dryRun && confirm) {
      await User.deleteOne({ _id: u._id });
      await db.collection('predictions').deleteMany({ userId: u._id });
    }
  }

  return actions;
}

async function main() {
  if (!dryRun && !confirm) {
    console.error('Set DRY_RUN=1 to preview or CONFIRM=1 to apply.');
    process.exit(1);
  }

  await connectDb();
  const db = mongoose.connection.db;
  const groupObjectId = new mongoose.Types.ObjectId(FAMILY_GROUP_ID);
  const playerIds = PLAYERS.map((p) => new mongoose.Types.ObjectId(p._id));
  const balances = await lastBalances(db, playerIds);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  console.log(`Mode: ${dryRun ? 'DRY_RUN' : 'CONFIRM'}`);
  console.log(`Group: ${GROUP_NAME} (${FAMILY_GROUP_ID})`);
  console.log(`Temp password for recovered accounts: ${tempPassword}`);
  console.log('');

  const cleanup = await cleanupTestPollution(db);
  if (cleanup.length) {
    console.log('Cleanup:');
    cleanup.forEach((line) => console.log(' -', line));
    console.log('');
  }

  const existingGroup = await CompetitionGroup.findById(FAMILY_GROUP_ID).lean();
  if (existingGroup) {
    console.log('Group already exists:', existingGroup.name);
  } else {
    console.log('Create group:', GROUP_NAME);
    if (!dryRun && confirm) {
      await db.collection('competitiongroups').insertOne({
        _id: groupObjectId,
        name: GROUP_NAME,
        description: '',
        createdBy: new mongoose.Types.ObjectId('6a1d9cdeec2a89a22a36a033'),
        prizesWinnersCount: 0,
        prizes: [],
        createdAt: new Date('2026-06-16T23:50:45.382Z'),
        updatedAt: new Date(),
      });
    }
  }

  console.log('\nUsers:');
  for (const player of PLAYERS) {
    const id = new mongoose.Types.ObjectId(player._id);
    const balance = balances[player._id] ?? 0;
    const existing = await User.findById(id).lean();
    const line = `${player.name} <${player.email}> balance=${balance} ai=${!!player.isAiUser} ${existing ? 'UPDATE' : 'INSERT'}`;
    console.log(' -', line);

    if (!dryRun && confirm) {
      await User.updateOne(
        { _id: id },
        {
          $set: {
            name: player.name,
            email: player.email,
            passwordHash,
            balanceFubols: balance,
            totalPoints: 0,
            isAiUser: !!player.isAiUser,
            mustChangePassword: player.email.includes('recovery.'),
            competitionGroupId: groupObjectId,
            activeCompetitionGroupId: groupObjectId,
            aiQuestionCredits: 0,
          },
        },
        { upsert: true }
      );

      await UserGroupMembership.updateOne(
        { userId: id, groupId: groupObjectId },
        {
          $set: {
            role: player.role || 'member',
          },
          $setOnInsert: {
            userId: id,
            groupId: groupObjectId,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
  }

  const memberCount = await UserGroupMembership.countDocuments({ groupId: groupObjectId });
  console.log(`\nMemberships after recovery: ${dryRun ? '(pending)' : memberCount}`);

  const predsForFamily = await db.collection('predictions').countDocuments({ userId: { $in: playerIds } });
  console.log(`Predictions for FamilyPro users: ${predsForFamily} (need Atlas backup to restore)`);

  console.log('\n⚠️  Predicciones y puntos del torneo común NO se pueden reconstruir sin backup.');
  console.log('    Torneo eliminación, enrollments, prizepool y partidos siguen en la base.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
