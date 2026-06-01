import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    teams: [mongoose.Schema.Types.Mixed],
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const Group = mongoose.model('Group', groupSchema);
