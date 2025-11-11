import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    attachments: [{ name: String, url: String, type: String }],
    budget: { type: Number, default: 0 },
    deadline: { type: Date },
    status: { type: String, enum: ['submitted', 'open', 'in-progress', 'completed', 'canceled'], default: 'submitted' },
  },
  { timestamps: true }
);

export const Request = mongoose.model('Request', requestSchema);


