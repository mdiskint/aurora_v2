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

  const { nexuses, nodes, createChatNexus, addNode, getActivatedConversations, selectedId } = useCanvasStore();

  // 🧠 Track selection state
  useEffect(() => {
    if (selectedId) {
      console.log('🔍 Node/Nexus selected, will reply to it:', selectedId);
      setIsFirstMessage(false);
      setCurrentParentId(selectedId);
    } else {
      console.log('🔍 Nothing selected, will create new nexus if AI is used');
      setIsFirstMessage(true);
      setCurrentParentId(null);
    }
  }, [selectedId]);

  // 🧠 Build full conversation context
  const buildConversationContext = () => {
    const context: string[] = [];
    
    console.log('🧠 Building context...');
    console.log('🧠 Nexuses:', nexuses.length);
    console.log('🧠 Nodes:', Object.keys(nodes).length);
    
    // 1. Get activated conversations
    const activatedConvos = getActivatedConversations();
    console.log('🧠 Activated conversations:', activatedConvos.length);
    
    if (activatedConvos.length > 0) {
      context.push("=== ACTIVATED MEMORIES ===\n");
      activatedConvos.forEach(conv => {
        context.push(`**${conv.title}**`);
        context.push(conv.content);
        context.push("---\n");
      });
    }
    
    // 2. Get current conversation (use selected nexus or fallback)
    const selectedNexus = selectedId ? nexuses.find(n => n.id === selectedId) : null;
    const currentNexus = selectedNexus || nexuses.find(n => n.id.startsWith('chat-')) || nexuses[0];
    console.log('🧠 Current nexus:', currentNexus?.id, currentNexus?.title);
    
    if (currentNexus) {
      context.push("=== CURRENT CONVERSATION ===\n");
      context.push(`**Topic: ${currentNexus.title}**`);
      context.push(currentNexus.content);
      context.push("\n**Full Thread:**\n");
      
      // Get ALL nodes
      const conversationNodes = Object.values(nodes)
        .filter(node => node.parentId === currentNexus.id)
        .sort((a, b) => {
          const aTime = parseInt(a.id.split('-')[1]) || 0;
          const bTime = parseInt(b.id.split('-')[1]) || 0;
          return aTime - bTime;
        });
      
      console.log('🧠 Found nodes:', conversationNodes.length);
      
      conversationNodes.forEach(node => {
        console.log('  📝', node.isAI ? 'AI' : 'User', ':', node.content.substring(0, 50));
        
        if (node.isAI) {
          context.push(`\n[AI]: ${node.content}`);
        } else {
          context.push(`\n[User]: ${node.content}`);
        }
      });
    }
    
    const finalContext = context.join('\n');
    console.log('🧠 Final context length:', finalContext.length, 'characters');
    console.log('🧠 Context preview:', finalContext.substring(0, 200));
    
    return finalContext;
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    const explorePattern = /^explore:\s*/i;
    const isSpatialMode = explorePattern.test(userMessage);
    const cleanMessage = userMessage.replace(explorePattern, '').trim();

    setMessage('');
    setIsLoading(true);
    setError(null);

    console.log(isSpatialMode ? '🌌 SPATIAL MODE DETECTED' : '💬 Standard chat mode');
    console.log('🎯 isFirstMessage:', isFirstMessage);
    console.log('🎯 selectedId:', selectedId);

    let title = 'Chat';
    let actualPrompt = cleanMessage;

    if (isFirstMessage) {
      console.log('🔍 Raw message:', userMessage);
      console.log('🔍 Clean message:', cleanMessage);
      
      const titleIndex = cleanMessage.toLowerCase().indexOf('title:');
      const promptIndex = cleanMessage.toLowerCase().indexOf('prompt:');
      
      console.log('🔍 Title index:', titleIndex, 'Prompt index:', promptIndex);
      
      if (titleIndex !== -1 && promptIndex !== -1 && promptIndex > titleIndex) {
        title = cleanMessage.substring(titleIndex + 6, promptIndex).trim();
        actualPrompt = cleanMessage.substring(promptIndex + 7).trim();
        
        console.log('🔍 Parsed title:', title);
        console.log('🔍 Parsed prompt:', actualPrompt);
      } else {
        console.log('🔍 Could not find both Title: and Prompt:');
        if (isSpatialMode) {
          const words = cleanMessage.split(' ').slice(0, 5).join(' ');
          title = words + (cleanMessage.split(' ').length > 5 ? '...' : '');
        }
      }
    }

    // 🧠 Build full context
    const fullContext = buildConversationContext();
    
    const updatedHistory = [...conversationHistory, { role: 'user' as const, content: actualPrompt }];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: updatedHistory,
          mode: isSpatialMode ? 'spatial' : 'standard',
          conversationContext: fullContext,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Claude');
      }

      const data = await response.json();
      console.log('🔍 Backend response:', data);

      // 🌌 AI UNIVERSE CREATION: Check for spatialData in response
      if (data.spatialData) {
        console.log('✨ AI-generated universe detected!', data.spatialData);

        const { nexusTitle, nexusContent, nodes } = data.spatialData;

        // Step 1: Create nexus
        createChatNexus(nexusTitle, actualPrompt, nexusContent);
        console.log('✅ Created nexus:', nexusTitle);
        setIsFirstMessage(false);

        // Step 2: Wait for nexus to be created in state
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get the newly created nexus from store
        const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));

        if (!chatNexus) {
          console.error('❌ Failed to find created nexus');
          throw new Error('Nexus creation failed');
        }

        console.log('✅ Found nexus in store:', chatNexus.id);

        // Step 3: Create all child nodes
        for (const node of nodes) {
          console.log('✅ Creating node:', node.content.substring(0, 50));
          addNode(node.content, chatNexus.id);
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log('✅ Universe created with', nodes.length, 'nodes');

        // Update conversation history
        const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: data.response }];
        setConversationHistory(finalHistory);

        // Don't create regular chat response - universe creation is complete
      } else {
        // Standard response
        const aiResponse = data.response;
        const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: aiResponse }];
        setConversationHistory(finalHistory);

        if (isFirstMessage) {
          // Create new nexus (nothing was selected)
          console.log('🆕 Creating new nexus');
          createChatNexus(title, actualPrompt, aiResponse);
          setIsFirstMessage(false);
          
          setTimeout(() => {
            const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
            if (chatNexus) {
              const { selectNode } = useCanvasStore.getState();
              selectNode(chatNexus.id, true);
            }
          }, 300);
        } else {
          // 🧠 Reply to selected conversation
          const parentId = selectedId || currentParentId;
          
          console.log('🎯 Replying to existing conversation:', parentId);
          console.log('🎯 Selected ID:', selectedId);
          console.log('🎯 Current Parent:', currentParentId);
          
          if (!parentId) {
            throw new Error('No parent node found');
          }

          // 💜 Create ONE node with both prompt and response
          const combinedContent = `You: ${actualPrompt}\n\nClaude: ${aiResponse}`;
          addNode(combinedContent, parentId);
          
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

  const isSpatialModeActive = /^explore:\s*/i.test(message);

  return (
    <>
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
          {isSpatialModeActive ? '🌌 Spatial Exploration Mode' : '🧠 Aurora Chat'} {!isFirstMessage && '(Full Context Active)'}
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
          {isLoading
            ? (isSpatialModeActive ? '✨ Generating universe...' : 'Claude is thinking...')
            : (isSpatialModeActive ? '🌌 Explore in 3D Space' : 'Send Message')
          }
        </button>
      </div>

      <SpatialNavigator 
        sections={spatialSections} 
        isVisible={showSpatialNavigator} 
      />
    </>
  );
}