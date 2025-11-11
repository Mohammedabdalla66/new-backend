import { Booking } from '../models/Booking.js';

export async function myBookings(req, res, next) {
  try {
    const docs = await Booking.find({ client: req.user.sub }).populate('company', 'name').sort('-createdAt');
    res.json(docs);
  } catch (err) { next(err); }
}

export async function getBooking(req, res, next) {
  try {
    const doc = await Booking.findOne({ _id: req.params.id, client: req.user.sub }).populate('company', 'name');
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


