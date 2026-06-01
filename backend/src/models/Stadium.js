import mongoose from 'mongoose';

const stadiumSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    nameEn: String,
    nameFa: String,
    city: String,
    country: String,
    /** IANA zone for interpreting local_date wall-clock times (e.g. America/Mexico_City). */
    timezone: String,
    capacity: Number,
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const Stadium = mongoose.model('Stadium', stadiumSchema);
