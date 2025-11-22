import { Wallet } from '../models/Wallet.js';
import { Transaction } from '../models/Transaction.js';
import mongoose from 'mongoose';

async function ensureWallet(userId) {
  // Convert string to ObjectId if needed
  const ownerId = mongoose.Types.ObjectId.isValid(userId) 
    ? (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId)
    : userId;
  
  let wallet = await Wallet.findOne({ owner: ownerId });
  if (!wallet) {
    wallet = await Wallet.create({ owner: ownerId, balance: 0 });
  }
  return wallet;
}

export async function getWallet(req, res, next) {
  try {
    const wallet = await ensureWallet(req.user.sub);
    const tx = await Transaction.find({ wallet: wallet._id }).sort('-createdAt').limit(50);
    res.json({ balance: wallet.balance, transactions: tx });
  } catch (err) { next(err); }
}

export async function deposit(req, res, next) {
  try {
    const { amount } = req.body;
    const wallet = await ensureWallet(req.user.sub);
    wallet.balance += Number(amount || 0);
    await wallet.save();
    await Transaction.create({ wallet: wallet._id, type: 'deposit', amount, description: 'Funds Added', status: 'completed' });
    res.json({ balance: wallet.balance });
  } catch (err) { next(err); }
}

export async function hold(req, res, next) {
  try {
    const { amount, requestId } = req.body;
    const wallet = await ensureWallet(req.user.sub);
    if (wallet.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
    wallet.balance -= Number(amount);
    await wallet.save();
    await Transaction.create({ wallet: wallet._id, type: 'hold', amount, description: `Escrow for request ${requestId}`, status: 'completed' });
    res.json({ balance: wallet.balance });
  } catch (err) { next(err); }
}

export async function release(req, res, next) {
  try {
    const { amount, requestId } = req.body;
    await Transaction.create({ wallet: (await ensureWallet(req.user.sub))._id, type: 'release', amount, description: `Release to service provider for request ${requestId}`, status: 'completed' });
    res.json({ message: 'Released' });
  } catch (err) { next(err); }
}

export async function refund(req, res, next) {
  try {
    const { amount, requestId } = req.body;
    const wallet = await ensureWallet(req.user.sub);
    wallet.balance += Number(amount);
    await wallet.save();
    await Transaction.create({ wallet: wallet._id, type: 'refund', amount, description: `Refund for request ${requestId}`, status: 'completed' });
    res.json({ balance: wallet.balance });
  } catch (err) { next(err); }
}

// Service Provider wallet endpoint
export async function getServiceProviderWallet(req, res, next) {
  try {
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ message: 'Unauthorized: No user ID found' });
    }
    
    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(req.user.sub)) {
      return res.status(400).json({ 
        message: 'Invalid user ID format',
        userId: req.user.sub 
      });
    }
    
    const wallet = await ensureWallet(req.user.sub);
    
    // Get all transactions
    const allTransactions = await Transaction.find({ wallet: wallet._id }).sort('-createdAt');
    
    // Calculate pending payouts (transactions with status 'pending' and type 'payment' or 'release')
    const pendingPayouts = allTransactions
      .filter(tx => tx.status === 'pending' && (tx.type === 'payment' || tx.type === 'release'))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    
    // Get recent transactions (last 50)
    const recentTransactions = allTransactions.slice(0, 50);
    
    res.json({ 
      success: true,
      data: {
        balance: wallet.balance,
        pendingPayouts,
        availableBalance: wallet.balance,
        transactions: recentTransactions,
        totalTransactions: allTransactions.length,
      }
    });
  } catch (err) {
    console.error('Error in getServiceProviderWallet:', err);
    // If it's a validation error, return 400
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        error: err.message 
      });
    }
    next(err);
  }
}


