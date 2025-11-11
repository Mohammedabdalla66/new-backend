import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: String, enum: ['client', 'company'], required: true },
    text: String,
    file: { name: String, url: String, type: String },
  },
  { timestamps: true }
);

export const Message = mongoose.model('Message', messageSchema);

