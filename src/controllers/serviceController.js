import User from '../models/User';
import Notification from '../models/Notification';
import { getIo, getUserSockets } from '../sockets/socket';
import nodemailer from 'nodemailer';
import { link } from 'joi';

const transporter = nodemailer.createTransport({
    service : 'Gamil',
    auth : {
        user : process.env.EMAIL_USER,
        pass : process.env.EMAIL_PASS,
    },
});
   export const sendNotification = async (req , res) => {
    try {
        const { interests , title , message } = req.body;
        const service = await service.create({title , message , desciption});
        const users = await User.find({ interests : interests });
        const notifications = users.map( u => ({
            user : u._id,
            title : `New Service Added: ${category}`,
            message : `A new service titled "${title}" has been added in your interest area.`,
            link : `/services/${service._id}`,
            data : { category , title},
        }));
        await Notification.insertMany(notifications);
        const io = getIO();
    if (io) {
      io.to(category).emit('notification', {
        title: `خدمة جديدة في ${category}`,
        message: `تمت إضافة خدمة "${title}"`,
        link: `/services/${category}`
      });
    }

    // 5) per-user delivery to each of their sockets (handles multiple devices)
    const userSockets = getUserSockets();
    for (const user of users) {
      const uid = user._id.toString();
      const sockets = userSockets().get(uid); // userSockets is Map; userSockets() returns map
      if (sockets && sockets.size > 0) {
        // user is online on one or several sockets
        sockets.forEach(socketId => {
          io.to(socketId).emit('notification', {
            title: `خدمة جديدة في ${category}`,
            message: `تمت إضافة خدمة "${title}"`,
            link: `/services/${category}`
          });
        });
      } else {
        // offline -> send email if enabled
        if (user.notifyByEmail) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: `خدمة جديدة في ${category}`,
            text: `تمت إضافة خدمة "${title}" في مجال ${category}.`
          });
        }
      }
    }

    return res.status(201).json({ message: 'Service created and notifications sent', count: users.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
