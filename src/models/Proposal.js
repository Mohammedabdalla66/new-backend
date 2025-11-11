import mongoose from 'mongoose';

const proposalSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, required: true, min: 1 },
    notes: { type: String, trim: true },
    attachments: [
      {
        name: { type: String },
        url: { type: String },
        type: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'canceled'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

export const Proposal = mongoose.models.Proposal || mongoose.model('Proposal', proposalSchema);


