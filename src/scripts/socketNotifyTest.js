// Simple Socket.io test script
// For comprehensive testing, use: npm run test:socket

import { io as ioc } from 'socket.io-client';

const SERVER = process.env.SOCKET_URL || 'http://localhost:5000';
const userID = process.env.TEST_USER_ID || 'test-user-1';
const interests = (process.env.TEST_INTERESTS || 'tax,accounting').split(',');

console.log('🔌 Connecting to:', SERVER);
const socket = ioc(SERVER, { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log('✅ Connected as', socket.id);
  socket.emit('register', { userID, interests });
  console.log('📝 Registered with userID:', userID, 'interests:', interests);
  console.log('👂 Listening for notifications...');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

socket.on('notification', (payload) => {
  console.log('\n🔔 Received "notification" event:');
  console.log('   Title:', payload.title);
  console.log('   Message:', payload.message);
  console.log('   Full:', JSON.stringify(payload, null, 2));
});

socket.on('newNotification', (payload) => {
  console.log('\n🔔 Received "newNotification" event:');
  console.log('   Title:', payload.title);
  console.log('   Message:', payload.Message || payload.message);
  console.log('   Full:', JSON.stringify(payload, null, 2));
});

// Keep process alive
process.stdin.resume();


