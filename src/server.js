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
import requestRoutes from './routes/requestRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import serviceProviderRoutes from './routes/serviceProviderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import Notification from './models/Notification.js';
import { User } from './models/User.js';
import { initializeSocket } from './sockets/socket.js';


dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));

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

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // For FormData
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
console.log('✅ Request routes registered at /api/requests');
app.use('/api/bookings', bookingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/service-provider', serviceProviderRoutes);
app.use('/api/admin', adminRoutes);
console.log('✅ Admin routes registered at /api/admin');

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


