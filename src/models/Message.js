import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceProvider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Legacy field for backward compatibility
    sender: { type: String, enum: ['client', 'serviceProvider', 'company'], required: true }, // 'company' kept for backward compatibility
    text: String,
    file: { name: String, url: String, type: String },
  },
  { timestamps: true }
);

export const Message = mongoose.model('Message', messageSchema);

