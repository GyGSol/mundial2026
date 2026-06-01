import mongoose from 'mongoose';

const userGroupMembershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      required: true,
      index: true,
    },
    role: { type: String, enum: ['member', 'owner'], default: 'member' },
  },
  { timestamps: true }
);

userGroupMembershipSchema.index({ userId: 1, groupId: 1 }, { unique: true });

export const UserGroupMembership = mongoose.model('UserGroupMembership', userGroupMembershipSchema);
