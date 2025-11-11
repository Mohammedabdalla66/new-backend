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
import firmRoutes from './routes/firmRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import Notification from './models/Notification.js';
import { User } from './models/User.js';
import { initializeSocket } from './sockets/socket.js';


dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/firm', firmRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const io = initializeSocket(server);

await connectDB();

// Socket.io events are handled in sockets/socket.js

const transporter = nodemailer.createTransport({
    service : 'Gmail',
    auth : {
        user : process.env.EMAIL_USER,
        pass : process.env.EMAIL_PASS,
    },
});

app.post('/api/notify' , async (req , res) => {
    const {interests , title , message } =req.body;
    io.to(interests).emit('notification' , { title , message });
    const users = await User.find({ interests:interests }); 
    const notification = users.map((user) => ({
        user : user._id,
        title, 
        message,
        link : `/services/${interests[0]}`,

    }));
    await Notification.insertMany(notification);
    for (const user of users){
        // email users who are offline (simple heuristic; you can enrich using sockets map exposed from sockets module if needed)
        if(user.notifyByEmail){
            await transporter.sendMail({
            from : process.env.EMAIL_USER,
            to : user.email,
            subject : `New Notification: ${title}`,
            text : message,
        });
        console.log(`Email sent to ${user.email} for notification: ${title}`);
        }
    } 
    res.json({ success : true , message : 'Notifications sent' })  
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});


