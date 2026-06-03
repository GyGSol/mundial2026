import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';

/** Reasigna grupo activo del usuario tras salir o ser expulsado de uno. */
export async function reassignActiveGroupAfterLeave(userId, leftGroupId) {
  const user = await User.findById(userId).select('activeCompetitionGroupId competitionGroupId');
  const wasActive =
    String(user?.activeCompetitionGroupId || user?.competitionGroupId || '') ===
    String(leftGroupId);

  if (!wasActive) return;

  const remaining = await UserGroupMembership.findOne({ userId }).sort({ createdAt: 1 }).lean();
  const nextGroupId = remaining?.groupId || null;
  await User.findByIdAndUpdate(userId, {
    $set: {
      activeCompetitionGroupId: nextGroupId,
      competitionGroupId: nextGroupId,
    },
  });
}

/** Activa el grupo si el usuario no tiene otro grupo activo. */
export async function maybeActivateGroupForUser(userId, groupId) {
  const user = await User.findById(userId).select('activeCompetitionGroupId competitionGroupId');
  const hasActive = Boolean(user?.activeCompetitionGroupId || user?.competitionGroupId);
  if (hasActive) return;

  await User.findByIdAndUpdate(userId, {
    $set: {
      activeCompetitionGroupId: groupId,
      competitionGroupId: groupId,
    },
  });
}
