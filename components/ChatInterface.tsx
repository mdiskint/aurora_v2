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

  // 🧠 GAP Mode state
  const [gapModeEnabled, setGapModeEnabled] = useState(false);
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [parallelTasks, setParallelTasks] = useState<string[]>([]);
  const [planningReasoning, setPlanningReasoning] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressStatus, setProgressStatus] = useState<{ [key: number]: 'pending' | 'complete' | 'error' }>({});

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

  // 🧠 GAP Mode: Build graph structure with compression
  const buildGraphStructure = () => {
    console.log('🧠 GAP Mode: Building graph structure...');

    if (nexuses.length === 0) {
      console.log('🧠 GAP Mode: No universe loaded, returning empty structure');
      return null;
    }

    // Get current nexus
    const currentNexus = selectedId
      ? nexuses.find(n => n.id === selectedId) || nexuses[0]
      : nexuses[0];

    if (!currentNexus) {
      console.log('🧠 GAP Mode: No current nexus found');
      return null;
    }

    console.log('🧠 GAP Mode: Current nexus:', currentNexus.title);

    // Helper function to calculate node level
    const getNodeLevel = (nodeId: string): number => {
      let level = 0;
      let currentId = nodeId;
      let visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const node = nodes[currentId];
        if (!node) break;

        // If parent is a nexus, we're at L1
        if (nexuses.find(n => n.id === node.parentId)) {
          return 1;
        }

        // Otherwise, go up one level
        level++;
        currentId = node.parentId;

        // Safety check to prevent infinite loops
        if (level > 20) break;
      }

      return level;
    };

    // Collect all nodes in current universe
    const universeNodes = Object.values(nodes).filter(node => {
      // Check if node belongs to current universe
      let currentId = node.id;
      let visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        if (currentId === currentNexus.id) return true;
        const n = nodes[currentId];
        if (!n) break;
        currentId = n.parentId;
        if (visited.size > 100) break; // Safety
      }

      return false;
    });

    console.log('🧠 GAP Mode: Found', universeNodes.length, 'nodes in universe');

    // Build compressed node data
    const compressedNodes = universeNodes.map(node => {
      const level = getNodeLevel(node.id);
      const isL1 = level === 1;

      return {
        id: node.id,
        type: node.nodeType || 'user-reply',
        content: isL1 ? node.content : node.content.substring(0, 100) + (node.content.length > 100 ? '...' : ''),
        parentId: node.parentId,
        level: level,
        position: node.position
      };
    });

    // Build connections
    const connections = universeNodes.map(node => ({
      from: node.parentId,
      to: node.id
    }));

    const graphStructure = {
      nexus: {
        id: currentNexus.id,
        content: currentNexus.content,
        title: currentNexus.title,
        position: currentNexus.position
      },
      nodes: compressedNodes,
      connections: connections
    };

    // Calculate approximate token count
    const approxTokens = Math.ceil(JSON.stringify(graphStructure).length / 4);
    console.log('🧠 GAP Mode: Graph structure built');
    console.log('🧠 GAP Mode: Nodes:', compressedNodes.length);
    console.log('🧠 GAP Mode: Connections:', connections.length);
    console.log('🧠 GAP Mode: Approx tokens:', approxTokens);

    return graphStructure;
  };

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

    // 🌌 IMPORTANT: For Explore commands, send to API but don't save to state
    // We need to send at least one message to API for processing
    const messagesForAPI = [...conversationHistory, { role: 'user' as const, content: actualPrompt }];

    // Only update state history for non-spatial mode
    const updatedHistory = isSpatialMode
      ? conversationHistory  // Keep state unchanged for Explore commands
      : messagesForAPI;      // Update state for regular messages

    console.log(isSpatialMode ? '🌌 Explore command - sending to API but NOT saving to state' : '💬 Regular message - adding to state');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesForAPI,  // Always send messages to API
          mode: isSpatialMode ? 'spatial' : 'standard',
          conversationContext: fullContext,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', response.status, errorText);

        if (response.status === 429) {
          throw new Error('Rate limit reached. Please wait 60 seconds and try again.');
        }

        if (response.status === 402) {
          throw new Error('API quota exceeded. Check your Anthropic billing.');
        }

        if (response.status === 500) {
          throw new Error(`Server error: ${errorText.substring(0, 200)}`);
        }

        throw new Error(`API Error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      console.log('🔍 Backend response:', data);

      // 🌌 AI UNIVERSE CREATION: Check for spatialData in response
      if (data.spatialData) {
        console.log('✨ AI-generated universe detected!', data.spatialData);

        const { nexusTitle, nexusContent, nodes } = data.spatialData;

        // 🔍 DEBUG: Log what we received from backend
        console.log('📦 spatialData received:', {
          nexusTitle: nexusTitle,
          nexusContent: nexusContent.substring(0, 50) + '...',
          nodeCount: nodes.length,
          firstNode: nodes[0]?.content.substring(0, 50) + '...',
          nodesPreview: nodes.map((n: any, idx: number) => `Node ${idx + 1}: ${n.content.substring(0, 30)}...`)
        });
        console.log('🔍 Does nexusContent match first node?', nexusContent === nodes[0]?.content);

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
        console.log(`🔄 Creating ${nodes.length} child nodes...`);
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          console.log(`✅ Creating node ${i + 1}/${nodes.length}:`, node.content.substring(0, 50) + '...');
          addNode(node.content, chatNexus.id, undefined, 'ai-response');
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log('✅ Universe created with', nodes.length, 'nodes');

        // 🔥 CRITICAL FIX: Save universe AFTER all nodes are created
        console.log('💾 Saving complete universe with all nodes...');
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for last node to settle
        useCanvasStore.getState().saveCurrentUniverse();
        console.log('✅ Universe saved to library');

        // 📸 Create snapshot of original state (nexus + initial L1 nodes)
        console.log('📸 Creating snapshot of original universe state...');
        const activeId = useCanvasStore.getState().activeUniverseId;
        if (activeId) {
          useCanvasStore.getState().createSnapshot(activeId);
          console.log('✅ Snapshot created for universe:', activeId);
        }

        // 🌌 Don't update conversation history for Explore commands
        // The universe structure IS the conversation, not a message exchange
        console.log('🌌 Explore command complete - conversation history unchanged');

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

          // 🔥 CRITICAL FIX: Save regular chat universe after creation
          setTimeout(() => {
            console.log('💾 Saving regular chat universe...');
            useCanvasStore.getState().saveCurrentUniverse();
            console.log('✅ Regular chat universe saved to library');
          }, 400); // After selection timeout
        } else {
          // 🧠 Reply to selected conversation
          const parentId = selectedId || currentParentId;
          
          console.log('🎯 Replying to existing conversation:', parentId);
          console.log('🎯 Selected ID:', selectedId);
          console.log('🎯 Current Parent:', currentParentId);
          
          if (!parentId) {
            throw new Error('No parent node found');
          }

          // Step 1: Wait 300ms after receiving response (moment to breathe)
          await new Promise(resolve => setTimeout(resolve, 300));

          // Step 2: Create ONE node with both prompt and response (camera will animate)
          const combinedContent = `You: ${actualPrompt}\n\nClaude: ${aiResponse}`;
          const newNodeId = addNode(combinedContent, parentId, undefined, 'ai-response');

          // Step 3: Wait for camera animation (800ms) + buffer (300ms) = 1100ms
          await new Promise(resolve => setTimeout(resolve, 1100));

          // Step 4: Open modal smoothly
          const { selectNode } = useCanvasStore.getState();
          selectNode(newNodeId, true);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ color: isSpatialModeActive ? '#9333EA' : '#00FFD4', fontSize: '14px', fontWeight: 'bold' }}>
            {isSpatialModeActive ? '🌌 Spatial Exploration Mode' : '🧠 Aurora Chat'} {!isFirstMessage && '(Full Context Active)'}
          </div>

          {/* GAP Mode Toggle Button */}
          <button
            onClick={() => setGapModeEnabled(!gapModeEnabled)}
            title="GAP Mode: Enable graph-aware AI that reasons over your entire universe structure. More intelligent but uses more tokens."
            style={{
              padding: '6px 12px',
              backgroundColor: gapModeEnabled ? '#8B5CF6' : '#333',
              color: gapModeEnabled ? '#fff' : '#666',
              border: `2px solid ${gapModeEnabled ? '#8B5CF6' : '#555'}`,
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: gapModeEnabled ? '0 0 12px rgba(139, 92, 246, 0.6)' : 'none',
              animation: gapModeEnabled ? 'pulse 2s ease-in-out infinite' : 'none',
            }}
          >
            🧠 GAP
          </button>
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

      {/* GAP Mode: Planning Modal */}
      {showPlanningModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#0A1628',
            border: '3px solid #8B5CF6',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 0 40px rgba(139, 92, 246, 0.4)'
          }}>
            <h2 style={{
              color: '#8B5CF6',
              fontSize: '24px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              🧠 GRAPH-AWARE PARALLEL EXPLORATION
            </h2>

            <div style={{
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid #8B5CF6',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                color: '#E5E7EB',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                AI Analysis:
              </div>
              <div style={{
                color: '#D1D5DB',
                fontSize: '14px',
                lineHeight: '1.6'
              }}>
                {planningReasoning}
              </div>
            </div>

            <div style={{
              marginBottom: '20px'
            }}>
              <div style={{
                color: '#E5E7EB',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '12px'
              }}>
                Independent tasks to explore:
              </div>
              {parallelTasks.map((task, index) => (
                <div key={index} style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10B981',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <span style={{ color: '#10B981', fontSize: '16px' }}>✓</span>
                  <span style={{ color: '#D1D5DB', fontSize: '14px', flex: 1 }}>
                    Task {index + 1}: {task}
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              color: '#9CA3AF',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              These will be created as sibling nodes.
              <br />
              Estimated time: ~{parallelTasks.length * 7} seconds
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowPlanningModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  color: '#9CA3AF',
                  border: '2px solid #4B5563',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowPlanningModal(false);
                  // Execute parallel tasks (to be implemented)
                  console.log('🧠 GAP Mode: Executing parallel tasks...');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#8B5CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
                }}
              >
                Execute Parallel Exploration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAP Mode: Progress Modal */}
      {showProgressModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{
            backgroundColor: '#0A1628',
            border: '2px solid #8B5CF6',
            borderRadius: '16px',
            padding: '32px',
            minWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '16px'
            }}>⚡</div>

            <h3 style={{
              color: '#8B5CF6',
              fontSize: '20px',
              marginBottom: '20px'
            }}>
              EXECUTING PARALLEL EXPLORATION
            </h3>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {parallelTasks.map((task, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  borderRadius: '8px'
                }}>
                  <span style={{
                    fontSize: '18px'
                  }}>
                    {progressStatus[index] === 'complete' ? '✅' : progressStatus[index] === 'error' ? '❌' : '⏳'}
                  </span>
                  <span style={{
                    color: '#E5E7EB',
                    fontSize: '14px',
                    flex: 1,
                    textAlign: 'left'
                  }}>
                    Task {index + 1}: {progressStatus[index] === 'complete' ? 'Complete' : progressStatus[index] === 'error' ? 'Error' : 'In progress...'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowProgressModal(false);
                setProgressStatus({});
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#9CA3AF',
                border: '2px solid #4B5563',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel remaining
            </button>
          </div>
        </div>
      )}

      {/* Pulse animation for GAP Mode button */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
          }
          50% {
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.9);
          }
        }
      `}</style>

      <SpatialNavigator
        sections={spatialSections}
        isVisible={showSpatialNavigator}
      />
    </>
  );
}