import mongoose from 'mongoose';

const competitionGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    prizesWinnersCount: { type: Number, default: 0, min: 0, max: 10 },
    prizes: [
      {
        position: { type: Number, required: true, min: 1, max: 10 },
        // Optional description/value (e.g. "$20", "Camiseta", etc.)
        prize: { type: String, trim: true, default: '' },
      },
    ],
  },
  { timestamps: true }
);

export const CompetitionGroup = mongoose.model('CompetitionGroup', competitionGroupSchema);
