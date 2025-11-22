import { User } from '../models/User.js';
import { Request } from '../models/Request.js';
import { Booking } from '../models/Booking.js';
import { Proposal } from '../models/Proposal.js';
import { Message } from '../models/Message.js';
import { Transaction } from '../models/Transaction.js';
import { Wallet } from '../models/Wallet.js';
import Notification from '../models/Notification.js';
import { getIo } from '../sockets/socket.js';
import mongoose from 'mongoose';

export async function listUsers(req, res, next) {
  try {
    const { role, q, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status; // Filter by user status (pending/active)
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];
    const users = await User.find(filter).select('-password').limit(200).sort('-createdAt');
    res.json(users);
  } catch (err) { next(err); }
}

export async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['client', 'serviceProvider', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (err) { next(err); }
}

export async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Only allow updating specific fields
    const allowedFields = ['verified', 'role', 'name', 'email', 'phone'];
    const updateData = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = updates[key];
      }
    });
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function listAllRequests(req, res, next) {
  try {
    const { status, q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (status) filter.status = status;
    
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
      .sort('-createdAt')
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

// List pending requests for admin review
export async function listPendingRequests(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    
    const filter = { status: 'pending' };
    
    const total = await Request.countDocuments(filter);
    const requests = await Request.find(filter)
      .populate('client', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      data: requests,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// Get single request with full details (for admin)
export async function getRequestForAdmin(req, res, next) {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request ID' 
      });
    }
    
    const request = await Request.findById(id)
      .populate('client', 'name email phone address')
      .lean();
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }
    
    res.json({
      success: true,
      data: request,
    });
  } catch (err) {
    next(err);
  }
}

// Approve request (change status to 'open')
export async function approveRequest(req, res, next) {
  try {
    const { id } = req.params;
    const request = await Request.findById(id).populate('client');
    
    if (!request) {
      return res.status(404).json({ 
        success: false,
        message: 'Request not found' 
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ 
        success: false,
        message: 'Only pending requests can be approved' 
      });
    }
    
    request.status = 'open';
    request.rejectionReason = ''; // Clear any previous rejection reason
    await request.save();
    
    // Notify client
    const io = getIo();
    const notification = await Notification.create({
      user: request.client._id,
      title: 'Request Approved',
      Message: `Your request "${request.title}" has been approved and is now visible to service providers.`,
      link: `/requests/${request._id}`,
      data: { requestId: request._id },
    });
    
    io.to(request.client._id.toString()).emit('newNotification', {
      id: notification._id,
      title: notification.title,
      message: notification.Message,
      link: notification.link,
      timestamp: notification.createdAt,
    });
    
    res.json({ 
      success: true, 
      data: request 
    });
  } catch (err) {
    next(err);
  }
}

// Reject request (change status to 'rejected' with reason)
export async function rejectRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Required rejection reason
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Rejection reason is required' 
      });
    }
    
    const request = await Request.findById(id).populate('client');
    
    if (!request) {
      return res.status(404).json({ 
        success: false,
        message: 'Request not found' 
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ 
        success: false,
        message: 'Only pending requests can be rejected' 
      });
    }
    
    request.status = 'rejected';
    request.rejectionReason = reason.trim();
    await request.save();
    
    // Notify client
    const io = getIo();
    const notification = await Notification.create({
      user: request.client._id,
      title: 'Request Rejected',
      Message: `Your request "${request.title}" has been rejected. Reason: ${reason}`,
      link: `/requests/${request._id}`,
      data: { requestId: request._id },
    });
    
    io.to(request.client._id.toString()).emit('newNotification', {
      id: notification._id,
      title: notification.title,
      message: notification.Message,
      link: notification.link,
      timestamp: notification.createdAt,
    });
    
    res.json({ 
      success: true, 
      data: request 
    });
  } catch (err) {
    next(err);
  }
}

export async function listAllBookings(req, res, next) {
  try {
    const docs = await Booking.find()
      .populate('client serviceProvider', 'name')
      .populate('company', 'name') // Legacy support
      .sort('-createdAt')
      .limit(200);
    res.json(docs);
  } catch (err) { next(err); }
}

export async function sendAdminNotification(req, res, next) {
  try {
    const { interests = [], title, message } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Missing title or message' });
    const io = getIo();
    if (Array.isArray(interests) && interests.length > 0) {
      io.to(interests).emit('notification', { title, message });
    }
    const notifications = [];
    // optional: persist without specific users
    const saved = await Notification.insertMany(notifications);
    res.json({ sent: true, rooms: interests, saved: saved.length });
  } catch (err) { next(err); }
}

// Get all service providers with pagination, filtering, and search
export async function listServiceProviders(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    const q = req.query.q || req.query.search || '';
    const status = req.query.status; // active|pending|inactive (based on verified field)
    const sort = req.query.sort || '-createdAt';
    
    const filter = { role: 'serviceProvider' };
    
    // Search filter
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { taxId: new RegExp(q, 'i') },
        { licenseNumber: new RegExp(q, 'i') },
      ];
    }
    
    // Status filter (map to verified field)
    if (status === 'active') {
      filter.verified = true;
    } else if (status === 'pending') {
      filter.verified = false;
    } else if (status === 'inactive') {
      // Could add an 'active' field or use verified=false for now
      filter.verified = false;
    }
    
    const total = await User.countDocuments(filter);
    const data = await User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const formatted = data.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      verified: user.verified || false,
      documentsCount: (user.documents || []).length,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
    
    res.json({
      success: true,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
}

// Get single service provider with aggregated data
export async function getServiceProvider(req, res, next) {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid service provider ID' });
    }
    
    const user = await User.findById(id)
      .select('-password')
      .lean();
    
    if (!user || user.role !== 'serviceProvider') {
      return res.status(404).json({ success: false, message: 'Service provider not found' });
    }
    
    // Get related data
    const proposals = await Proposal.find({ serviceProvider: id })
      .select('request')
      .lean();
    const requestIds = proposals.map(p => p.request?.toString()).filter(Boolean);
    
    const [requests, proposalsFull, transactions, messagesSummary] = await Promise.all([
      // Requests where this service provider submitted proposals
      Request.find({ _id: { $in: requestIds } })
        .populate('client', 'name email')
        .lean(),
      
      // Proposals (full details)
      Proposal.find({ serviceProvider: id })
        .populate('request', 'title description status')
        .sort('-createdAt')
        .limit(50)
        .lean(),
      
      // Transactions (from wallet)
      Wallet.findOne({ owner: id })
        .then(wallet => {
          if (!wallet) return [];
          return Transaction.find({ wallet: wallet._id })
            .sort('-createdAt')
            .limit(50)
            .lean();
        }),
      
      // Messages summary (last message per conversation)
      Message.aggregate([
        { $match: { serviceProvider: new mongoose.Types.ObjectId(id) } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$client',
            lastMessage: { $first: '$$ROOT' },
            unread: { $sum: { $cond: [{ $eq: ['$sender', 'client'] }, 1, 0] } },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'clientInfo',
          },
        },
        { $unwind: { path: '$clientInfo', preserveNullAndEmptyArrays: true } },
        { $limit: 20 },
      ]),
    ]);
    
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        verified: user.verified || false,
        taxId: user.taxId || '',
        licenseNumber: user.licenseNumber || '',
        documents: user.documents || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Aggregated data
        requestsSubmitted: requests.map(r => ({
          id: r._id,
          title: r.title,
          status: r.status,
          client: r.client,
        })),
        proposals: proposalsFull.map(p => ({
          id: p._id,
          requestId: p.request?._id,
          requestTitle: p.request?.title,
          price: p.price,
          durationDays: p.durationDays,
          status: p.status,
          createdAt: p.createdAt,
        })),
        transactions: transactions.map(t => ({
          id: t._id,
          amount: t.amount,
          type: t.type,
          status: t.status,
          description: t.description,
          date: t.createdAt,
        })),
        messagesSummary: messagesSummary.map(m => ({
          clientId: m._id,
          clientName: m.clientInfo?.name || 'Unknown',
          clientEmail: m.clientInfo?.email || '',
          lastMessage: m.lastMessage?.text || '',
          lastMessageDate: m.lastMessage?.createdAt,
          unread: m.unread || 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// List clients with pagination and search
export async function listClients(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    const q = req.query.q || req.query.search || '';
    const sort = req.query.sort || '-createdAt';
    
    const filter = { role: 'client' };
    
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ];
    }
    
    const total = await User.countDocuments(filter);
    const data = await User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const formatted = data.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      verified: user.verified || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
    
    res.json({
      success: true,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
}

// Get single client with aggregated data
export async function getClient(req, res, next) {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid client ID' });
    }
    
    const user = await User.findById(id)
      .select('-password')
      .lean();
    
    if (!user || user.role !== 'client') {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    // Get related data
    const [wallet, requests, proposals, messagesSummary] = await Promise.all([
      // Wallet
      Wallet.findOne({ owner: id }).lean(),
      
      // Requests
      Request.find({ client: id })
        .sort('-createdAt')
        .limit(50)
        .lean(),
      
      // Proposals (accepted proposals for client's requests)
      Proposal.find({ request: { $in: await Request.find({ client: id }).distinct('_id') } })
        .populate('serviceProvider', 'name email')
        .populate('request', 'title')
        .sort('-createdAt')
        .limit(50)
        .lean(),
      
      // Messages summary
      Message.aggregate([
        { $match: { client: new mongoose.Types.ObjectId(id) } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$serviceProvider',
            lastMessage: { $first: '$$ROOT' },
            unread: { $sum: { $cond: [{ $eq: ['$sender', 'serviceProvider'] }, 1, 0] } },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'serviceProviderInfo',
          },
        },
        { $unwind: { path: '$serviceProviderInfo', preserveNullAndEmptyArrays: true } },
        { $limit: 20 },
      ]),
    ]);
    
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        verified: user.verified || false,
        address: user.address || '',
        nationality: user.nationality || '',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Aggregated data
        wallet: {
          balance: wallet?.balance || 0,
          walletId: wallet?._id,
        },
        requests: requests.map(r => ({
          id: r._id,
          title: r.title,
          status: r.status,
          budget: r.budget,
          createdAt: r.createdAt,
        })),
        proposals: proposals.map(p => ({
          id: p._id,
          requestId: p.request?._id,
          requestTitle: p.request?.title,
          serviceProvider: p.serviceProvider,
          price: p.price,
          status: p.status,
          createdAt: p.createdAt,
        })),
        messagesSummary: messagesSummary.map(m => ({
          serviceProviderId: m._id,
          serviceProviderName: m.serviceProviderInfo?.name || 'Unknown',
          serviceProviderEmail: m.serviceProviderInfo?.email || '',
          lastMessage: m.lastMessage?.text || '',
          lastMessageDate: m.lastMessage?.createdAt,
          unread: m.unread || 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// List transactions with pagination and filters
export async function listTransactions(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    const type = req.query.type; // deposit|hold|release|refund|payment
    const status = req.query.status; // completed|pending|failed
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const sort = req.query.sort || '-createdAt';
    
    const filter = {};
    
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }
    
    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .populate('wallet', 'owner')
      .populate({
        path: 'wallet',
        populate: { path: 'owner', select: 'name email role' },
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const formatted = transactions.map(t => ({
      _id: t._id,
      transactionId: `TXN-${t._id.toString().slice(-8).toUpperCase()}`,
      partyName: t.wallet?.owner?.name || 'Unknown',
      partyEmail: t.wallet?.owner?.email || '',
      partyRole: t.wallet?.owner?.role || 'unknown',
      amount: t.amount,
      type: t.type,
      status: t.status,
      description: t.description || '',
      datetime: t.createdAt,
    }));
    
    res.json({
      success: true,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
}

// Daily report with aggregated stats
export async function dailyReport(req, res, next) {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const [
      totalUsers,
      totalServiceProviders,
      totalClients,
      totalRequests,
      totalBookings,
      totalTransactions,
      revenue,
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      User.countDocuments({ role: 'serviceProvider', createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      User.countDocuments({ role: 'client', createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Request.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Booking.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Transaction.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            status: 'completed',
            type: { $in: ['deposit', 'payment', 'release'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]),
    ]);
    
    res.json({
      success: true,
      data: {
        date: startOfDay.toISOString().split('T')[0],
        counts: {
          users: totalUsers,
          serviceProviders: totalServiceProviders,
          clients: totalClients,
          requests: totalRequests,
          bookings: totalBookings,
          transactions: totalTransactions,
        },
        revenue: revenue[0]?.total || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Update user status (activate/deactivate)
export async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'active'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status. Must be "pending" or "active"' 
      });
    }
    
    const user = await User.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Send notification to user if activated
    if (status === 'active') {
      const io = getIo();
      const notification = await Notification.create({
        user: user._id,
        title: 'Account Activated',
        Message: 'Your account has been activated by admin. You can now log in.',
        link: '/auth/login',
        data: { userId: user._id },
      });
      
      io.to(user._id.toString()).emit('newNotification', {
        id: notification._id,
        title: notification.title,
        message: notification.Message,
        link: notification.link,
        timestamp: notification.createdAt,
      });
    }
    
    res.json({ 
      success: true, 
      data: user 
    });
  } catch (err) {
    next(err);
  }
}

// Approve proposal (set status to 'active')
export async function approveProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id).populate('request serviceProvider');
    
    if (!proposal) {
      return res.status(404).json({ 
        success: false,
        message: 'Proposal not found' 
      });
    }
    
    proposal.status = 'active';
    await proposal.save();
    
    // Notify client
    const io = getIo();
    const notification = await Notification.create({
      user: proposal.request.client,
      title: 'Proposal Approved',
      Message: `A proposal for your request "${proposal.request.title}" has been approved by admin.`,
      link: `/requests/${proposal.request._id}/proposals`,
      data: { requestId: proposal.request._id, proposalId: proposal._id },
    });
    
    io.to(proposal.request.client.toString()).emit('newNotification', {
      id: notification._id,
      title: notification.title,
      message: notification.Message,
      link: notification.link,
      timestamp: notification.createdAt,
    });
    
    // Notify service provider
    const spNotification = await Notification.create({
      user: proposal.serviceProvider._id,
      title: 'Proposal Approved',
      Message: `Your proposal for "${proposal.request.title}" has been approved by admin.`,
      link: `/proposals/${proposal._id}`,
      data: { proposalId: proposal._id, requestId: proposal.request._id },
    });
    
    io.to(proposal.serviceProvider._id.toString()).emit('newNotification', {
      id: spNotification._id,
      title: spNotification.title,
      message: spNotification.Message,
      link: spNotification.link,
      timestamp: spNotification.createdAt,
    });
    
    res.json({ 
      success: true, 
      data: proposal 
    });
  } catch (err) {
    next(err);
  }
}

// Reject proposal (set status to 'rejected')
export async function rejectProposal(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Optional rejection reason
    const proposal = await Proposal.findById(id).populate('request serviceProvider');
    
    if (!proposal) {
      return res.status(404).json({ 
        success: false,
        message: 'Proposal not found' 
      });
    }
    
    proposal.status = 'rejected';
    await proposal.save();
    
    // Notify service provider
    const io = getIo();
    const notification = await Notification.create({
      user: proposal.serviceProvider._id,
      title: 'Proposal Rejected',
      Message: `Your proposal for "${proposal.request.title}" has been rejected by admin.${reason ? ` Reason: ${reason}` : ''}`,
      link: `/proposals/${proposal._id}`,
      data: { proposalId: proposal._id, requestId: proposal.request._id },
    });
    
    io.to(proposal.serviceProvider._id.toString()).emit('newNotification', {
      id: notification._id,
      title: notification.title,
      message: notification.Message,
      link: notification.link,
      timestamp: notification.createdAt,
    });
    
    res.json({ 
      success: true, 
      data: proposal 
    });
  } catch (err) {
    next(err);
  }
}

// List pending proposals for admin review
export async function listPendingProposals(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    
    const filter = { status: 'pending' };
    
    const total = await Proposal.countDocuments(filter);
    const proposals = await Proposal.find(filter)
      .populate('request', 'title description budget client')
      .populate('request.client', 'name email')
      .populate('serviceProvider', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      data: proposals,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// Create sub-admin
export async function createSubAdmin(req, res, next) {
  try {
    const { name, email, password, permissions = [] } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }
    
    // Check if user already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }
    
    // Create sub-admin user (role remains 'admin' but can have permissions field)
    const subAdmin = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin',
      verified: true,
      // Store permissions if needed (could add permissions field to User model)
    });
    
    res.status(201).json({
      success: true,
      message: 'Sub-admin created successfully',
      data: {
        _id: subAdmin._id,
        name: subAdmin.name,
        email: subAdmin.email,
        role: subAdmin.role,
        createdAt: subAdmin.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}


