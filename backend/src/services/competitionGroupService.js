import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { User } from '../models/User.js';

export async function listCompetitionGroups() {
  const groups = await CompetitionGroup.find().sort({ name: 1 }).lean();
  return Promise.all(
    groups.map(async (group) => ({
      id: group._id.toString(),
      name: group.name,
      description: group.description,
      memberCount: await User.countDocuments({ competitionGroupId: group._id }),
      createdAt: group.createdAt,
    }))
  );
}

export async function createCompetitionGroup({ name, description, createdBy = null }) {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    const error = new Error('El nombre del grupo es obligatorio');
    error.status = 400;
    throw error;
  }

  const existing = await CompetitionGroup.findOne({ name: trimmedName });
  if (existing) {
    const error = new Error('Ya existe un grupo con ese nombre');
    error.status = 409;
    throw error;
  }

  const group = await CompetitionGroup.create({
    name: trimmedName,
    description: description?.trim() || '',
    createdBy,
  });

  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description,
  };
}

export async function getCompetitionGroupById(groupId) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) return null;
  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description,
  };
}
