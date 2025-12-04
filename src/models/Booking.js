import mongoose from 'mongoose';

const timelineEventSchema = new mongoose.Schema({
  event: { type: String, required: true }, // e.g., 'submitted', 'offer_accepted', 'work_started', 'deadline_approaching', 'completed'
  date: { type: Date, required: true },
  description: { type: String, default: '' },
}, { _id: false });

const fileSchema = new mongoose.Schema({
  url: { type: String, required: true },
  name: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const historyLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'status_changed', 'suspended', 'reopened', 'admin_message', 'warning_added'
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: String, default: '' }, // Additional details about the action
}, { _id: false });

const bookingSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceProvider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Legacy field for backward compatibility
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    proposal: {
      price: Number,
      duration: String,
      notes: String,
    },
    // Enhanced fields for admin management
    projectTitle: { type: String }, // Title from the request
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Alias for serviceProvider
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' }, // Reference to the Proposal
    timeline: { type: [timelineEventSchema], default: [] },
    riskScore: { type: Number, default: 0, min: 0, max: 100 }, // Risk score 0-100
    files: { type: [fileSchema], default: [] },
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'held', 'released', 'refunded', 'failed'], 
      default: 'pending' 
    },
    historyLogs: { type: [historyLogSchema], default: [] },
    // Additional status values
    status: { 
      type: String, 
      enum: ['pending', 'active', 'in-progress', 'pending-review', 'suspended', 'completed', 'canceled'], 
      default: 'pending',
      index: true
    },
    // Deadline for completion
    deadline: { type: Date },
    // Start date when work actually began
    startDate: { type: Date },
    // Admin notes
    adminNotes: { type: String, default: '' },
    // Warnings
    warnings: [{
      target: { type: String, enum: ['client', 'provider'], required: true },
      message: { type: String, required: true },
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

// Indexes for efficient querying
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ client: 1, status: 1 });
bookingSchema.index({ serviceProvider: 1, status: 1 });
bookingSchema.index({ riskScore: -1 });

export const Booking = mongoose.model('Booking', bookingSchema);


