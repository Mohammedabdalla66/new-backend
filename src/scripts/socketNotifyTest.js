import { io as ioc } from 'socket.io-client';

const SERVER = process.env.SOCKET_URL || 'http://localhost:3000';
const userID = process.env.TEST_USER_ID || 'test-user-1';
const interests = (process.env.TEST_INTERESTS || 'tax,accounting').split(',');

const socket = ioc(SERVER, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('Connected as', socket.id);
  socket.emit('register', { userID, interests });
});

socket.on('notification', (payload) => {
  console.log('Received notification:', payload);
});

socket.on('newNotification', (payload) => {
  console.log('Received newNotification:', payload);
});

setTimeout(() => {
  console.log('Listening for notifications...');
}, 1000);


