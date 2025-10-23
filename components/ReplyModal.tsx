'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';

export default function ReplyModal() {
  const [content, setContent] = useState('');
  const selectedId = useCanvasStore((state) => state.selectedId);
  const showReplyModal = useCanvasStore((state) => state.showReplyModal);
  const quotedText = useCanvasStore((state) => state.quotedText);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const addNode = useCanvasStore((state) => state.addNode);
  const addAIMessage = useCanvasStore((state) => state.addAIMessage);
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
    } else {
      // Normal behavior: create a child node
      addNode(content, selectedId, quotedText || undefined);
      setContent('');
      setShowReplyModal(false);
      setQuotedText(null);
      selectNode(null);
    }
  };
  
  const handleClose = () => {
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
        <h2 style={{ color: (isConnectionNode || isExistingConnectionNode) ? '#FFD700' : '#9333EA', marginBottom: '8px', fontSize: '24px' }}>
          {isExistingConnectionNode ? '💭 Socratic Exploration' : isConnectionNode ? '🔗 Explore Connection Together' : 'Reply to Node'}
        </h2>

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
              : "Type your reply..."
          }
          style={{
            width: '100%',
            height: '150px',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: '#374151',
            color: 'white',
            border: (isConnectionNode || isExistingConnectionNode) ? '2px solid #FFD700' : '2px solid #9333EA',
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
            disabled={!isConnectionNode && !content.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: (isConnectionNode || content.trim())
                ? ((isConnectionNode || isExistingConnectionNode) ? '#FFD700' : '#9333EA')
                : '#6b7280',
              color: (isConnectionNode || isExistingConnectionNode) ? '#000' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (isConnectionNode || content.trim()) ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            {isExistingConnectionNode ? '💬 Answer' : isConnectionNode ? '✨ Explore Together' : 'Submit Reply'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}