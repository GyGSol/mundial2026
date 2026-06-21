import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    totalPoints: { type: Number, default: 0 },
    balanceFubols: { type: Number, default: 0, min: 0 },
    /** Preguntas IA restantes del pack actual (0–2). Al llegar a 0, la próxima pregunta cobra 1 Fubol por 3 más. */
    aiQuestionCredits: { type: Number, default: 0, min: 0, max: 3 },
    // Legacy field (single-group mode). Kept for backwards compatibility.
    competitionGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      default: null,
      index: true,
    },
    // New field for multi-group mode: selected group context in the app.
    activeCompetitionGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      default: null,
      index: true,
    },
    isAiUser: { type: Boolean, default: false, index: true },
    mustChangePassword: { type: Boolean, default: false },
    passwordResetAt: { type: Date, default: null },
    avatarDataUrl: { type: String, default: null },
    pushSubscriptions: [
      {
        endpoint: { type: String, required: true },
        keys: {
          p256dh: { type: String, required: true },
          auth: { type: String, required: true },
        },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
