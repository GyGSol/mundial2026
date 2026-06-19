/**
 * Audita pérdida de usuarios/grupos y lista IDs huérfanos recuperables.
 * Uso: node src/scripts/auditDataLoss.js
 */
import { connectDb } from '../config/db.js';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Prediction } from '../models/Prediction.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { TournamentEnrollment } from '../models/TournamentEnrollment.js';
import { FubolTransaction } from '../models/FubolTransaction.js';
import { EliminationTournament } from '../models/EliminationTournament.js';

await connectDb();

const users = await User.find().select('name email totalPoints balanceFubols').lean();
const userIds = new Set(users.map((u) => u._id.toString()));

console.log('=== USUARIOS ACTUALES ===');
users.forEach((u) =>
  console.log(u._id.toString(), u.email, u.name, 'pts', u.totalPoints, 'fubols', u.balanceFubols)
);

console.log('\n=== GRUPOS ===');
const groups = await CompetitionGroup.find().select('name createdBy inviteCode').lean();
groups.forEach((g) => console.log(g._id.toString(), g.name, 'owner', g.createdBy?.toString()));

console.log('\n=== MEMBRESÍAS HUÉRFANAS ===');
const memberships = await UserGroupMembership.find().lean();
for (const m of memberships) {
  const uid = m.userId.toString();
  const u = users.find((x) => x._id.toString() === uid);
  console.log(uid, u?.name ?? 'MISSING', 'group', m.groupId.toString());
}

console.log('\n=== INSCRIPCIONES TORNEO ===');
const enrollments = await TournamentEnrollment.find().lean();
for (const e of enrollments) {
  const uid = e.userId.toString();
  const u = users.find((x) => x._id.toString() === uid);
  console.log(
    e.tournamentType,
    uid,
    u?.name ?? 'MISSING',
    'group',
    e.groupId.toString(),
    'fee',
    e.entryFeeFubols
  );
}

console.log('\n=== PREDICCIONES POR USUARIO (incl. huérfanos) ===');
const predsByUser = await Prediction.aggregate([
  {
    $group: {
      _id: '$userId',
      count: { $sum: 1 },
      pts: { $sum: { $ifNull: ['$pointsEarned', 0] } },
    },
  },
]);
for (const row of predsByUser.sort((a, b) => b.pts - a.pts)) {
  const uid = row._id.toString();
  const missing = !userIds.has(uid);
  console.log(uid, missing ? 'ORPHAN' : 'ok', 'preds', row.count, 'pts', row.pts);
}

console.log('\n=== TX USUARIOS DISTINTOS ===');
const txUsers = await FubolTransaction.distinct('userId');
console.log('count', txUsers.length, 'orphan', txUsers.filter((id) => !userIds.has(id.toString())).length);

console.log('\n=== ELIMINATION TOURNAMENTS ===');
const elims = await EliminationTournament.find().lean();
for (const e of elims) {
  console.log(
    e._id.toString(),
    e.status,
    'group',
    e.groupId.toString(),
    'active',
    e.activePlayerIds?.length,
    'pool',
    e.eliminationPoolFubols
  );
}

await mongoose.disconnect();
