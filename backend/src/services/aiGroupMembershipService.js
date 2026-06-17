import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { getAiUser } from './aiPredictionService.js';
import { chargeGroupEntryFee } from './fubolService.js';

/**
 * Predictive Modeling (IA) compite en cada grupo: membresía + inscripción de 100 Fubols al pozo.
 * Idempotente: si ya es miembro, solo asegura el cobro de entrada.
 */
export async function ensureAiCompetitorInGroup(groupId) {
  const aiUser = await getAiUser();
  if (!aiUser) {
    return { ensured: false, reason: 'no_ai_user' };
  }

  const existing = await UserGroupMembership.findOne({
    userId: aiUser._id,
    groupId,
  }).lean();

  const entryFee = await chargeGroupEntryFee({
    userId: aiUser._id,
    groupId,
  });

  if (!existing) {
    await UserGroupMembership.findOneAndUpdate(
      { userId: aiUser._id, groupId },
      { $setOnInsert: { role: 'member' } },
      { upsert: true, new: true }
    );
  }

  return {
    ensured: true,
    added: !existing,
    userId: aiUser._id.toString(),
    entryFee,
  };
}

export async function ensureAiCompetitorInAllGroups() {
  const { CompetitionGroup } = await import('../models/CompetitionGroup.js');
  const groups = await CompetitionGroup.find().select('_id name').lean();
  const results = [];

  for (const group of groups) {
    const result = await ensureAiCompetitorInGroup(group._id);
    results.push({
      groupId: group._id.toString(),
      groupName: group.name,
      ...result,
    });
  }

  return results;
}
