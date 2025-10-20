const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

console.log('🌐 WebSocket server initialized');

io.on('connection', (socket) => {
  console.log('👋 User connected:', socket.id);

  // When user joins a portal
  socket.on('join_portal', (portalId) => {
    socket.join(portalId);
    console.log(`📍 User ${socket.id} joined portal: ${portalId}`);
    
    socket.to(portalId).emit('user_joined', {
      userId: socket.id,
      timestamp: Date.now()
    });
  });

  // When user creates a node
  socket.on('create_node', (data) => {
    console.log('🆕 Node created:', data);
    
    io.to(data.portalId).emit('nodeCreated', data);
  });

  // When user creates a nexus
  socket.on('create_nexus', (data) => {
    console.log('🌟 Nexus created:', data);
    
    io.to(data.portalId).emit('nexusCreated', data);
  });

  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
  });
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});