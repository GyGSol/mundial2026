import mongoose from 'mongoose';

const adminSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'admin' },
    username: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const AdminSettings = mongoose.model('AdminSettings', adminSettingsSchema);
