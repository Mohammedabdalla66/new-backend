import { User } from '../models/User.js';
import { Request } from '../models/Request.js';
import { Booking } from '../models/Booking.js';
import Notification from '../models/Notification.js';
import { getIo } from '../sockets/socket.js';

export async function listUsers(req, res, next) {
  try {
    const { role, q } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];
    const users = await User.find(filter).select('-password').limit(200).sort('-createdAt');
    res.json(users);
  } catch (err) { next(err); }
}

export async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['client', 'company', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (err) { next(err); }
}

export async function listAllRequests(req, res, next) {
  try {
    const { status } = req.query;
    const q = {};
    if (status) q.status = status;
    const docs = await Request.find(q).sort('-createdAt').limit(200);
    res.json(docs);
  } catch (err) { next(err); }
}

export async function listAllBookings(req, res, next) {
  try {
    const docs = await Booking.find().populate('client company', 'name').sort('-createdAt').limit(200);
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


