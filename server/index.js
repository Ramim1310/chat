const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:5173", 
  "http://127.0.0.1:5173",
  process.env.CLIENT_URL // Production URL from env
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const prisma = require('./db');

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('Server is running');
});

// Socket.io Events
  // Map to store online users: socket.id -> user info
  const onlineUsers = new Map();
  // Map to store userId -> socketId for direct lookups
  const userSockets = new Map();

  io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Handle user identification
    socket.on('user_connected', (userData) => {
      onlineUsers.set(socket.id, userData);
      userSockets.set(userData.id, socket.id); // Store userId -> socketId
      io.emit('active_users', Array.from(onlineUsers.values()));
      console.log(`User identified: ${userData.name} (ID: ${userData.id})`);
    });

    socket.on('join_chat', (roomID) => {
        socket.join(roomID);
        console.log(`User ${socket.id} joined chat room: ${roomID}`);
    });

    socket.on('join_room', (data) => {
        // Legacy/Generic room join
      socket.join(data);
      const userData = onlineUsers.get(socket.id);
      const userName = userData?.name || 'Unknown';
      console.log(`[SOCKET join_room] User ${userName} (socket: ${socket.id}) joined room: ${data}`);
    });

    socket.on('send_message', async (data) => {
      const { room, author, content, email, image } = data; 
      
      if (!email && !data.senderId) {
          console.error("[DEBUG] Email or SenderId missing in message data");
          return;
      }

      console.log(`[DEBUG] Received message from ${author} for room ${room}: ${content}`);

      // Save to DB
      try {
          let user;
          // Prefer senderId if available, else look up by email
          if (data.senderId) {
              user = await prisma.user.findUnique({ where: { id: data.senderId } });
          } else {
              user = await prisma.user.findUnique({ where: { email } });
          }

          if (!user) {
              console.error(`[DEBUG] User not found for message`);
              return;
          }

          const newMessage = await prisma.message.create({
              data: {
                  content: content,
                  senderId: user.id,
                  room: room,
                  status: 'sent'
              },
              include: { sender: true }
          });

          // Emit to room with sender details
          console.log(`[DEBUG] Emitting to room ${room}`);
          // Emit to receiver
          socket.to(room).emit('receive_message', newMessage);
          // Confirm to sender (for status update to 'sent')
          socket.emit('message_sent', { tempId: data.tempId, id: newMessage.id, status: 'sent', timestamp: newMessage.timestamp });
          
      } catch (err) {
          console.error("Error saving message:", err.message);
          console.error(err);
      }
    });

    socket.on('mark_messages_read', async ({ room, userId }) => {
        // Update all messages in room/chat where receiver is ME (userId) and status != seen
        // Actually, we update messages sent BY THE OTHER person.
        // But simplified: Update all messages in this room that fall under "unseen" logic
        try {
            await prisma.message.updateMany({
                where: {
                    room: room,
                    senderId: { not: userId }, // Messages sent by others
                    status: { not: 'seen' }
                },
                data: { status: 'seen', seenAt: new Date() }
            });
            // Notify sender that messages are seen
            socket.to(room).emit('messages_seen', { room });
        } catch (e) {
            console.error("Error marking seen:", e);
        }
    });

    socket.on('typing', (room) => {
      socket.to(room).emit('display_typing', socket.id); // Broadcast to others in room
    });

    socket.on('stop_typing', (room) => {
      socket.to(room).emit('hide_typing', socket.id);
    });

    socket.on('disconnect', async () => {
      console.log('User Disconnected', socket.id);
      if (onlineUsers.has(socket.id)) {
        const user = onlineUsers.get(socket.id);
        if (user && user.id) {
            userSockets.delete(user.id);
            // Update lastSeen
            try {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastSeen: new Date() }
                });
            } catch (e) {
                console.error("Failed to update lastSeen:", e);
            }
        }
        onlineUsers.delete(socket.id);
        io.emit('active_users', Array.from(onlineUsers.values()));
      }
    });

    // Handle Friend Request via Socket
    socket.on('sendFriendRequest', async ({ senderId, receiverId }, callback) => {
        if (senderId === receiverId) {
            return callback({ error: "Cannot send request to yourself" });
        }

        try {
            // Check if exists
           const existing = await prisma.friendRequest.findFirst({
              where: {
                  OR: [
                      { senderId, receiverId },
                      { senderId: receiverId, receiverId: senderId }
                  ]
              }
          });

          if (existing) {
               if (existing.status === 'pending') return callback({ error: "Request already pending" });
               if (existing.status === 'accepted') return callback({ error: "Already friends" });
               return callback({ error: "Request exists" });
          }

          const request = await prisma.friendRequest.create({
              data: { senderId, receiverId, status: 'pending' }
          });

          // Find receiver's socket using userSockets map or iteration
          const receiverSocketId = userSockets.get(receiverId);

          if (receiverSocketId) {
              // Fetch sender info to show nicer notification
              const sender = await prisma.user.findUnique({ where: { id: senderId } });
              io.to(receiverSocketId).emit('friend_request_received', {
                  requestId: request.id,
                  senderName: sender.name,
                  senderId: sender.id
              });
          }

          callback({ success: true, request });

        } catch (err) {
            console.error("Socket Friend Request Error:", err);
            callback({ error: "Internal Server Error" });
        }
    });
});

// Middleware to authenticate
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
      console.log("[AUTH] No token provided");
      return res.sendStatus(401);
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'SECRET_KEY', (err, user) => {
    if (err) {
        console.log("[AUTH] Token verification failed:", err.message);
        // Return 401 so the client can try to refresh the token
        return res.sendStatus(401); 
    }
    req.user = user;
    next();
  });
};

const generateAccessToken = (user) => {
    return jwt.sign({ userId: user.id, email: user.email }, process.env.ACCESS_TOKEN_SECRET || 'SECRET_KEY', { expiresIn: '15m' });
};

const generateRefreshToken = (user) => {
    return jwt.sign({ userId: user.id, email: user.email }, process.env.REFRESH_TOKEN_SECRET || 'REFRESH_SECRET_KEY', { expiresIn: '7d' });
};

// Auth & User Routes
app.post('/register', async (req, res) => {
  const { name, email, password, image } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, image },
      include: { friends: true }
    });
    
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false, // Set to true in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ message: "Success", user, token: accessToken });
  } catch (error) {
    if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'Field';
        return res.status(400).json({ error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` });
    }
    console.error(error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ 
        where: { email },
        include: { friends: true } 
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false, // Set to true in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ message: "Success", user, token: accessToken });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});

app.post('/refresh_token', (req, res) => {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) return res.sendStatus(401);

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || 'REFRESH_SECRET_KEY', (err, user) => {
        if (err) return res.sendStatus(403);
        const newAccessToken = jwt.sign({ userId: user.userId, email: user.email }, process.env.ACCESS_TOKEN_SECRET || 'SECRET_KEY', { expiresIn: '15m' });
        res.json({ accessToken: newAccessToken });
    });
});


// User Registration (Legacy/Upsert - keep for now or remove if strictly replacing?) 
// The prompt implies full auth. I will keep /api/users but maybe regularise it? 
// The prompt said "Create /register and /login". 
// I'll leave /api/users as is or comment it out if it conflicts. 
// Existing /api/users uses upsert without password. This will fail now because password is required.
// So I MUST remove or update /api/users. I will remove it to avoid confusion/errors.


// Fetch Message History
app.get('/api/messages', async (req, res) => {
  const { room } = req.query;
  try {
    const messages = await prisma.message.findMany({
        where: room ? { room } : {}, // Filter by room if provided
        include: { sender: true },
        orderBy: { timestamp: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
    const { room, content, email, senderId, tempId } = req.body;
    console.log(`[HTTP POST /api/messages] Room: ${room}, SenderId: ${senderId}, Content: "${content}"`);
    
    try {
        let user;
        if (senderId) {
            user = await prisma.user.findUnique({ where: { id: senderId } });
        } else {
            user = await prisma.user.findUnique({ where: { email } });
        }

        if (!user) {
            console.log(`[HTTP POST /api/messages] User not found`);
            return res.status(404).json({ error: 'User not found' });
        }

        const newMessage = await prisma.message.create({
            data: {
                content,
                senderId: user.id,
                room,
                status: 'sent'
            },
            include: { sender: true }
        });

        console.log(`[HTTP POST /api/messages] Message created with ID: ${newMessage.id}`);

        // Get sender's socket ID
        const senderSocketId = userSockets.get(user.id);
        
        // Broadcast via Socket to everyone in the room EXCEPT the sender
        const socketsInRoom = await io.in(room).fetchSockets();
        console.log(`[HTTP POST /api/messages] Broadcasting to room "${room}" with ${socketsInRoom.length} connected socket(s)`);
        
        if (senderSocketId) {
            // Exclude sender - they already have the message via HTTP response
            io.to(room).except(senderSocketId).emit('receive_message', newMessage);
            console.log(`[HTTP POST /api/messages] Broadcast sent (excluding sender socket: ${senderSocketId})`);
        } else {
            // If sender socket not found, broadcast to everyone
            io.to(room).emit('receive_message', newMessage);
            console.log(`[HTTP POST /api/messages] Broadcast sent to all (sender socket not found)`);
        }
         
         // Emit confirmation to sender
         if (senderSocketId) {
             console.log(`[HTTP POST /api/messages] Sending confirmation to sender socket: ${senderSocketId}`);
             io.to(senderSocketId).emit('message_sent', { 
                 tempId, 
                 id: newMessage.id, 
                 status: 'sent', 
                 timestamp: newMessage.timestamp 
             });
         } else {
             console.log(`[HTTP POST /api/messages] WARNING: Sender socket not found for userId: ${user.id}`);
         }

         res.json(newMessage);
    } catch (e) {
        console.error("[HTTP POST /api/messages] Error:", e);
        res.status(500).json({ error: "Failed to send message" });
    }
});

// Friend Request System Routes

// Search Users
app.post('/api/users/search', authenticateToken, async (req, res) => {
  const { query, userId } = req.body;
  console.log(`[HTTP POST /api/users/search] User ${req.user.userId} searching for: "${query}"`);
  
  if (!query) return res.json([]);
  try {
    const users = await prisma.user.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        AND: [
            { id: { not: userId } }, // Exclude self
        ]
      },
      select: { id: true, name: true, email: true, image: true }
    });
    console.log(`[HTTP POST /api/users/search] Found ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error("[HTTP POST /api/users/search] Error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// Get Current User Profile (with friends)
app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { friends: true }
        });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (e) {
        console.error("Error fetching me:", e);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// Send Request
app.post('/api/friend-request/send', authenticateToken, async (req, res) => {
    const { senderId, receiverId } = req.body;
    
    if (senderId === receiverId) {
        return res.status(400).json({ error: "Cannot send request to yourself" });
    }
    try {
        // Check if exists
        const existing = await prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId, receiverId },
                    { senderId: receiverId, receiverId: senderId }
                ]
            }
        });
        if (existing) {
             if (existing.status === 'pending') return res.status(400).json({ error: "Request already pending" });
             if (existing.status === 'accepted') return res.status(400).json({ error: "Already friends" });
             // If rejected/cancelled, maybe allow resend? For now block.
             return res.status(400).json({ error: "Request exists" });
        }

        const request = await prisma.friendRequest.create({
            data: { senderId, receiverId, status: 'pending' }
        });
        res.json(request);
    } catch (e) {
        res.status(500).json({ error: "Failed to send request" });
    }
});

// Get Pending Requests (Incoming)
app.get('/api/friend-request/pending/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    try {
        const requests = await prisma.friendRequest.findMany({
            where: {
                receiverId: parseInt(userId),
                status: 'pending'
            },
            include: { sender: true }
        });
        res.json(requests);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch requests" });
    }
});

// Accept Request
app.post('/api/friend-request/accept', authenticateToken, async (req, res) => {
    const { requestId } = req.body;
    try {
        // Transaction: Update status -> Add to friends (both ways)
        const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
        if (!request) return res.status(404).json({ error: "Request not found" });

        await prisma.$transaction([
            prisma.friendRequest.update({
                where: { id: requestId },
                data: { status: 'accepted' }
            }),
            prisma.user.update({
                where: { id: request.senderId },
                data: { friends: { connect: { id: request.receiverId } } }
            }),
            prisma.user.update({
                where: { id: request.receiverId },
                data: { friends: { connect: { id: request.senderId } } }
            })
        ]);
        res.json({ message: "Accepted" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to accept" });
    }
});

// Reject Request
app.post('/api/friend-request/reject', authenticateToken, async (req, res) => {
    const { requestId } = req.body;
    try {
        await prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: 'rejected' }
        });
        res.json({ message: "Rejected" });
    } catch (e) {
        res.status(500).json({ error: "Failed to reject" });
    }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
