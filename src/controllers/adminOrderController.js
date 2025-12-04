import { Booking } from '../models/Booking.js';
import { Request } from '../models/Request.js';
import { Proposal } from '../models/Proposal.js';
import { User } from '../models/User.js';
import { Message } from '../models/Message.js';
import { Chat } from '../models/Chat.js';
import { Transaction } from '../models/Transaction.js';
import { Wallet } from '../models/Wallet.js';
import { getIo } from '../sockets/socket.js';
import mongoose from 'mongoose';

// Calculate risk score for an order
async function calculateRiskScore(booking) {
  let riskScore = 0;
  const riskFactors = [];

  try {
    // Get related data
    const [request, proposal, messages, transactions] = await Promise.all([
      Request.findById(booking.request).lean(),
      Proposal.findById(booking.offerId || booking.proposal?._id).lean(),
      Message.find({
        $or: [
          { client: booking.client, serviceProvider: booking.serviceProvider },
          { serviceProvider: booking.serviceProvider, client: booking.client }
        ]
      }).sort('-createdAt').limit(50).lean(),
      Transaction.find({ 
        wallet: { $in: await Wallet.find({ owner: { $in: [booking.client, booking.serviceProvider] } }).distinct('_id') }
      }).sort('-createdAt').limit(20).lean(),
    ]);

    // Factor 1: Delayed provider messages (check last message time)
    if (messages.length > 0) {
      const lastProviderMessage = messages.find(m => m.sender === 'serviceProvider');
      if (lastProviderMessage) {
        const hoursSinceLastMessage = (Date.now() - new Date(lastProviderMessage.createdAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastMessage > 48) {
          riskScore += 15;
          riskFactors.push({ factor: 'delayed_provider_response', severity: 'medium', details: `No provider response in ${Math.floor(hoursSinceLastMessage)} hours` });
        } else if (hoursSinceLastMessage > 24) {
          riskScore += 8;
          riskFactors.push({ factor: 'delayed_provider_response', severity: 'low', details: `Provider response delayed by ${Math.floor(hoursSinceLastMessage)} hours` });
        }
      }
    }

    // Factor 2: Delayed delivery (check deadline)
    if (booking.deadline) {
      const daysUntilDeadline = (new Date(booking.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 0) {
        riskScore += 25;
        riskFactors.push({ factor: 'deadline_passed', severity: 'high', details: 'Deadline has passed' });
      } else if (daysUntilDeadline < 2) {
        riskScore += 12;
        riskFactors.push({ factor: 'deadline_approaching', severity: 'medium', details: `Deadline in ${Math.floor(daysUntilDeadline)} days` });
      }
    }

    // Factor 3: Large price with short deadline
    if (proposal && booking.deadline) {
      const price = proposal.price || booking.proposal?.price || 0;
      const daysDuration = (new Date(booking.deadline).getTime() - new Date(booking.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (price > 5000 && daysDuration < 7) {
        riskScore += 10;
        riskFactors.push({ factor: 'high_value_short_deadline', severity: 'medium', details: `High value (${price}) with short deadline (${Math.floor(daysDuration)} days)` });
      }
    }

    // Factor 4: Suspicious communication patterns (large time gaps)
    if (messages.length > 2) {
      const gaps = [];
      for (let i = 1; i < messages.length; i++) {
        const gap = (new Date(messages[i].createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (gap > 7) {
          gaps.push(gap);
        }
      }
      if (gaps.length > 2) {
        riskScore += 8;
        riskFactors.push({ factor: 'irregular_communication', severity: 'low', details: 'Multiple large gaps in communication' });
      }
    }

    // Factor 5: Check for off-platform payment keywords in messages
    const suspiciousKeywords = ['paypal', 'bank transfer', 'direct payment', 'outside platform', 'cash', 'wire transfer'];
    const suspiciousMessages = messages.filter(m => {
      const text = (m.text || '').toLowerCase();
      return suspiciousKeywords.some(keyword => text.includes(keyword));
    });
    if (suspiciousMessages.length > 0) {
      riskScore += 20;
      riskFactors.push({ factor: 'off_platform_payment_mention', severity: 'high', details: 'Possible off-platform payment discussion detected' });
    }

    // Factor 6: Check for refund requests in messages
    const refundKeywords = ['refund', 'money back', 'cancel payment', 'return payment'];
    const refundMessages = messages.filter(m => {
      const text = (m.text || '').toLowerCase();
      return refundKeywords.some(keyword => text.includes(keyword));
    });
    if (refundMessages.length > 0) {
      riskScore += 15;
      riskFactors.push({ factor: 'refund_request', severity: 'medium', details: 'Refund requests detected in conversation' });
    }

    // Factor 7: Payment status issues
    if (booking.paymentStatus === 'failed') {
      riskScore += 15;
      riskFactors.push({ factor: 'payment_failed', severity: 'high', details: 'Payment transaction failed' });
    }

    // Factor 8: Suspended status
    if (booking.status === 'suspended') {
      riskScore += 30;
      riskFactors.push({ factor: 'order_suspended', severity: 'critical', details: 'Order has been suspended' });
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

  } catch (error) {
    console.error('Error calculating risk score:', error);
  }

  return { riskScore, riskFactors };
}

// GET /api/admin/orders/in-progress
export async function getInProgressOrders(req, res, next) {
  try {
    const { page = 1, limit = 25, q = '', sort = '-createdAt' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filter for in-progress orders (status = 'active' or 'in-progress')
    const filter = {
      status: { $in: ['active', 'in-progress', 'pending-review'] }
    };

    // Search filter
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const clientIds = await User.find({ 
        role: 'client', 
        $or: [{ name: searchRegex }, { email: searchRegex }] 
      }).distinct('_id');
      
      const providerIds = await User.find({ 
        role: 'serviceProvider', 
        $or: [{ name: searchRegex }, { email: searchRegex }] 
      }).distinct('_id');

      const requestIds = await Request.find({ 
        $or: [{ title: searchRegex }, { description: searchRegex }] 
      }).distinct('_id');

      filter.$or = [
        { client: { $in: clientIds } },
        { serviceProvider: { $in: providerIds } },
        { request: { $in: requestIds } },
        { projectTitle: searchRegex },
        ...(mongoose.Types.ObjectId.isValid(q) ? [{ _id: new mongoose.Types.ObjectId(q) }] : [])
      ].filter(Boolean);
    }

    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .populate('client', 'name email phone verified')
      .populate('serviceProvider', 'name email phone verified')
      .populate('request', 'title description budget deadline')
      .populate('offerId', 'price durationDays notes attachments')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Calculate risk scores for each booking
    const bookingsWithRisk = await Promise.all(
      bookings.map(async (booking) => {
        const riskData = await calculateRiskScore(booking);
        return {
          ...booking,
          riskScore: booking.riskScore || riskData.riskScore,
          riskFactors: riskData.riskFactors || [],
        };
      })
    );

    res.json({
      success: true,
      data: bookingsWithRisk,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/orders/:orderId
export async function getOrderDetails(req, res, next) {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const booking = await Booking.findById(orderId)
      .populate('client', 'name email phone verified avatar address nationality')
      .populate('serviceProvider', 'name email phone verified avatar taxId licenseNumber documents')
      .populate('request', 'title description budget deadline attachments legalForm businessActivity registeredCapital estimatedRevenue estimatedExpenses')
      .populate('offerId', 'price durationDays notes attachments status createdAt')
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Get chat/conversation
    const chat = await Chat.findOne({
      client: booking.client._id || booking.client,
      serviceProvider: booking.serviceProvider._id || booking.serviceProvider,
      request: booking.request._id || booking.request,
    }).lean();

    // Get messages
    const messages = chat ? await Message.find({ 
      conversationId: chat._id 
    })
      .populate('client', 'name email')
      .populate('serviceProvider', 'name email')
      .sort('createdAt')
      .lean() : [];

    // Get payment/transaction history
    const wallets = await Wallet.find({
      owner: { $in: [booking.client._id || booking.client, booking.serviceProvider._id || booking.serviceProvider] }
    }).distinct('_id');

    const transactions = await Transaction.find({ wallet: { $in: wallets } })
      .populate('wallet', 'owner')
      .sort('-createdAt')
      .limit(50)
      .lean();

    // Calculate risk score
    const riskData = await calculateRiskScore(booking);

    // Get client history (other bookings)
    const clientBookings = await Booking.find({ 
      client: booking.client._id || booking.client,
      _id: { $ne: booking._id }
    })
      .populate('serviceProvider', 'name')
      .populate('request', 'title')
      .sort('-createdAt')
      .limit(10)
      .lean();

    // Get provider history (other bookings)
    const providerBookings = await Booking.find({ 
      serviceProvider: booking.serviceProvider._id || booking.serviceProvider,
      _id: { $ne: booking._id }
    })
      .populate('client', 'name')
      .populate('request', 'title')
      .sort('-createdAt')
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        ...booking,
        riskScore: booking.riskScore || riskData.riskScore,
        riskFactors: riskData.riskFactors || [],
        chat: chat || null,
        messages: messages || [],
        transactions: transactions || [],
        clientHistory: clientBookings || [],
        providerHistory: providerBookings || [],
      },
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/orders/:orderId/status
export async function updateOrderStatus(req, res, next) {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const adminId = req.user.sub;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const validStatuses = ['pending', 'active', 'in-progress', 'pending-review', 'suspended', 'completed', 'canceled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const booking = await Booking.findById(orderId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const oldStatus = booking.status;
    booking.status = status;

    // Add timeline event
    booking.timeline.push({
      event: `status_changed_to_${status}`,
      date: new Date(),
      description: `Status changed from ${oldStatus} to ${status} by admin`,
    });

    // Add history log
    booking.historyLogs.push({
      action: 'status_changed',
      adminId: adminId,
      timestamp: new Date(),
      details: `Changed from ${oldStatus} to ${status}`,
    });

    await booking.save();

    // Emit socket event
    const io = getIo();
    io.emit('adminOrderUpdated', {
      orderId: booking._id,
      status: booking.status,
      timestamp: new Date(),
    });

    io.emit('adminStatusChanged', {
      orderId: booking._id,
      oldStatus,
      newStatus: status,
      adminId,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/orders/:orderId/system-message
export async function sendSystemMessage(req, res, next) {
  try {
    const { orderId } = req.params;
    const { message } = req.body;
    const adminId = req.user.sub;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const booking = await Booking.findById(orderId)
      .populate('client')
      .populate('serviceProvider');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Find or create chat
    let chat = await Chat.findOne({
      client: booking.client._id || booking.client,
      serviceProvider: booking.serviceProvider._id || booking.serviceProvider,
      request: booking.request,
    });

    if (!chat) {
      chat = await Chat.create({
        client: booking.client._id || booking.client,
        serviceProvider: booking.serviceProvider._id || booking.serviceProvider,
        request: booking.request,
        proposal: booking.offerId,
      });
    }

    // Create system message
    const systemMessage = await Message.create({
      conversationId: chat._id,
      client: booking.client._id || booking.client,
      serviceProvider: booking.serviceProvider._id || booking.serviceProvider,
      sender: 'admin', // Special sender type for admin messages
      text: `[SYSTEM MESSAGE - Admin]: ${message.trim()}`,
      readAt: null,
    });

    // Update chat
    chat.lastMessage = {
      text: systemMessage.text,
      timestamp: systemMessage.createdAt,
      sender: 'admin',
    };
    await chat.save();

    // Add history log
    booking.historyLogs.push({
      action: 'admin_message',
      adminId: adminId,
      timestamp: new Date(),
      details: message.trim(),
    });
    await booking.save();

    // Emit socket events
    const io = getIo();
    const clientId = (booking.client._id || booking.client).toString();
    const providerId = (booking.serviceProvider._id || booking.serviceProvider).toString();

    io.to(clientId).emit('adminMessageSent', {
      orderId: booking._id,
      message: systemMessage,
      timestamp: new Date(),
    });

    io.to(providerId).emit('adminMessageSent', {
      orderId: booking._id,
      message: systemMessage,
      timestamp: new Date(),
    });

    io.emit('adminOrderUpdated', {
      orderId: booking._id,
      type: 'message_added',
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: systemMessage,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/orders/:orderId/risk/recalculate
export async function recalculateRiskScore(req, res, next) {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const booking = await Booking.findById(orderId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const riskData = await calculateRiskScore(booking);
    booking.riskScore = riskData.riskScore;
    await booking.save();

    // Emit socket event
    const io = getIo();
    io.emit('orderRiskUpdated', {
      orderId: booking._id,
      riskScore: booking.riskScore,
      riskFactors: riskData.riskFactors,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: {
        riskScore: booking.riskScore,
        riskFactors: riskData.riskFactors,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/orders/:orderId/warning
export async function addWarning(req, res, next) {
  try {
    const { orderId } = req.params;
    const { target, message } = req.body;
    const adminId = req.user.sub;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    if (!['client', 'provider'].includes(target)) {
      return res.status(400).json({ success: false, message: 'Target must be "client" or "provider"' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Warning message is required' });
    }

    const booking = await Booking.findById(orderId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    booking.warnings.push({
      target,
      message: message.trim(),
      adminId,
      createdAt: new Date(),
    });

    // Add history log
    booking.historyLogs.push({
      action: 'warning_added',
      adminId: adminId,
      timestamp: new Date(),
      details: `Warning added to ${target}: ${message.trim()}`,
    });

    await booking.save();

    // Emit socket event
    const io = getIo();
    io.emit('adminOrderUpdated', {
      orderId: booking._id,
      type: 'warning_added',
      target,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

