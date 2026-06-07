import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    nameEn: String,
    nameFa: String,
    fifaCode: String,
    group: String,
    flag: String,
    footballDataTeamId: { type: Number, sparse: true, index: true },
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const Team = mongoose.model('Team', teamSchema);
