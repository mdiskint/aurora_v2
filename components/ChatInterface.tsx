'use client';

import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import SpatialNavigator from './SpatialNavigator';

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
  const [spatialSections, setSpatialSections] = useState<Array<{ title: string; type: string }>>([]);
  const [showSpatialNavigator, setShowSpatialNavigator] = useState(false);

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

    // ✨ NEW: Check for Explore: prefix (case-insensitive)
    const explorePattern = /^explore:\s*/i;
    const isSpatialMode = explorePattern.test(userMessage);
    const cleanMessage = userMessage.replace(explorePattern, '').trim();

    console.log(isSpatialMode ? '🌌 SPATIAL MODE DETECTED' : '💬 Standard chat mode');

    // ✨ Parse title and prompt for first message
    let title = 'Chat';
    let actualPrompt = cleanMessage;

    if (isFirstMessage) {
      console.log('🔍 Raw message:', userMessage);
      console.log('🔍 Clean message:', cleanMessage);
      
      // Check if message has both Title: and Prompt: patterns
      const titleIndex = cleanMessage.toLowerCase().indexOf('title:');
      const promptIndex = cleanMessage.toLowerCase().indexOf('prompt:');
      
      console.log('🔍 Title index:', titleIndex, 'Prompt index:', promptIndex);
      
      if (titleIndex !== -1 && promptIndex !== -1 && promptIndex > titleIndex) {
        // Extract title (between "Title:" and "Prompt:")
        title = cleanMessage.substring(titleIndex + 6, promptIndex).trim();
        // Extract prompt (everything after "Prompt:")
        actualPrompt = cleanMessage.substring(promptIndex + 7).trim();
        
        console.log('🔍 Parsed title:', title);
        console.log('🔍 Parsed prompt:', actualPrompt);
      } else {
        console.log('🔍 Could not find both Title: and Prompt:');
        // If no Title/Prompt format, use first few words as title for spatial mode
        if (isSpatialMode) {
          const words = cleanMessage.split(' ').slice(0, 5).join(' ');
          title = words + (cleanMessage.split(' ').length > 5 ? '...' : '');
        }
      }
    }

    // Add user message to conversation history (use actual prompt, not title)
    const updatedHistory = [...conversationHistory, { role: 'user' as const, content: actualPrompt }];

    try {
      // ✨ NEW: Call backend API with mode parameter
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: updatedHistory,
          mode: isSpatialMode ? 'spatial' : 'standard'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Claude');
      }

      const data = await response.json();
      console.log('🔍 Backend response:', data);
      console.log('🔍 Mode:', data.mode);
      console.log('🔍 SpatialData:', data.spatialData);

      
      // ✨ NEW: Handle spatial vs standard responses
      if (data.mode === 'spatial' && data.spatialData) {
        console.log('✨ Processing spatial response:', data.spatialData);
        console.log('📊 Number of nodes in spatialData:', data.spatialData.nodes?.length);
        console.log('📊 Nodes array:', data.spatialData.nodes);
        
        // Add AI response to history (use the raw response for history)
        const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: data.response }];
        setConversationHistory(finalHistory);

        // ✨ FIXED: Handle first message vs subsequent messages
        if (isFirstMessage) {
          console.log('🆕 First message - creating nexus with first section only');
          
          // ✨ CRITICAL FIX: First section becomes the nexus, rest become nodes
          const firstSection = data.spatialData.nodes[0];
          const remainingSections = data.spatialData.nodes.slice(1);

          // ✨ NEW: Store sections for the navigator
          setSpatialSections(data.spatialData.nodes);
          setShowSpatialNavigator(true);

          console.log('📍 First section (NEXUS):', firstSection?.title);
          console.log('📊 Remaining sections (NODES):', remainingSections.length);
          
          // Create nexus with ONLY the first section
          const nexusTitle = title !== 'Chat' ? title : (firstSection?.title || 'Spatial Exploration');

          // ✨ NEW: Create a clean prompt message for the nexus (not the full text dump)
          const cleanPromptMessage = actualPrompt.length > 200 
            ? "Parse and spatially organize the provided document." 
            : actualPrompt;

          const nexusContent = `${cleanPromptMessage}\n\n**${firstSection?.title || 'Introduction'}**\n\n${firstSection?.content || 'Spatial exploration starting point'}`;

          createChatNexus(nexusTitle, cleanPromptMessage, nexusContent);
          setIsFirstMessage(false);
          
          // Wait for nexus to be created, then add REMAINING nodes
          setTimeout(() => {
            console.log('⏰ Timeout fired - checking for nexus');
            const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
            console.log('🔍 Found nexus:', chatNexus);
            
            if (chatNexus) {
              console.log(`🌌 Creating ${remainingSections.length} reply nodes...`);
              
              // Create nodes for sections 2-N (NOT section 1, that's the nexus)
              remainingSections.forEach((node: any, index: number) => {
                const nodeContent = `${node.title}\n\n${node.content}`;
                
                console.log(`📝 Scheduling node ${index + 1}:`, node.title);
                
                setTimeout(() => {
                  console.log(`✅ Creating node ${index + 1}:`, node.title);
                  addNode(nodeContent, chatNexus.id);
                }, index * 100);
              });
            } else {
              console.error('❌ No chat nexus found!');
            }
          }, 300);
        } else {
          // Subsequent spatial explorations
          const selectedId = useCanvasStore.getState().selectedId;
          const parentId = selectedId || currentParentId || nexuses[0]?.id;
          
          if (!parentId) {
            throw new Error('No parent node found');
          }

          // Create a node for each item in the spatial response
          data.spatialData.nodes.forEach((node: any, index: number) => {
            const nodeContent = `${node.title}\n\n${node.content}`;
            
            setTimeout(() => {
              addNode(nodeContent, parentId);
            }, index * 100);
          });

          console.log(`🌌 Created ${data.spatialData.nodes.length} spatial nodes`);
        }
      } else {
        // Standard single response
        const aiResponse = data.response;

        // Add AI response to conversation history
        const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: aiResponse }];
        setConversationHistory(finalHistory);

        if (isFirstMessage) {
          // First exchange: Create Chat Nexus with parsed title and both messages
          createChatNexus(title, actualPrompt, aiResponse);
          setIsFirstMessage(false);
          
          // Auto-show overlay for chat nexus
          setTimeout(() => {
            const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
            if (chatNexus) {
              const { selectNode } = useCanvasStore.getState();
              selectNode(chatNexus.id, true);
            }
          }, 300);
        } else {
          // Subsequent exchanges: Create single node
          const selectedId = useCanvasStore.getState().selectedId;
          const parentId = selectedId || currentParentId || nexuses[0]?.id;
          
          if (!parentId) {
            throw new Error('No parent node found');
          }

          const combinedContent = `You: ${actualPrompt}\n\nClaude: ${aiResponse}`;
          addNode(combinedContent, parentId);
          
          // Auto-show the content overlay
          setTimeout(() => {
            const { setShowContentOverlay } = useCanvasStore.getState();
            setShowContentOverlay(true);
          }, 200);
        }
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

  // ✨ NEW: Detect if user is typing "Explore:"
  const isSpatialModeActive = /^explore:\s*/i.test(message);

  return (
    <>
      {/* Chat Interface */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          width: '400px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: `1px solid ${isSpatialModeActive ? '#9333EA' : '#00FFD4'}`,
          borderRadius: '8px',
          padding: '16px',
          zIndex: 1000,
        }}
      >
        <div style={{ marginBottom: '12px', color: isSpatialModeActive ? '#9333EA' : '#00FFD4', fontSize: '14px', fontWeight: 'bold' }}>
          {isSpatialModeActive ? '🌌 Spatial Exploration Mode' : 'Aurora Chat'} {!isFirstMessage && '(Replying to conversation)'}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isSpatialModeActive ? "Spatial mode active! AI will create multiple nodes..." : "Type your message... (or 'Explore: [prompt]' for spatial mode)"}
          disabled={isLoading}
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '8px',
            backgroundColor: '#1a1a1a',
            border: `1px solid ${isSpatialModeActive ? '#9333EA' : '#333'}`,
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
            backgroundColor: isLoading || !message.trim() ? '#333' : (isSpatialModeActive ? '#9333EA' : '#00FFD4'),
            color: isLoading || !message.trim() ? '#666' : (isSpatialModeActive ? '#fff' : '#000'),
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: isLoading || !message.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Claude is thinking...' : (isSpatialModeActive ? '🌌 Explore in 3D Space' : 'Send Message')}
        </button>
      </div>

      {/* ✨ Spatial Navigator - separate component positioned bottom-right */}
      <SpatialNavigator 
        sections={spatialSections} 
        isVisible={showSpatialNavigator} 
      />
    </>
  );
}