import { Booking } from '../models/Booking.js';
import { Proposal } from '../models/Proposal.js';
import { Request } from '../models/Request.js';
import { getIo } from '../sockets/socket.js';
import Notification from '../models/Notification.js';

export async function myBookings(req, res, next) {
  try {
    const docs = await Booking.find({ client: req.user.sub })
      .populate('serviceProvider', 'name')
      .populate('company', 'name') // Legacy support
      .sort('-createdAt');
    res.json(docs);
  } catch (err) { next(err); }
}

export async function getBooking(req, res, next) {
  try {
    const doc = await Booking.findOne({ _id: req.params.id, client: req.user.sub })
      .populate('serviceProvider', 'name')
      .populate('company', 'name'); // Legacy support
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
}

export async function cancelBooking(req, res, next) {
  try {
    const doc = await Booking.findOne({ _id: req.params.id, client: req.user.sub });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status === 'completed') return res.status(400).json({ message: 'Cannot cancel completed booking' });
    doc.status = 'canceled';
    await doc.save();
    res.json(doc);
  } catch (err) { next(err); }
}

// Client accepts a proposal and creates a booking
export async function acceptProposal(req, res, next) {
  try {
    const { proposalId } = req.params;
    const proposal = await Proposal.findById(proposalId).populate('request');
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    if (proposal.status !== 'active') return res.status(400).json({ message: 'Proposal is not available. Only approved proposals can be accepted.' });
    
    const request = proposal.request;
    if (request.client.toString() !== req.user.sub) {
      return res.status(403).json({ message: 'You can only accept proposals for your own requests' });
    }
    
    // Check if booking already exists for this request
    const existingBooking = await Booking.findOne({ request: request._id, status: { $ne: 'canceled' } });
    if (existingBooking) return res.status(400).json({ message: 'Request already has an active booking' });
    
    // Hold funds in client's wallet (escrow)
    const { hold } = await import('../controllers/walletController.js');
    const { Wallet } = await import('../models/Wallet.js');
    const { Transaction } = await import('../models/Transaction.js');
    
    let wallet = await Wallet.findOne({ owner: req.user.sub });
    if (!wallet) wallet = await Wallet.create({ owner: req.user.sub, balance: 0 });
    
    if (wallet.balance < proposal.price) {
      return res.status(400).json({ 
        message: 'Insufficient wallet balance', 
        required: proposal.price,
        available: wallet.balance 
      });
    }
    
    // Deduct from wallet balance and create hold transaction
    wallet.balance -= proposal.price;
    await wallet.save();
    
    const holdTransaction = await Transaction.create({
      wallet: wallet._id,
      type: 'hold',
      amount: proposal.price,
      description: `Escrow hold for request "${request.title}" - Proposal ${proposalId}`,
      status: 'completed',
      data: { requestId: request._id.toString(), proposalId: proposalId, bookingId: null }, // Will update after booking creation
    });
    
    // Create booking
    const serviceProviderId = proposal.serviceProvider || proposal.company; // Support both
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + proposal.durationDays);
    
    const booking = await Booking.create({
      client: req.user.sub,
      serviceProvider: serviceProviderId,
      company: serviceProviderId, // Legacy field
      request: request._id,
      proposal: {
        price: proposal.price,
        duration: `${proposal.durationDays} days`,
        notes: proposal.notes,
      },
      projectTitle: request.title,
      providerId: serviceProviderId,
      offerId: proposal._id,
      status: 'pending',
      deadline: deadline,
      paymentStatus: 'held',
      timeline: [{
        event: 'submitted',
        date: request.createdAt || new Date(),
        description: 'Request submitted by client',
      }, {
        event: 'offer_accepted',
        date: new Date(),
        description: 'Client accepted the proposal',
      }],
    });
    
    // Update transaction with booking ID
    holdTransaction.data.bookingId = booking._id.toString();
    await holdTransaction.save();
    
    // Update proposal status
    proposal.status = 'accepted';
    await proposal.save();
    
    // Reject other pending proposals for this request
    await Proposal.updateMany(
      { request: request._id, _id: { $ne: proposalId }, status: 'pending' },
      { status: 'rejected' }
    );
    
    // Update request status
    request.status = 'in-progress';
    await request.save();
    
    // Send notification to service provider
    const io = getIo();
    const notification = await Notification.create({
      user: serviceProviderId,
      title: 'Proposal Accepted',
      Message: `Your proposal for "${request.title}" has been accepted by the client. A booking has been created.`,
      link: `/bookings/${booking._id}`,
      data: { bookingId: booking._id, proposalId: proposal._id, requestId: request._id },
    });
    
    // Emit socket notification
    io.to(serviceProviderId.toString()).emit('newNotification', {
      id: notification._id,
      title: notification.title,
      message: notification.Message,
      link: notification.link,
      timestamp: notification.createdAt,
    });
    
    // Populate booking for response
    await booking.populate('serviceProvider', 'name email');
    await booking.populate('request', 'title');
    
    res.status(201).json({ 
      success: true, 
      data: booking,
      walletBalance: wallet.balance,
      holdTransaction: {
        id: holdTransaction._id,
        amount: holdTransaction.amount,
        type: holdTransaction.type,
      }
    });
  } catch (err) { 
    console.error('Error accepting proposal:', err);
    next(err); 
  }
}


