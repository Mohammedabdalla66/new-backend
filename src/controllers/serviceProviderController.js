import { Request } from '../models/Request.js';
import { Booking } from '../models/Booking.js';
import { Proposal } from '../models/Proposal.js';
import { Message } from '../models/Message.js';
import { Wallet } from '../models/Wallet.js';

export async function listRequests(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const q = req.query.q || req.query.search || '';
    const sort = req.query.sort || '-createdAt';
    
    const filter = {};
    
    // Default: show only open requests (pending requests are not visible until admin approves)
    if (status && status !== 'all') {
      filter.status = status;
    } else {
      filter.status = { $in: ['open'] }; // Only show open requests to service providers
    }
    
    // Search filter
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
      ];
    }
    
    const total = await Request.countDocuments(filter);
    const docs = await Request.find(filter)
      .populate('client', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      data: docs,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
}

export async function getRequestForServiceProvider(req, res, next) {
  try {
    const doc = await Request.findById(req.params.id)
      .populate('client', 'name email avatar');
    if (!doc) return res.status(404).json({ message: 'Request not found' });
    
    // Check if provider already submitted a proposal
    const { Proposal } = await import('../models/Proposal.js');
    const existingProposal = await Proposal.findOne({
      request: req.params.id,
      $or: [
        { serviceProvider: req.user.sub },
        { company: req.user.sub }
      ],
      status: { $ne: 'canceled' }
    });
    
    // Get active proposals count for this request (service providers can see how many active proposals exist)
    const activeProposalsCount = await Proposal.countDocuments({
      request: req.params.id,
      status: 'active'
    });
    
    res.json({
      success: true,
      data: {
        ...doc.toObject(),
        hasProposal: !!existingProposal,
        proposalId: existingProposal?._id,
        activeProposalsCount,
      },
    });
  } catch (err) { next(err); }
}

export async function listMyBookings(req, res, next) {
  try {
    const docs = await Booking.find({ serviceProvider: req.user.sub })
      .populate('client', 'name')
      .populate('request', 'title')
      .sort('-createdAt');
    res.json(docs);
  } catch (err) { next(err); }
}

export async function transitionBooking(req, res, next) {
  try {
    const { id, action } = req.params;
    const booking = await Booking.findOne({ _id: id, serviceProvider: req.user.sub });
    if (!booking) return res.status(404).json({ message: 'Not found' });
    const allowed = new Set(['accept', 'start', 'complete']);
    if (!allowed.has(action)) return res.status(400).json({ message: 'Invalid action' });
    if (action === 'accept' && booking.status === 'pending') booking.status = 'active';
    else if (action === 'start' && booking.status === 'active') booking.status = 'active';
    else if (action === 'complete' && booking.status === 'active') booking.status = 'completed';
    else return res.status(400).json({ message: 'Invalid status transition' });
    await booking.save();
    res.json(booking);
  } catch (err) { next(err); }
}

// Get dashboard statistics for service provider
export async function getDashboardStats(req, res, next) {
  try {
    console.log('📊 getDashboardStats called for service provider:', req.user.sub);
    const serviceProviderId = req.user.sub;
    
    if (!serviceProviderId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    // Count requests by status
    const pendingRequests = await Request.countDocuments({ status: 'pending' });
    const openRequests = await Request.countDocuments({ status: 'open' });
    const inProgressRequests = await Request.countDocuments({ status: 'in-progress' });
    const completedRequests = await Request.countDocuments({ status: 'completed' });
    const cancelledRequests = await Request.countDocuments({ status: 'canceled' });
    
    // Count my proposals
    const myProposals = await Proposal.countDocuments({
      $or: [
        { serviceProvider: serviceProviderId },
        { company: serviceProviderId }
      ],
      status: { $ne: 'canceled' }
    });
    
    // Count my bookings
    const myBookings = await Booking.countDocuments({
      serviceProvider: serviceProviderId,
      status: { $ne: 'canceled' }
    });
    
    // Count active bookings
    const activeBookings = await Booking.countDocuments({
      serviceProvider: serviceProviderId,
      status: 'active'
    });
    
    // Count completed bookings
    const completedBookings = await Booking.countDocuments({
      serviceProvider: serviceProviderId,
      status: 'completed'
    });
    
    // Get wallet balance
    const wallet = await Wallet.findOne({ owner: serviceProviderId });
    const earnings = wallet?.balance || 0;
    
    // Count unread messages using Chat model (preferred method)
    let unreadMessages = 0;
    try {
      const { Chat } = await import('../models/Chat.js');
      const chats = await Chat.find({ serviceProvider: serviceProviderId });
      unreadMessages = chats.reduce((sum, chat) => {
        return sum + (chat.unreadCount?.serviceProvider || 0);
      }, 0);
      console.log(`📨 Found ${unreadMessages} unread messages from ${chats.length} chats`);
    } catch (chatError) {
      console.error('Error counting unread messages from Chat:', chatError);
      // Fallback: count messages without readAt (legacy method)
      try {
        unreadMessages = await Message.countDocuments({
          serviceProvider: serviceProviderId,
          sender: 'client',
          readAt: { $exists: false }
        });
        console.log(`📨 Fallback: Found ${unreadMessages} unread messages from Message model`);
      } catch (msgError) {
        console.error('Error counting unread messages from Message:', msgError);
        unreadMessages = 0;
      }
    }
    
    // Get proposal counts
    const pendingProposals = await Proposal.countDocuments({
      $or: [{ serviceProvider: serviceProviderId }, { company: serviceProviderId }],
      status: 'pending'
    });
    const activeProposals = await Proposal.countDocuments({
      $or: [{ serviceProvider: serviceProviderId }, { company: serviceProviderId }],
      status: 'active'
    });
    const acceptedProposals = await Proposal.countDocuments({
      $or: [{ serviceProvider: serviceProviderId }, { company: serviceProviderId }],
      status: 'accepted'
    });
    
    const stats = {
      requests: {
        pending: pendingRequests,
        open: openRequests,
        inProgress: inProgressRequests,
        completed: completedRequests,
        cancelled: cancelledRequests,
        total: pendingRequests + openRequests + inProgressRequests + completedRequests + cancelledRequests
      },
      proposals: {
        total: myProposals,
        pending: pendingProposals,
        active: activeProposals,
        accepted: acceptedProposals
      },
      bookings: {
        total: myBookings,
        active: activeBookings,
        completed: completedBookings
      },
      earnings,
      messages: {
        unread: unreadMessages
      }
    };
    
    console.log('📊 Dashboard stats calculated:', JSON.stringify(stats, null, 2));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('❌ Error in getDashboardStats:', err);
    next(err);
  }
}


