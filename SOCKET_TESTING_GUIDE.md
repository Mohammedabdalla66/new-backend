# Socket.io Testing Guide

This guide explains how to test real-time notifications using Socket.io.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start the Server
```bash
npm run dev
# or
npm start
```

The server will start on `http://localhost:5000` (or the PORT specified in your `.env`).

## 📋 Testing Methods

### Method 1: Browser-Based Test (Recommended)

1. **Start the server** (if not already running)

2. **Open the test page** in your browser:
   ```
   http://localhost:5000/socket-test.html
   ```

3. **Configure connection**:
   - Server URL: `http://localhost:5000`
   - User ID: Enter any test user ID (e.g., `test-user-123`)
   - Interests: Enter comma-separated interests (e.g., `tax,accounting,bookkeeping`)

4. **Click "Connect"** - You should see the status change to "Connected"

5. **Send a test notification**:
   - Fill in the title and message
   - Click "Send Notification"
   - You should see the notification appear in the "Received Notifications" section

### Method 2: Node.js Test Script

#### Run the comprehensive test:
```bash
npm run test:socket
```

This will:
- Connect to the server
- Register a user with interests
- Listen for notifications
- Send test notifications
- Display results

#### Customize the test:
```bash
SERVER_URL=http://localhost:5000 \
TEST_USER_ID=my-user-id \
TEST_INTERESTS=tax,accounting \
npm run test:socket
```

### Method 3: Send Notification via API

#### Using the test script:
```bash
npm run test:notify
```

#### With custom parameters:
```bash
node src/scripts/sendTestNotification.js \
  --interests "tax,accounting" \
  --title "Custom Title" \
  --message "Custom message here"
```

#### Using curl:
```bash
curl -X POST http://localhost:5000/api/notify \
  -H "Content-Type: application/json" \
  -d '{
    "interests": ["tax", "accounting"],
    "title": "Test Notification",
    "message": "This is a test notification"
  }'
```

#### Using Postman/Thunder Client:
- **Method**: POST
- **URL**: `http://localhost:5000/api/notify`
- **Headers**: `Content-Type: application/json`
- **Body** (JSON):
  ```json
  {
    "interests": ["tax", "accounting"],
    "title": "Test Notification",
    "message": "This is a test notification"
  }
  ```

## 🔍 Understanding the Events

### Socket Events

#### Client → Server:
- `register` - Register user with ID and interests
  ```javascript
  socket.emit('register', {
    userID: 'user-123',
    interests: ['tax', 'accounting']
  });
  ```

- `joinInterest` - Join a specific interest room
  ```javascript
  socket.emit('joinInterest', 'tax');
  ```

- `leaveInterest` - Leave an interest room
  ```javascript
  socket.emit('leaveInterest', 'tax');
  ```

#### Server → Client:
- `notification` - Broadcast notification to interest rooms
  ```javascript
  socket.on('notification', (payload) => {
    // payload: { title, message, link }
  });
  ```

- `newNotification` - User-specific notification
  ```javascript
  socket.on('newNotification', (payload) => {
    // payload: { user, title, Message, link, data }
  });
  ```

## 🧪 Test Scenarios

### Scenario 1: Basic Notification Flow

1. **Start server**
2. **Open browser test page** (`http://localhost:5000/socket-test.html`)
3. **Connect with User ID**: `user-1`, Interests: `tax,accounting`
4. **In another terminal**, send notification:
   ```bash
   curl -X POST http://localhost:5000/api/notify \
     -H "Content-Type: application/json" \
     -d '{"interests":["tax"],"title":"New Tax Service","message":"A new tax service is available"}'
   ```
5. **Verify** notification appears in browser

### Scenario 2: Multiple Users

1. **Open 2 browser windows** with test page
2. **Window 1**: Connect as `user-1` with interests `tax,accounting`
3. **Window 2**: Connect as `user-2` with interests `tax,bookkeeping`
4. **Send notification** with interests `["tax"]`
5. **Verify** both users receive the notification

### Scenario 3: User-Specific Notification

1. **Connect a user** via socket
2. **Create a notification** in the database for that user
3. **Emit to user's socket**:
   ```javascript
   const io = getIo();
   const userSockets = getUserSockets();
   const sockets = userSockets.get('user-id');
   sockets.forEach(socketId => {
     io.to(socketId).emit('newNotification', notificationData);
   });
   ```

## 🐛 Troubleshooting

### Connection Issues

**Problem**: Can't connect to server
- ✅ Check server is running on correct port
- ✅ Verify CORS settings allow your origin
- ✅ Check firewall/network settings

**Problem**: Connection drops immediately
- ✅ Check server logs for errors
- ✅ Verify Socket.io version compatibility
- ✅ Check for middleware blocking connections

### Notification Not Received

**Problem**: Notifications not appearing
- ✅ Verify user is registered with matching interests
- ✅ Check server logs for notification sending
- ✅ Verify interest names match exactly (case-sensitive)
- ✅ Check browser console for errors

**Problem**: Only some users receive notifications
- ✅ Verify all users have registered with correct interests
- ✅ Check user's socket connection status
- ✅ Verify interest matching logic

### Common Errors

**Error**: `Socket.io not initialized`
- **Solution**: Ensure `initializeSocket()` is called before using `getIo()`

**Error**: `CORS policy` errors
- **Solution**: Check CORS configuration in `server.js` and Socket.io config

**Error**: `Cannot find module 'axios'`
- **Solution**: Run `npm install axios`

## 📊 Expected Behavior

### When Notification is Sent:

1. **Interest Room Broadcast**: All users in matching interest rooms receive `notification` event
2. **User-Specific Delivery**: Online users receive `newNotification` event on their sockets
3. **Database Storage**: Notification is saved to database for each matching user
4. **Email Fallback**: Offline users with `notifyByEmail: true` receive email

### Connection Flow:

1. Client connects → `connect` event
2. Client registers → `register` event with userID and interests
3. Server joins user to interest rooms
4. User receives notifications in those rooms
5. On disconnect → user removed from rooms

## 🔐 Testing with Authentication

For authenticated endpoints, include JWT token:

```bash
curl -X POST http://localhost:5000/api/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"interests":["tax"],"title":"Test","message":"Test"}'
```

## 📝 Notes

- Socket connections are persistent and will auto-reconnect
- Users can be in multiple interest rooms simultaneously
- Notifications are case-sensitive for interest matching
- The test HTML page is served from `/public` directory
- All notifications are stored in the database for history

## 🎯 Next Steps

After verifying Socket.io works:

1. **Integrate with frontend** - Connect your React app to Socket.io
2. **Add authentication** - Verify user identity on socket connection
3. **Implement real notifications** - Use in actual application flow
4. **Add error handling** - Handle connection failures gracefully
5. **Monitor performance** - Track connection counts and notification delivery

