// NOTE: This controller is incomplete and requires a Service model to be fully functional
// Currently not used in routes. Fix or remove as needed.

import { User } from '../models/User.js';
import Notification from '../models/Notification.js';
import { getIo, getUserSockets } from '../sockets/socket.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service : 'Gmail',
    auth : {
        user : process.env.EMAIL_USER,
        pass : process.env.EMAIL_PASS,
    },
});
// NOTE: This function requires a Service model to be created first
// Currently disabled - implement Service model and uncomment/fix as needed
export const sendNotification = async (req, res) => {
  try {
    const { interests, title, message } = req.body;
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ message: 'interests array is required' });
    }
    
    // Find users with matching interests
    const users = await User.find({ interests: { $in: interests } });
    if (users.length === 0) {
      return res.status(200).json({ message: 'No users found with matching interests', count: 0 });
    }
    
    // Create notifications
    const notifications = users.map(u => ({
      user: u._id,
      title: title || 'New Service Added',
      Message: message || 'A new service has been added in your interest area.',
      link: `/services/${interests[0]}`,
      data: { interests, title },
    }));
    
    await Notification.insertMany(notifications);
    
    // Send via Socket.io
    const io = getIo();
    const userSockets = getUserSockets();
    
    for (const interest of interests) {
      io.to(interest).emit('notification', {
        title: title || 'New Service Added',
        message: message || 'A new service has been added.',
        link: `/services/${interest}`,
      });
    }
    
    // Per-user socket delivery
    for (const user of users) {
      const uid = user._id.toString();
      const sockets = userSockets.get(uid);
      if (sockets && sockets.size > 0) {
        sockets.forEach(socketId => {
          io.to(socketId).emit('newNotification', {
            title: title || 'New Service Added',
            message: message || 'A new service has been added.',
            link: `/services/${interests[0]}`,
          });
        });
      } else if (user.notifyByEmail) {
        // Send email if user is offline and has email notifications enabled
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: title || 'New Service Added',
          text: message || 'A new service has been added in your interest area.',
        });
      }
    }

    return res.status(201).json({ message: 'Notifications sent', count: users.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
