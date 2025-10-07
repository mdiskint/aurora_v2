require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Chat endpoint - now handles full conversation history
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Call Claude API with full conversation history
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: messages,
    });

    // Extract text from response
    const aiResponse = response.content[0].text;

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error calling Claude API:', error);
    res.status(500).json({ error: 'Failed to get response from Claude' });
  }
});

app.listen(port, () => {
  console.log(`Aurora chat server running on http://localhost:${port}`);
});