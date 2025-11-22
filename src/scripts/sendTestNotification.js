import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

async function sendTestNotification() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const interests = args.includes('--interests') 
    ? args[args.indexOf('--interests') + 1].split(',')
    : ['tax', 'accounting'];
  
  const title = args.includes('--title')
    ? args[args.indexOf('--title') + 1]
    : 'Test Notification';
  
  const message = args.includes('--message')
    ? args[args.indexOf('--message') + 1]
    : 'This is a test notification sent via API';

  console.log('📤 Sending test notification...');
  console.log('   Interests:', interests);
  console.log('   Title:', title);
  console.log('   Message:', message);
  console.log('─'.repeat(50));

  try {
    const response = await axios.post(`${API_URL}/notify`, {
      interests,
      title,
      message,
    });
    
    console.log('✅ Success!');
    console.log('   Response:', response.data);
    console.log('─'.repeat(50));
    console.log('💡 Make sure you have a socket client connected to receive the notification');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

sendTestNotification();

