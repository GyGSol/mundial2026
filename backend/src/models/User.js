import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    totalPoints: { type: Number, default: 0 },
    competitionGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
