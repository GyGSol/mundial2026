import mongoose from 'mongoose';

const aiMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    source: { type: String, default: null },
    model: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const aiConsultationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topicType: {
      type: String,
      enum: ['match', 'group', 'round_of_16'],
      required: true,
    },
    topicKey: { type: String, required: true, trim: true },
    title: { type: String, default: '' },
    initialInsight: {
      homeGoals: Number,
      awayGoals: Number,
      reasoning: String,
      source: String,
      model: String,
    },
    messages: { type: [aiMessageSchema], default: [] },
  },
  { timestamps: true }
);

aiConsultationSchema.index({ userId: 1, topicType: 1, topicKey: 1 }, { unique: true });
aiConsultationSchema.index({ userId: 1, updatedAt: -1 });

export const AiConsultation = mongoose.model('AiConsultation', aiConsultationSchema);
