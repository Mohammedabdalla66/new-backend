import { Wallet } from '../models/Wallet.js';
import { Transaction } from '../models/Transaction.js';

async function ensureWallet(userId) {
  let wallet = await Wallet.findOne({ owner: userId });
  if (!wallet) wallet = await Wallet.create({ owner: userId, balance: 0 });
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
    await Transaction.create({ wallet: (await ensureWallet(req.user.sub))._id, type: 'release', amount, description: `Release to company for request ${requestId}`, status: 'completed' });
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


