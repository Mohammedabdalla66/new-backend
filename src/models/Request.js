import mongoose from 'mongoose';

// Define attachment schema explicitly
const attachmentSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  url: { type: String, default: '' },
  type: { type: String, default: 'file' }
}, { _id: false }); // Don't create _id for subdocuments

const requestSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    attachments: { type: [attachmentSchema], default: [] },
    budget: { type: Number, default: 0 },
    deadline: { type: Date },
    status: { type: String, enum: ['pending', 'submitted', 'open', 'in-progress', 'completed', 'canceled', 'rejected'], default: 'pending' },
    rejectionReason: { type: String, default: '' }, // Admin's reason for rejection
  },
  { timestamps: true }
);

// Prevent model recompilation during hot reload
export const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);


