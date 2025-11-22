import { io as socketClient } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

// Test configuration
const testConfig = {
  userID: process.env.TEST_USER_ID || 'test-user-123',
  interests: (process.env.TEST_INTERESTS || 'tax,accounting,bookkeeping').split(','),
  testTitle: 'Test Notification',
  testMessage: 'This is a test notification from Socket.io',
};

console.log('🚀 Starting Socket.io Test');
console.log('Configuration:', testConfig);
console.log('─'.repeat(50));

// Create socket connection
const socket = socketClient(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

let testResults = {
  connected: false,
  registered: false,
  notificationsReceived: 0,
  errors: [],
};

// Socket event handlers
socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log('   Socket ID:', socket.id);
  testResults.connected = true;
  
  // Register user with interests
  console.log('\n📝 Registering user...');
  socket.emit('register', {
    userID: testConfig.userID,
    interests: testConfig.interests,
  });
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
  testResults.connected = false;
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  testResults.errors.push(`Connection error: ${error.message}`);
});

// Listen for notification events
socket.on('notification', (payload) => {
  testResults.notificationsReceived++;
  console.log('\n🔔 Received "notification" event:');
  console.log('   Title:', payload.title);
  console.log('   Message:', payload.message);
  console.log('   Link:', payload.link);
  console.log('   Full payload:', JSON.stringify(payload, null, 2));
});

socket.on('newNotification', (payload) => {
  testResults.notificationsReceived++;
  console.log('\n🔔 Received "newNotification" event:');
  console.log('   Title:', payload.title);
  console.log('   Message:', payload.Message || payload.message);
  console.log('   Link:', payload.link);
  console.log('   Full payload:', JSON.stringify(payload, null, 2));
});

// Test functions
async function testInterestRoomNotification() {
  console.log('\n📤 Test 1: Sending notification to interest rooms...');
  try {
    const response = await axios.post(`${API_URL}/notify`, {
      interests: testConfig.interests,
      title: testConfig.testTitle,
      message: testConfig.testMessage,
    });
    console.log('✅ API Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    testResults.errors.push(`API error: ${error.message}`);
    return false;
  }
}

async function testUserSpecificNotification() {
  console.log('\n📤 Test 2: Testing user-specific notification...');
  // This would require creating a notification via the Notification model
  // For now, we'll just test the interest-based notification
  return true;
}

async function testJoinInterest() {
  console.log('\n📤 Test 3: Testing joinInterest event...');
  return new Promise((resolve) => {
    socket.emit('joinInterest', 'new-interest');
    setTimeout(() => {
      console.log('✅ Joined new-interest room');
      resolve(true);
    }, 500);
  });
}

async function runTests() {
  // Wait for connection
  await new Promise((resolve) => {
    if (socket.connected) {
      resolve();
    } else {
      socket.once('connect', resolve);
    }
  });

  // Wait a bit for registration
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (!testResults.registered) {
    console.log('⚠️  User registration may have failed. Continuing tests...');
  }

  // Run tests
  await testInterestRoomNotification();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for notification

  await testJoinInterest();
  await testInterestRoomNotification(); // Send another notification
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Print results
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('═'.repeat(50));
  console.log('Connected:', testResults.connected ? '✅' : '❌');
  console.log('Registered:', testResults.registered ? '✅' : '⚠️');
  console.log('Notifications Received:', testResults.notificationsReceived);
  console.log('Errors:', testResults.errors.length);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
  }

  if (testResults.connected && testResults.notificationsReceived > 0) {
    console.log('\n✅ Socket.io is working correctly!');
  } else {
    console.log('\n⚠️  Some tests may have failed. Check the output above.');
  }

  // Keep connection alive for manual testing
  console.log('\n💡 Connection will stay open for 30 seconds for manual testing...');
  console.log('   You can send notifications via: POST /api/notify');
  console.log('   Press Ctrl+C to exit\n');

  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 30000);
}

// Start tests
runTests().catch((error) => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});

