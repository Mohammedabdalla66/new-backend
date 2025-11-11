import { Request } from '../models/Request.js';
import { Booking } from '../models/Booking.js';

export async function listRequests(req, res, next) {
  try {
    const { status } = req.query;
    const q = {};
    if (status) q.status = status;
    else q.status = { $in: ['submitted', 'open'] };
    const docs = await Request.find(q).sort('-createdAt').limit(100);
    res.json(docs);
  } catch (err) { next(err); }
}

export async function getRequestForFirm(req, res, next) {
  try {
    const doc = await Request.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
}

export async function listMyBookings(req, res, next) {
  try {
    const docs = await Booking.find({ company: req.user.sub })
      .populate('client', 'name')
      .populate('request', 'title')
      .sort('-createdAt');
    res.json(docs);
  } catch (err) { next(err); }
}

export async function transitionBooking(req, res, next) {
  try {
    const { id, action } = req.params;
    const booking = await Booking.findOne({ _id: id, company: req.user.sub });
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


