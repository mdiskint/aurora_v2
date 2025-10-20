const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// In-memory storage
const portals = {};
const conversations = {}; // Store conversations by ID

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinPortal', (portalId) => {
    socket.join(portalId);
    console.log(`Client ${socket.id} joined portal ${portalId}`);
  });

  socket.on('createNexus', (data) => {
    io.to(data.portalId).emit('nexusCreated', data);
  });

  socket.on('createNode', (data) => {
    io.to(data.portalId).emit('nodeCreated', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API Routes
app.post('/api/portals', (req, res) => {
  const { name, participants } = req.body;
  const portalId = Date.now().toString();
  
  portals[portalId] = {
    id: portalId,
    name,
    participants,
    nexuses: [],
    nodes: []
  };
  
  res.json({ portalId, portal: portals[portalId] });
});

app.get('/api/portals/:id', (req, res) => {
  const portal = portals[req.params.id];
  if (portal) {
    res.json(portal);
  } else {
    res.status(404).json({ error: 'Portal not found' });
  }
});

// Save conversation
app.post('/api/conversations', (req, res) => {
  const { messages, portalNodes } = req.body;
  const conversationId = Date.now().toString();
  
  conversations[conversationId] = {
    id: conversationId,
    messages,
    portalNodes,
    timestamp: new Date().toISOString()
  };
  
  res.json({ 
    conversationId, 
    conversation: conversations[conversationId] 
  });
});

// Get all conversations
app.get('/api/conversations', (req, res) => {
  const conversationList = Object.values(conversations).map(conv => ({
    id: conv.id,
    timestamp: conv.timestamp,
    preview: conv.messages[0]?.content.substring(0, 100) + '...' || 'Empty conversation'
  }));
  
  res.json(conversationList);
});

// Get specific conversation
app.get('/api/conversations/:id', (req, res) => {
  const conversation = conversations[req.params.id];
  if (conversation) {
    res.json(conversation);
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

// DELETE conversation - NEW ENDPOINT
app.delete('/api/conversations/:id', (req, res) => {
  const conversationId = req.params.id;
  
  if (conversations[conversationId]) {
    delete conversations[conversationId];
    console.log(`Deleted conversation ${conversationId}`);
    res.json({ success: true, message: 'Conversation deleted' });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

// AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, portalNodes, activeMemories } = req.body;

    let systemPrompt = "You are a helpful assistant in Aurora Portal, a 3D collaborative decision-making space. ";
    
    if (portalNodes && portalNodes.length > 0) {
      systemPrompt += "\n\nCurrent nodes and nexuses in the portal:\n";
      portalNodes.forEach(node => {
        systemPrompt += `- ${node.label} (${node.type})\n`;
      });
    }

    if (activeMemories && activeMemories.length > 0) {
      systemPrompt += "\n\nActive memories from previous conversations:\n";
      activeMemories.forEach(memory => {
        systemPrompt += `\nMemory from ${memory.timestamp}:\n`;
        memory.messages.forEach(msg => {
          systemPrompt += `${msg.role}: ${msg.content}\n`;
        });
        if (memory.portalNodes && memory.portalNodes.length > 0) {
          systemPrompt += "Nodes from that conversation:\n";
          memory.portalNodes.forEach(node => {
            systemPrompt += `- ${node.label}\n`;
          });
        }
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    });

    res.json({ 
      response: response.content[0].text 
    });

  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    res.status(500).json({ 
      error: 'Failed to get AI response',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Key present: ${!!process.env.ANTHROPIC_API_KEY}`);
});