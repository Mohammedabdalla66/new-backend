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
    budget: { type: String, default: '' }, // Budget range as string (e.g., "500-1000")
    deadline: { type: Date },
    status: { type: String, enum: ['submitted', 'open', 'in-progress', 'completed', 'canceled'], default: 'submitted' },
    // Additional request details
    legalForm: { type: String }, // Legal form of the company
    businessActivity: { type: String }, // Business activity sector
    registeredCapital: { type: String }, // Registered capital in OMR
    estimatedRevenue: { type: String }, // Estimated revenue in OMR
    estimatedExpenses: { type: String }, // Estimated expenses in OMR
  },
  { timestamps: true }
);

// Prevent model recompilation during hot reload
export const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);


