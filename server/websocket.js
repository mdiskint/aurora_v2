const { Server } = require('socket.io');

function setupWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  console.log('🌐 WebSocket server initialized');

  io.on('connection', (socket) => {
    console.log('👋 User connected:', socket.id);

    socket.on('join_portal', (portalId) => {
      socket.join(portalId);
      console.log(`📍 User ${socket.id} joined portal: ${portalId}`);
      
      socket.to(portalId).emit('user_joined', {
        userId: socket.id,
        timestamp: Date.now()
      });
    });

    socket.on('create_node', (data) => {
      console.log('🆕 Node created:', data);
      
      io.to(data.portalId).emit('node_created', {
        ...data,
        timestamp: Date.now()
      });
    });

    socket.on('disconnect', () => {
      console.log('👋 User disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = { setupWebSocket };