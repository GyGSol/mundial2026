import { env } from '../config/env.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { FubolsCupTournament } from '../models/FubolsCupTournament.js';
import { User } from '../models/User.js';
import { FUBOLS_CUP_MIN_HUMANS } from '../../../shared/fubolsCupBracket.js';
import { getHumanLeaderboardTop8 } from './fubolsCupService.js';
import { sendFubolsCupQualificationEmail } from './emailService.js';

function buildCupUrl(groupId) {
  const origin = env.clientOrigin.replace(/\/$/, '');
  return `${origin}/mundial?tab=fubols-cup&groupId=${encodeURIComponent(groupId)}`;
}

/**
 * Lista humanos clasificados a Copa Fubols que aún no recibieron el mail de aviso.
 * Un usuario aparece una sola vez aunque califique en varios grupos (prioriza activeCompetitionGroupId).
 */
export async function listFubolsCupQualificationRecipients() {
  const tournaments = await FubolsCupTournament.find({
    status: { $ne: 'cancelled' },
  })
    .select('groupId status seeds')
    .lean();

  if (!tournaments.length) return [];

  const groupIds = tournaments.map((t) => t.groupId);
  const groups = await CompetitionGroup.find({ _id: { $in: groupIds } })
    .select('name')
    .lean();
  const groupNameById = Object.fromEntries(groups.map((g) => [String(g._id), g.name]));

  /** @type {Map<string, { groupIds: Set<string> }>} */
  const byUserId = new Map();

  for (const tournament of tournaments) {
    const groupId = String(tournament.groupId);
    let userIds;

    if (tournament.seeds?.length) {
      userIds = tournament.seeds.map((s) => String(s.userId));
    } else {
      const top8 = await getHumanLeaderboardTop8(groupId);
      if (top8.length < FUBOLS_CUP_MIN_HUMANS) continue;
      userIds = top8.map((r) => String(r.id));
    }

    for (const userId of userIds) {
      const entry = byUserId.get(userId) ?? { groupIds: new Set() };
      entry.groupIds.add(groupId);
      byUserId.set(userId, entry);
    }
  }

  const userIds = [...byUserId.keys()];
  if (!userIds.length) return [];

  const users = await User.find({
    _id: { $in: userIds },
    isAiUser: { $ne: true },
    fubolsCupQualificationEmailSentAt: null,
  })
    .select('_id name email activeCompetitionGroupId')
    .lean();

  return users.map((user) => {
    const { groupIds: qualifiedGroupIds } = byUserId.get(String(user._id));
    const activeGroupId = user.activeCompetitionGroupId ? String(user.activeCompetitionGroupId) : null;
    const groupId =
      activeGroupId && qualifiedGroupIds.has(activeGroupId)
        ? activeGroupId
        : [...qualifiedGroupIds][0];

    return {
      userId: String(user._id),
      email: user.email,
      name: user.name,
      groupId,
      groupName: groupNameById[groupId] ?? 'tu grupo',
      cupUrl: buildCupUrl(groupId),
    };
  });
}

export async function sendFubolsCupQualificationEmails({ dryRun = true } = {}) {
  const recipients = await listFubolsCupQualificationRecipients();

  if (dryRun) {
    return {
      dryRun: true,
      recipientCount: recipients.length,
      recipients: recipients.map((r) => ({
        email: r.email,
        name: r.name,
        groupName: r.groupName,
        cupUrl: r.cupUrl,
      })),
      sent: 0,
      skipped: 0,
      errors: [],
    };
  }

  let sent = 0;
  let skipped = 0;
  const errors = [];

  for (const recipient of recipients) {
    const user = await User.findById(recipient.userId).select(
      'fubolsCupQualificationEmailSentAt isAiUser'
    );
    if (!user || user.isAiUser || user.fubolsCupQualificationEmailSentAt) {
      skipped += 1;
      continue;
    }

    try {
      await sendFubolsCupQualificationEmail({
        to: recipient.email,
        name: recipient.name,
        groupName: recipient.groupName,
        cupUrl: recipient.cupUrl,
      });
      user.fubolsCupQualificationEmailSentAt = new Date();
      await user.save();
      sent += 1;
      console.log(`Enviado → ${recipient.email} (${recipient.groupName})`);
    } catch (err) {
      errors.push({ email: recipient.email, message: err?.message || String(err) });
      console.error(`Error ${recipient.email}:`, err?.message || err);
    }
  }

  return { dryRun: false, recipientCount: recipients.length, sent, skipped, errors };
}
