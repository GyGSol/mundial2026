import mongoose from 'mongoose';
import { ENROLLABLE_TOURNAMENT_TYPES } from '../constants/tournamentTypes.js';

const tournamentEnrollmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      required: true,
      index: true,
    },
    tournamentType: {
      type: String,
      enum: ENROLLABLE_TOURNAMENT_TYPES,
      required: true,
    },
    enrolledAt: { type: Date, default: Date.now },
    entryFeeFubols: { type: Number, default: null },
    entryFeePaidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tournamentEnrollmentSchema.index({ userId: 1, groupId: 1, tournamentType: 1 }, { unique: true });

export const TournamentEnrollment = mongoose.model('TournamentEnrollment', tournamentEnrollmentSchema);
