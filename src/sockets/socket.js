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