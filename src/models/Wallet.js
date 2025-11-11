import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model('Wallet', walletSchema);


