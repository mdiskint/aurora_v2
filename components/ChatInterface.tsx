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

  const { nexuses, createChatNexus, addNode } = useCanvasStore();

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

    // Parse title and prompt for first message
    let title = 'Chat';
    let actualPrompt = userMessage;
    
    if (isFirstMessage) {
      console.log('🔍 Raw message:', userMessage);
      
      // Check if message has both Title: and Prompt: patterns
      const titleIndex = userMessage.toLowerCase().indexOf('title:');
      const promptIndex = userMessage.toLowerCase().indexOf('prompt:');
      
      console.log('🔍 Title index:', titleIndex, 'Prompt index:', promptIndex);
      
      if (titleIndex !== -1 && promptIndex !== -1 && promptIndex > titleIndex) {
        // Extract title (between "Title:" and "Prompt:")
        title = userMessage.substring(titleIndex + 6, promptIndex).trim();
        // Extract prompt (everything after "Prompt:")
        actualPrompt = userMessage.substring(promptIndex + 7).trim();
        
        console.log('🔍 Parsed title:', title);
        console.log('🔍 Parsed prompt:', actualPrompt);
      } else {
        console.log('🔍 Could not find both Title: and Prompt:');
      }
    }

    // Add user message to conversation history (use actual prompt, not title)
    const updatedHistory = [...conversationHistory, { role: 'user' as const, content: actualPrompt }];

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
        // First exchange: Create Chat Nexus with parsed title and both messages
        // Pass the title and the actual prompt (not the full formatted string)
        createChatNexus(title, actualPrompt, aiResponse);
        setIsFirstMessage(false);
        
        // Auto-show overlay for chat nexus too
        setTimeout(() => {
          const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
          if (chatNexus) {
            const { selectNode } = useCanvasStore.getState();
            selectNode(chatNexus.id, true); // true = show overlay
          }
        }, 300);
      } else {
        // Subsequent exchanges: Create single node with both user message AND AI response
        const selectedId = useCanvasStore.getState().selectedId;
        const parentId = selectedId || currentParentId || nexuses[0]?.id;
        
        if (!parentId) {
          throw new Error('No parent node found');
        }

        // Format content to include both user and AI messages
        const combinedContent = `You: ${actualPrompt}\n\nClaude: ${aiResponse}`;
        
        // Create single node with both messages
        addNode(combinedContent, parentId);
        
        // Auto-show the content overlay for chat nodes
        setTimeout(() => {
          const { setShowContentOverlay } = useCanvasStore.getState();
          setShowContentOverlay(true);
        }, 200);
        
        // Update parent for next message (this creates threading)
        // Note: addNode already selects the new node via setTimeout,
        // so the next reply will naturally thread from it
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