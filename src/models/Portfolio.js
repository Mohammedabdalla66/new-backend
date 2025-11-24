import mongoose from 'mongoose';

// File schema for portfolio attachments
const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  publicId: { type: String }, // Cloudinary public ID for deletion
  type: { type: String, default: 'file' }, // 'image', 'pdf', 'document'
  size: { type: Number }, // File size in bytes
}, { _id: false });

const portfolioSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['work', 'case', 'cert'], // work = workSamples, case = caseStudies, cert = certifications
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    tags: [{
      type: String
    }],
    date: {
      type: Date,
      default: Date.now
    },
    files: [fileSchema],
    // Additional fields for case studies
    client: String,
    industry: String,
    duration: String,
    results: [String],
    // Additional fields for certifications
    issuer: String,
    expiry: Date,
    credentialId: String,
    status: {
      type: String,
      enum: ['active', 'expiring', 'expired'],
      default: 'active'
    },
  },
  { timestamps: true }
);

// Compound index for efficient querying
portfolioSchema.index({ userId: 1, type: 1 });
portfolioSchema.index({ userId: 1, createdAt: -1 });

// Prevent model recompilation during hot reload
export const Portfolio = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);

