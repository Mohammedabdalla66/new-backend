import { Request } from '../models/Request.js';
import { Booking } from '../models/Booking.js';

export async function listRequests(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const q = req.query.q || req.query.search || '';
    const sort = req.query.sort || '-createdAt';
    
    const filter = {};
    
    // Default: show only open/submitted requests
    if (status && status !== 'all') {
      filter.status = status;
    } else {
      filter.status = { $in: ['submitted', 'open'] };
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


