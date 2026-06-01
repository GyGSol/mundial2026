import mongoose from 'mongoose';

const stadiumSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    nameEn: String,
    nameFa: String,
    city: String,
    country: String,
    capacity: Number,
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const Stadium = mongoose.model('Stadium', stadiumSchema);
