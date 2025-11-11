import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    type: { type: String, enum: ['deposit', 'hold', 'release', 'refund', 'payment'], required: true },
    amount: { type: Number, required: true },
    description: String,
    status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);


