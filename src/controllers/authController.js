import { token } from 'morgan';
import { User } from '../models/User.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/tokens.js';

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const user = await User.create({ name, email, password, role: 'client' });
    return res.status(201).json({token, id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) { next(err); }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const payload = { sub: user._id.toString(), role: user.role };
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    res.json({ accessToken: access, refreshToken: refresh, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Missing token' });
    const payload = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
    const access = signAccessToken({ sub: payload.sub, role: payload.role });
    res.json({ accessToken: access });
  } catch (err) { next(err); }
}

export async function logout(req, res) {
  res.json({ message: 'Logged out' });
}


