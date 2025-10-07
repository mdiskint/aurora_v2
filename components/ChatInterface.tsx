'use client';

import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);

  const { nexuses, createChatNexus, addUserMessage, addAIMessage } = useCanvasStore();

  // Track if we have a chat nexus
  useEffect(() => {
    const chatNexus = nexuses.find(n => n.id.startsWith('chat-'));
    if (chatNexus && isFirstMessage) {
      setCurrentParentId(chatNexus.id);
      setIsFirstMessage(false);
    }
  }, [nexuses, isFirstMessage]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');
    setIsLoading(true);
    setError(null);

    // Add user message to conversation history
    const updatedHistory = [...conversationHistory, { role: 'user' as const, content: userMessage }];

    try {
      // Call backend API with full conversation history
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: updatedHistory }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Claude');
      }

      const data = await response.json();
      const aiResponse = data.response;

      // Add AI response to conversation history
      const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: aiResponse }];
      setConversationHistory(finalHistory);

      if (isFirstMessage) {
        // First exchange: Create Nexus
        createChatNexus(userMessage, aiResponse);
        setIsFirstMessage(false);
        // currentParentId will be set by useEffect
  } else {
  // Subsequent exchanges: Create user node, then AI node
  // Use selectedId from store if available (user clicked something), otherwise use currentParentId
  const selectedId = useCanvasStore.getState().selectedId;
  const parentId = selectedId || currentParentId || nexuses[0]?.id;
  
  if (!parentId) {
    throw new Error('No parent node found');
  }

  // Create user message node (purple octahedron)
  const userNodeId = addUserMessage(userMessage, parentId);
  
  // Wait a moment for render, then create AI response node (orange cube)
  setTimeout(() => {
    addAIMessage(aiResponse, userNodeId);
    // Set the user node as the new parent for linear continuation
    setCurrentParentId(userNodeId);
  }, 500);
}
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to send message. Make sure the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        width: '400px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        border: '1px solid #00FFD4',
        borderRadius: '8px',
        padding: '16px',
        zIndex: 1000,
      }}
    >
      <div style={{ marginBottom: '12px', color: '#00FFD4', fontSize: '14px', fontWeight: 'bold' }}>
        Aurora Chat {!isFirstMessage && '(Replying to conversation)'}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your message..."
        disabled={isLoading}
        style={{
          width: '100%',
          minHeight: '80px',
          padding: '8px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '14px',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      {error && (
        <div style={{ color: '#ff4444', fontSize: '12px', marginTop: '8px' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSendMessage}
        disabled={isLoading || !message.trim()}
        style={{
          marginTop: '12px',
          width: '100%',
          padding: '10px',
          backgroundColor: isLoading || !message.trim() ? '#333' : '#00FFD4',
          color: isLoading || !message.trim() ? '#666' : '#000',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: isLoading || !message.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {isLoading ? 'Claude is thinking...' : 'Send Message'}
      </button>
    </div>
  );
}