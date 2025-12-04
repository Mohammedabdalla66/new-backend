import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    client: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true
    },
    serviceProvider: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true
    },
    request: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Request',
      index: true
    },
    proposal: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Proposal',
      index: true
    },
    relatedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true
    },
    lastMessage: {
      text: String,
      timestamp: Date,
      sender: { type: String, enum: ['client', 'serviceProvider', 'admin'] }
    },
    unreadCount: {
      client: { type: Number, default: 0 },
      serviceProvider: { type: Number, default: 0 }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Compound index for efficient querying
chatSchema.index({ client: 1, serviceProvider: 1 });
chatSchema.index({ serviceProvider: 1, client: 1 });

export const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

