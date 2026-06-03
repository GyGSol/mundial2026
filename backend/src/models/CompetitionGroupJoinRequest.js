import mongoose from 'mongoose';

const competitionGroupJoinRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      required: true,
      index: true,
    },
    status: { type: String, enum: ['pending', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

competitionGroupJoinRequestSchema.index({ userId: 1, groupId: 1 }, { unique: true });

export const CompetitionGroupJoinRequest = mongoose.model(
  'CompetitionGroupJoinRequest',
  competitionGroupJoinRequestSchema
);
