import express from 'express';
import http from 'http';
import nodemailer from 'nodemailer';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import serviceProviderRoutes from './routes/serviceProviderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import downloadRoutes from './routes/downloadRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import Notification from './models/Notification.js';
import { User } from './models/User.js';
import { initializeSocket } from './sockets/socket.js';


dotenv.config();

const app = express();
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://cahup.vercel.app"
  ],
  credentials: true
}));

// Configure Helmet with CSP that allows inline scripts for test page
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*", "https://localhost:*"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting configuration
// Create separate limiters for different route types
const generalLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 300 to handle React StrictMode double renders
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// More lenient rate limiter for auth routes (login, register)
// In development: disabled or very high limit
// In production: reasonable limit to prevent brute force
const authLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : (process.env.DISABLE_RATE_LIMIT === 'true' ? Number.MAX_SAFE_INTEGER : 10000), // Very high in dev, 50 in production
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting if explicitly disabled
  skip: (req) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      console.log('⚠️ Rate limiting disabled for development');
      return true;
    }
    return false;
  },
  // Custom handler to log rate limit hits
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    console.warn(`🚫 Rate limit exceeded for IP: ${ip}, Path: ${req.path}, Method: ${req.method}`);
    console.warn(`   Current limit: ${authLimiter.max} requests per ${authLimiter.windowMs / 1000 / 60} minutes`);
    
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(authLimiter.windowMs / 1000), // seconds
      limit: authLimiter.max,
      windowMs: authLimiter.windowMs
    });
  }
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // For FormData
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Apply auth limiter to auth routes (more lenient for login/register)
app.use('/api/auth', authLimiter, authRoutes);

// Apply general limiter to all other routes
app.use('/api/users', generalLimiter, userRoutes);
console.log('✅ User routes registered at /api/users');
app.use('/api/portfolio', generalLimiter, portfolioRoutes);
console.log('✅ Portfolio routes registered at /api/portfolio');
app.use('/api/requests', generalLimiter, requestRoutes);
console.log('✅ Request routes registered at /api/requests');
app.use('/api/bookings', generalLimiter, bookingRoutes);
app.use('/api/wallet', generalLimiter, walletRoutes);
app.use('/api/messages', generalLimiter, messageRoutes);
console.log('✅ Message routes registered at /api/messages');
app.use('/api/service-provider', generalLimiter, serviceProviderRoutes);
console.log('✅ Service Provider routes registered at /api/service-provider');
app.use('/api/admin', generalLimiter, adminRoutes);
console.log('✅ Admin routes registered at /api/admin');
app.use('/api', generalLimiter, downloadRoutes);
console.log('✅ Download routes registered at /api/download');

const server = http.createServer(app);
const io = initializeSocket(server);

// Socket.io events are handled in sockets/socket.js

const transporter = nodemailer.createTransport({
    service : 'Gmail',
    auth : {
        user : process.env.EMAIL_USER,
        pass : process.env.EMAIL_PASS,
    },
});

// Notification endpoint (must be before notFound middleware)
app.post('/api/notify', async (req, res) => {
  try {
    const { interests, title, message } = req.body;
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ message: 'interests array is required' });
    }
    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required' });
    }

    // Find users with matching interests
    const users = await User.find({ interests: { $in: interests } });
    
    // Create notification records
    const notifications = users.map((user) => ({
      user: user._id,
      title,
      Message: message,
      link: `/services/${interests[0]}`,
      data: { interests },
    }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // Emit to interest rooms
    for (const interest of interests) {
      io.to(interest).emit('notification', { title, message, link: `/services/${interest}` });
    }

    // Send to specific user sockets and handle offline users
    const { getUserSockets } = await import('./sockets/socket.js');
    const userSockets = getUserSockets();
    
    for (const user of users) {
      const uid = user._id.toString();
      const sockets = userSockets.get(uid);
      
      if (sockets && sockets.size > 0) {
        // User is online - send via socket
        const notification = notifications.find(n => n.user.toString() === uid);
        sockets.forEach(socketId => {
          io.to(socketId).emit('newNotification', notification);
        });
      } else if (user.notifyByEmail) {
        // User is offline - send email
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: `New Notification: ${title}`,
          text: message,
        });
        console.log(`Email sent to ${user.email} for notification: ${title}`);
      }
    }
    
    res.json({ success: true, message: 'Notifications sent', count: users.length });
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Static files and error handlers (must be after all routes)
app.use(express.static('public'));
app.use('/uploads', express.static('uploads')); // Serve uploaded files
app.use(notFound);
app.use(errorHandler);

// Start server function
async function startServer() {
  try {
    // Connect to database first
    await connectDB();
    
    // Start HTTP server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Socket.io initialized and ready`);
      console.log(`✅ Test page available at http://localhost:${PORT}/socket-test.html`);
      console.log(`✅ Admin routes registered: /api/admin/clients, /api/admin/transactions, /api/admin/reports/daily`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();


