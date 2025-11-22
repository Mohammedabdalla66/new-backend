import mongoose from 'mongoose';

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
    status: { type: String, enum: ['pending', 'active', 'completed', 'canceled'], default: 'pending' },
  },
  { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);


