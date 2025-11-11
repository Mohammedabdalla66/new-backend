import { User } from '../models/User.js';

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.sub).select('-password');
    res.json(user);
  } catch (err) { next(err); }
}

export async function updateMe(req, res, next) {
  try {
    const updates = (({ name, phone, avatar }) => ({ name, phone, avatar }))(req.body);
    const user = await User.findByIdAndUpdate(req.user.sub, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { next(err); }
}


