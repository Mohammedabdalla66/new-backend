import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Chat',
      index: true
    },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceProvider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Legacy field for backward compatibility
    sender: { type: String, enum: ['client', 'serviceProvider', 'company', 'admin'], required: true }, // 'company' kept for backward compatibility, 'admin' for system messages
    text: String,
    file: { name: String, url: String, type: String },
    readAt: { type: Date }, // When message was read
  },
  { timestamps: true }
);

export const Message = mongoose.model('Message', messageSchema);

