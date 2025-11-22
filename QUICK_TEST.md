# Quick Socket.io Test Guide

## 🚀 Fastest Way to Test

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Start Server
```bash
npm run dev
```

### Step 3: Open Browser Test Page
Open in your browser:
```
http://localhost:5000/socket-test.html
```

### Step 4: Connect & Test
1. Enter User ID: `test-user-123`
2. Enter Interests: `tax,accounting`
3. Click **"Connect"**
4. Click **"Send Notification"** to test
5. Watch notifications appear in real-time!

## 📝 Alternative: Command Line Test

### Run Comprehensive Test:
```bash
npm run test:socket
```

### Send Test Notification:
```bash
npm run test:notify
```

### Custom Notification:
```bash
node src/scripts/sendTestNotification.js --interests "tax,accounting" --title "My Test" --message "Test message"
```

## ✅ What to Expect

When working correctly:
- ✅ Status shows "Connected"
- ✅ Notifications appear in the list
- ✅ Console shows connection logs
- ✅ Server logs show socket connections

## 🐛 Troubleshooting

**Can't connect?**
- Check server is running: `npm run dev`
- Verify port is 5000 (or check your `.env`)

**No notifications?**
- Make sure interests match exactly
- Check browser console for errors
- Verify server logs show socket connections

For detailed testing guide, see `SOCKET_TESTING_GUIDE.md`

