import mongoose from 'mongoose';

const appTreasurySchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'main', unique: true },
    houseBalanceFubols: { type: Number, default: 0, min: 0 },
    totalDepositedFubols: { type: Number, default: 0, min: 0 },
    totalWithdrawnFubols: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const AppTreasury = mongoose.model('AppTreasury', appTreasurySchema);
