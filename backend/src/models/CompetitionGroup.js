import mongoose from 'mongoose';

const competitionGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const CompetitionGroup = mongoose.model('CompetitionGroup', competitionGroupSchema);
