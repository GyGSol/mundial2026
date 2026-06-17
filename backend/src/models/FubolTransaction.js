import mongoose from 'mongoose';

const FUBOL_TX_TYPES = [
  'deposit',
  'entry_fee',
  'prize_payout',
  'withdrawal',
  'welcome_bonus',
  'ai_play_bonus',
  'ai_consultation',
  'ai_entry_float',
  'house_retention',
];

const fubolTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    type: { type: String, enum: FUBOL_TX_TYPES, required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, default: null },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      default: null,
      index: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

fubolTransactionSchema.index({ userId: 1, createdAt: -1 });
fubolTransactionSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: 'string' },
    },
  }
);

export const FubolTransaction = mongoose.model('FubolTransaction', fubolTransactionSchema);
export { FUBOL_TX_TYPES };
