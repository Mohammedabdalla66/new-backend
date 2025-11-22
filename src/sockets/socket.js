import { Server } from "socket.io";

let io;
const userSockets = new Map();

export const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }  
    return io;
};

export const getUserSockets = () => userSockets;

export function initializeSocket(server) {
    io = new Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
    });
    io.on('connection', (socket) => {
        console.log(' connected', socket.id);
        
        socket.on('register', ({ userID, interests }) => {
            if (!userID) return;
            socket.userID = String(userID);
            socket.interests = Array.isArray(interests) ? interests : [];
            if (!userSockets.has(socket.userID)) userSockets.set(socket.userID, new Set());
            userSockets.get(socket.userID).add(socket.id);
            // join rooms based on interests
            if (Array.isArray(interests)) {
                interests.forEach((topic) => socket.join(topic));
            }
            console.log(`User ${socket.userID} registered with interests:`, socket.interests);
            
        });
        // join a single interest room later
        socket.on('joinInterest', (interest) => {
            if (!interest) return;
            socket.join(interest);
            console.log(`User ${socket.userID} joined interest room: ${interest}`);
        });
        socket.on('leaveInterest', (interest) => {
            if (!interest) return;
            socket.leave(interest);
            console.log(`User ${socket.userID} left interest room: ${interest}`);
        });
        
        // Chat message handling
        socket.on('chat:send', async ({ to, text, file }) => {
            if (!to || (!text && !file)) {
                socket.emit('error', { message: 'Invalid message: recipient and text/file required' });
                return;
            }
            
            try {
                const { Message } = await import('../models/Message.js');
                const senderId = socket.userID;
                
                // Determine sender type (would need to check user role from DB)
                // For now, assume it's set correctly by the client
                const sender = 'serviceProvider'; // This should be determined from user role
                
                const msg = await Message.create({
                    client: sender === 'client' ? senderId : to,
                    serviceProvider: sender === 'serviceProvider' ? senderId : to,
                    company: sender === 'serviceProvider' ? senderId : to, // Legacy
                    sender,
                    text: text || '',
                    file: file || undefined,
                });
                
                // Emit to recipient
                io.to(to.toString()).emit('chat:message', {
                    id: msg._id,
                    from: senderId,
                    to,
                    text: msg.text,
                    file: msg.file,
                    sender,
                    timestamp: msg.createdAt,
                });
                
                // Confirm to sender
                socket.emit('chat:sent', { id: msg._id });
            } catch (error) {
                console.error('Error handling chat:send:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });
        
        socket.on('disconnect', ()=> {
            const uid = socket.userID;
            if (uid && userSockets.has(uid)) {
                const set = userSockets.get(uid);
                set.delete(socket.id);
                if (set.size === 0) userSockets.delete(uid);
            }
            console.log(' disconnected', socket.id);
        });
    });
    return io;
}