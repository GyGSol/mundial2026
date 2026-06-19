/**
 * Inscribe a todos los miembros de un grupo en el Torneo Eliminación.
 * Si falta saldo, acredita Fubols (simula compra/depósito).
 *
 * Uso: GROUP_NAME=FamilyPro node src/scripts/enrollGroupElimination.js
 *      DRY_RUN=1 para solo listar acciones.
 */
import { connectDb } from '../config/db.js';
import mongoose from 'mongoose';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { User } from '../models/User.js';
import { TournamentEnrollment } from '../models/TournamentEnrollment.js';
import { TOURNAMENT_TYPE_ELIMINATION } from '../constants/tournamentTypes.js';
import { computeEliminationEntryFee } from '../config/economy.js';
import { creditUser } from '../services/fubolService.js';
import {
  activateTournament,
  getEliminationTournamentRecord,
} from '../services/eliminationTournamentService.js';
import { enrollUser } from '../services/tournamentEnrollmentService.js';

const groupName = process.env.GROUP_NAME || process.argv[2] || 'FamilyPro';
const dryRun = process.env.DRY_RUN === '1';

async function ensureBalanceForFee(user, fee, groupId) {
  const balance = user.balanceFubols ?? 0;
  if (balance >= fee) {
    return { toppedUp: 0, balance };
  }
  const needed = fee - balance;
  if (dryRun) {
    return { toppedUp: needed, balance };
  }
  await creditUser({
    userId: user._id,
    amount: needed,
    type: 'deposit',
    idempotencyKey: `sim-deposit-elimination:${groupId}:${user._id}`,
    metadata: { reason: 'simulated_purchase', script: 'enrollGroupElimination' },
    skipTreasuryDeposit: true,
  });
  const fresh = await User.findById(user._id).select('balanceFubols').lean();
  return { toppedUp: needed, balance: fresh?.balanceFubols ?? balance + needed };
}

async function main() {
  await connectDb();

  const escaped = groupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const group = await CompetitionGroup.findOne({
    name: new RegExp(escaped, 'i'),
  });
  if (!group) {
    console.error(`Grupo no encontrado: ${groupName}`);
    process.exit(1);
  }

  const groupId = group._id.toString();
  const adminId = group.createdBy?.toString();
  if (!adminId) {
    console.error('El grupo no tiene createdBy (admin)');
    process.exit(1);
  }

  let tournament = await getEliminationTournamentRecord(groupId);
  if (!tournament || tournament.status === 'inactive') {
    if (dryRun) {
      console.log(`[dry-run] Activaría torneo eliminación en ${group.name}`);
    } else {
      await activateTournament(groupId, adminId);
      tournament = await getEliminationTournamentRecord(groupId);
      console.log(`Torneo activado (status: ${tournament?.status})`);
    }
  } else if (tournament.status !== 'open') {
    console.error(
      `Torneo en estado "${tournament.status}" — solo se inscribe con inscripciones abiertas (open)`
    );
    process.exit(1);
  } else {
    console.log(`Torneo ya abierto en ${group.name}`);
  }

  const memberships = await UserGroupMembership.find({ groupId: group._id }).lean();
  const memberCount = memberships.length;
  const fee = computeEliminationEntryFee(memberCount);

  console.log(`Grupo: ${group.name} (${groupId})`);
  console.log(`Miembros: ${memberCount} · Cuota elimination: ${fee} Fubols\n`);

  let enrolled = 0;
  let already = 0;
  let toppedUp = 0;
  let errors = 0;

  for (const membership of memberships) {
    const user = await User.findById(membership.userId)
      .select('name email balanceFubols isAiUser')
      .lean();
    if (!user) {
      errors += 1;
      console.error(`Usuario no encontrado: ${membership.userId}`);
      continue;
    }

    const label = `${user.name} <${user.email}>${user.isAiUser ? ' [IA]' : ''}`;
    const existing = await TournamentEnrollment.findOne({
      groupId: group._id,
      userId: user._id,
      tournamentType: TOURNAMENT_TYPE_ELIMINATION,
    }).lean();

    if (existing) {
      already += 1;
      console.log(`Ya inscripto: ${label}`);
      continue;
    }

    if (dryRun) {
      const { toppedUp: need } = await ensureBalanceForFee(user, fee, groupId);
      console.log(
        `[dry-run] Inscribiría ${label} (saldo ${user.balanceFubols ?? 0}` +
          `${need ? `, +${need} Fubols simulados` : ''})`
      );
      enrolled += 1;
      if (need) toppedUp += 1;
      continue;
    }

    try {
      const { toppedUp: added } = await ensureBalanceForFee(user, fee, groupId);
      if (added > 0) {
        toppedUp += 1;
        console.log(`+${added} Fubols (simulado) → ${label}`);
      }
      await enrollUser(user._id.toString(), groupId, TOURNAMENT_TYPE_ELIMINATION);
      enrolled += 1;
      console.log(`✓ Inscripto: ${label}`);
    } catch (err) {
      errors += 1;
      console.error(`✗ ${label}: ${err.message}`);
    }
  }

  console.log('\n--- Resumen ---');
  console.log(`Inscriptos: ${enrolled}`);
  console.log(`Ya estaban: ${already}`);
  console.log(`Con depósito simulado: ${toppedUp}`);
  console.log(`Errores: ${errors}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
