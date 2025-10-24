'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';

export default function ReplyModal() {
  const [content, setContent] = useState('');
  const [isAIMode, setIsAIMode] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const selectedId = useCanvasStore((state) => state.selectedId);
  const showReplyModal = useCanvasStore((state) => state.showReplyModal);
  const quotedText = useCanvasStore((state) => state.quotedText);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const addNode = useCanvasStore((state) => state.addNode);
  const addAIMessage = useCanvasStore((state) => state.addAIMessage);
  const addSynthesisNode = useCanvasStore((state) => state.addSynthesisNode);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const setShowReplyModal = useCanvasStore((state) => state.setShowReplyModal);
  const setQuotedText = useCanvasStore((state) => state.setQuotedText);

  // Watch selectedId changes
  useEffect(() => {
    const timestamp = Date.now();
    console.log(`🎯 ${timestamp} selectedId changed:`, selectedId, 'showReplyModal:', showReplyModal);
  }, [selectedId, showReplyModal]);

  const isOpen = showReplyModal && !!selectedId;

  // Check if this is a connection node
  const selectedNode = selectedId ? nodes[selectedId] : null;
  const isNewConnectionNode = selectedNode?.isConnectionNode && !selectedNode?.content.trim();
  const isExistingConnectionNode = selectedNode?.isConnectionNode && !!selectedNode?.content.trim();
  const isConnectionNode = isNewConnectionNode;

  // DEEP DEBUG logging
  const timestamp = Date.now();
  console.log(`🎨 ${timestamp} RENDER ReplyModal:`, {
    showReplyModal,
    isExistingConnectionNode,
    selectedNodeType: selectedNode?.isConnectionNode ? 'connection' : 'regular',
    selectedId,
    isConnectionNode: selectedNode?.isConnectionNode,
    hasContent: !!selectedNode?.content.trim(),
    isNewConnectionNode,
    timestamp
  });
  const connectedNodes = selectedNode?.isConnectionNode && selectedNode?.connectionNodes
    ? selectedNode.connectionNodes.map(id => nodes[id] || nexuses.find(n => n.id === id)).filter(Boolean)
    : [];

  let selectedContent = '';
  const selectedNexus = nexuses.find(n => n.id === selectedId);
  if (selectedNexus) {
    selectedContent = selectedNexus.content;
  } else if (selectedId && nodes[selectedId]) {
    selectedContent = nodes[selectedId].content;
  }
  
  const handleSubmit = async () => {
    if (!selectedId) return;

    // For regular nodes, require content
    if (!isConnectionNode && !content.trim()) return;

    console.log('📝 Submitting reply to:', selectedId);

    // Check if this is an empty connection node
    const selectedNode = nodes[selectedId];
    if (selectedNode && selectedNode.isConnectionNode && !selectedNode.content.trim()) {
      // Build context from connected nodes
      const connectedNodesContext = connectedNodes.map((node, idx) =>
        `${idx + 1}. ${(node as any).title || 'Node'}: ${(node as any).content || ''}`
      ).join('\n\n');

      // If user provided custom context, include it
      const userContext = content.trim() ? `\n\nUser context: ${content.trim()}` : '';

      // Call AI to generate first Socratic question
      console.log('🤖 Calling AI to generate first question...');
      const aiPrompt = `You are exploring connections between multiple ideas. Generate ONE thoughtful Socratic question that helps synthesize insights from these connected nodes:\n\n${connectedNodesContext}${userContext}\n\nGenerate a single, focused Socratic question that encourages deep thinking about how these ideas connect. Just the question, nothing else.`;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: aiPrompt }],
          }),
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        const data = await response.json();
        const firstQuestion = data.response;

        console.log('✏️ Storing first question in connection node:', selectedId);
        updateNodeContent(selectedId, firstQuestion);
        setContent('');
        setQuotedText(null);
        // Keep modal open to show first question and allow immediate answering
      } catch (error) {
        console.error('❌ Failed to generate question:', error);
        // Fallback to manual content if AI fails
        const fallbackContent = content.trim() || 'How do these ideas connect?';
        updateNodeContent(selectedId, fallbackContent);
        setContent('');
        setQuotedText(null);
        // Keep modal open to show question
      }
    } else if (isExistingConnectionNode) {
      // SOCRATIC MODE: User is answering an existing question
      const submitTimestamp = Date.now();
      console.log(`📤 ${submitTimestamp} SUBMIT Socratic answer:`, {
        keepingSocraticActive: true,
        selectedId,
        timestamp: submitTimestamp
      });

      // CRITICAL: Save the connection node ID before any operations
      const connectionNodeId = selectedId;
      console.log('💭 Socratic mode - connection node:', connectionNodeId);

      // 1. Create user's answer as a child of CONNECTION NODE (not chaining)
      addNode(content, connectionNodeId, quotedText || undefined);

      // 2. IMMEDIATELY re-select connection node to prevent modal switching
      // This ensures even if addNode triggered any selection changes, we stay on connection node
      setTimeout(() => selectNode(connectionNodeId, false), 0);

      // 3. Clear input and show loading state - KEEP MODAL OPEN
      setContent('');
      setQuotedText(null);
      console.log('⏳ Waiting for AI follow-up question...');

      // 4. Build conversation history from connection node's children
      const children = Object.values(nodes).filter(n => n.parentId === connectionNodeId);
      const conversationHistory = children.map(child => ({
        role: child.isAI ? 'assistant' : 'user',
        content: child.content
      }));

      // Add the current answer to history
      conversationHistory.push({
        role: 'user',
        content: content
      });

      // 4. Get AI follow-up question
      console.log('🤖 Getting AI follow-up question...');
      const socraticPrompt = `You are conducting a Socratic exploration. Based on this conversation history, generate ONE follow-up question that deepens the exploration. The question should build on the user's answer and probe deeper into the connections.\n\nConversation so far:\nInitial question: ${selectedContent}\nUser's answer: ${content}\n\nGenerate a single, focused follow-up question. Just the question, nothing else.`;

      // Use async/await to keep modal open and update with new question
      (async () => {
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: socraticPrompt }],
            }),
          });

          if (!response.ok) throw new Error('Failed to get AI response');

          const data = await response.json();
          const followUpQuestion = data.response;

          // 5. Create AI question node as child of CONNECTION NODE (not chaining)
          console.log('✏️ Creating AI follow-up question node');
          addAIMessage(followUpQuestion, connectionNodeId);

          // 6. CRITICAL: Re-select connection node again after AI node creation
          selectNode(connectionNodeId, false);

          // 7. Update connection node with new question
          // This will cause the modal to automatically show the new question
          updateNodeContent(connectionNodeId, followUpQuestion);

          console.log('✅ New question ready - modal updated automatically');
        } catch (error) {
          console.error('❌ Failed to generate follow-up question:', error);
          // On error, close the modal
          setShowReplyModal(false);
          selectNode(null);
        }
      })();
    } else if (isAIMode) {
      // AI MODE: Ask AI about selected node
      if (!content.trim()) return;

      console.log('🤖 AI Mode - Getting AI response for node:', selectedId);
      setIsLoadingAI(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `You are Aurora AI. The user is exploring a node with this content:\n\n"${selectedContent}"\n\nThe user asks: ${content}\n\nProvide a thoughtful, insightful response that helps them explore this idea further.`
            }],
            mode: 'reply'
          }),
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        const data = await response.json();
        console.log('✅ AI response received');

        // Create AI response as child node
        addAIMessage(data.response, selectedId);

        setContent('');
        setIsLoadingAI(false);
        setIsAIMode(false); // Reset AI mode
        setShowReplyModal(false);
        setQuotedText(null);
        selectNode(null);
      } catch (error) {
        console.error('❌ AI reply failed:', error);
        setIsLoadingAI(false);
        alert('Failed to get AI response. Please try again.');
      }
    } else {
      // Normal behavior: create a child node
      addNode(content, selectedId, quotedText || undefined);
      setContent('');
      setShowReplyModal(false);
      setQuotedText(null);
      selectNode(null);
    }
  };
  
  const handleClose = async () => {
    // Check if we're ending a Socratic exploration
    if (isExistingConnectionNode && selectedId) {
      const connectionNodeId = selectedId;
      console.log('💎 Ending Socratic exploration - generating synthesis...');

      // Gather all Socratic conversation history
      const children = Object.values(nodes).filter(n => n.parentId === connectionNodeId);
      const conversationHistory = children.map(child => ({
        role: child.isAI ? 'assistant' : 'user',
        content: child.content
      }));

      // Add the initial question
      conversationHistory.unshift({
        role: 'assistant',
        content: selectedContent
      });

      try {
        // Call API for synthesis
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Synthesize this Socratic exploration into key insights, connections, and suggested next steps:\n\nConversation:\n${conversationHistory.map((msg, idx) => `${idx + 1}. ${msg.role}: ${msg.content}`).join('\n\n')}\n\nProvide:\n1. Key insights discovered\n2. Connections between ideas\n3. Suggested next questions or areas to explore\n\nBe concise but comprehensive.`
            }],
            mode: 'synthesis'
          }),
        });

        if (!response.ok) throw new Error('Failed to get synthesis');

        const data = await response.json();
        const synthesis = data.response;

        // Create synthesis node
        console.log('💎 Creating synthesis node...');
        addSynthesisNode(synthesis, connectionNodeId);
      } catch (error) {
        console.error('❌ Failed to generate synthesis:', error);
        alert('Failed to generate synthesis. The exploration will end without a summary.');
      }
    }

    // Close modal
    setContent('');
    setShowReplyModal(false);
    setQuotedText(null);
    selectNode(null);
  };
  
  if (!isOpen) return null;
  
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 10, 30, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#1f2937',
          padding: '32px',
          borderRadius: '16px',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto',
          border: isConnectionNode ? '2px solid #FFD700' : '2px solid #9333EA',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: (isConnectionNode || isExistingConnectionNode) ? '#FFD700' : isAIMode ? '#00E5FF' : '#9333EA', marginBottom: '8px', fontSize: '24px' }}>
          {isExistingConnectionNode ? '💭 Socratic Exploration' : isConnectionNode ? '🔗 Explore Connection Together' : isAIMode ? '🤖 Ask AI' : 'Reply to Node'}
        </h2>

        {/* AI Mode Toggle - Only for regular nodes */}
        {!isConnectionNode && !isExistingConnectionNode && (
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setIsAIMode(false)}
              style={{
                flex: 1,
                padding: '8px 16px',
                backgroundColor: !isAIMode ? '#9333EA' : '#374151',
                color: !isAIMode ? '#fff' : '#9ca3af',
                border: `2px solid ${!isAIMode ? '#9333EA' : '#4B5563'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: !isAIMode ? 'bold' : 'normal',
                fontSize: '14px',
              }}
            >
              💬 User Reply
            </button>
            <button
              onClick={() => setIsAIMode(true)}
              style={{
                flex: 1,
                padding: '8px 16px',
                backgroundColor: isAIMode ? '#00E5FF' : '#374151',
                color: isAIMode ? '#000' : '#9ca3af',
                border: `2px solid ${isAIMode ? '#00E5FF' : '#4B5563'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: isAIMode ? 'bold' : 'normal',
                fontSize: '14px',
              }}
            >
              🤖 Ask AI
            </button>
          </div>
        )}

        {/* Show the Socratic question for existing connection nodes */}
        {isExistingConnectionNode && (
          <div style={{
            backgroundColor: '#374151',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '2px solid #FFD700',
          }}>
            <div style={{
              color: '#FFD700',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Question:
            </div>
            <div style={{
              color: 'white',
              fontSize: '18px',
              lineHeight: '1.6',
              fontStyle: 'italic',
            }}>
              {selectedContent}
            </div>
          </div>
        )}

        {isConnectionNode && connectedNodes.length > 0 && (
          <div style={{
            backgroundColor: '#374151',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '2px solid #FFD700',
          }}>
            <div style={{
              color: '#FFD700',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Connected Nodes ({connectedNodes.length}):
            </div>
            {connectedNodes.map((node, idx) => (
              <div key={idx} style={{
                color: '#d1d5db',
                fontSize: '14px',
                marginBottom: '8px',
                paddingLeft: '12px',
                borderLeft: '3px solid #FFD700',
              }}>
                {idx + 1}. {(node as any).title || (node as any).content?.slice(0, 60) || 'Untitled'}
              </div>
            ))}
          </div>
        )}

        {!isConnectionNode && !isExistingConnectionNode && (
          <p style={{ color: '#9ca3af', marginBottom: '16px', fontSize: '14px' }}>
            Replying to: {selectedContent.slice(0, 50)}{selectedContent.length > 50 ? '...' : ''}
          </p>
        )}
        
        {/* Quoted Text Section - Prominent Display (not for Socratic mode) */}
        {quotedText && !isExistingConnectionNode && !isConnectionNode && (
          <div style={{
            backgroundColor: '#374151',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid #9333EA',
          }}>
            <div style={{ 
              color: '#9ca3af', 
              fontSize: '12px', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Quoted Section:
            </div>
            <div style={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              {quotedText}
            </div>
          </div>
        )}
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isExistingConnectionNode
              ? "Type your answer to continue the Socratic exploration..."
              : isConnectionNode
              ? "(Optional) Add context or questions to guide the exploration... Or click 'Explore Together' to let AI start!"
              : isAIMode
              ? "What would you like to explore about this node? Ask AI anything..."
              : "Type your reply..."
          }
          style={{
            width: '100%',
            height: '150px',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: '#374151',
            color: 'white',
            border: (isConnectionNode || isExistingConnectionNode) ? '2px solid #FFD700' : isAIMode ? '2px solid #00E5FF' : '2px solid #9333EA',
            borderRadius: '8px',
            marginBottom: '16px',
            resize: 'vertical',
          }}
          autoFocus
        />
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              backgroundColor: isExistingConnectionNode ? '#dc2626' : '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: isExistingConnectionNode ? 'bold' : 'normal',
            }}
          >
            {isExistingConnectionNode ? '🛑 End Exploration' : 'Cancel'}
          </button>

          <button
            onClick={handleSubmit}
            disabled={!isConnectionNode && !content.trim() && !isLoadingAI}
            style={{
              padding: '10px 20px',
              backgroundColor: isLoadingAI
                ? '#6b7280'
                : (isConnectionNode || content.trim())
                ? ((isConnectionNode || isExistingConnectionNode) ? '#FFD700' : isAIMode ? '#00E5FF' : '#9333EA')
                : '#6b7280',
              color: (isConnectionNode || isExistingConnectionNode) ? '#000' : isAIMode ? '#000' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (isConnectionNode || content.trim()) && !isLoadingAI ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            {isLoadingAI
              ? '🤖 AI is thinking...'
              : isExistingConnectionNode
              ? '💬 Answer'
              : isConnectionNode
              ? '✨ Explore Together'
              : isAIMode
              ? '🤖 Ask AI'
              : 'Submit Reply'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}