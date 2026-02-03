'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';

export default function ReplyModal() {
  const [content, setContent] = useState('');
  const [isAIMode, setIsAIMode] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [socraticQuestion, setSocraticQuestion] = useState<string | null>(null);
  const [socraticRootId, setSocraticRootId] = useState<string | null>(null);
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

  // Check if we're in single-node Socratic exploration mode
  const isSingleNodeSocratic = !!socraticQuestion && socraticRootId === selectedId;

  // DEEP DEBUG logging
  const timestamp = Date.now();
  console.log(`🎨 ${timestamp} RENDER ReplyModal:`, {
    showReplyModal,
    isExistingConnectionNode,
    selectedNodeType: selectedNode?.isConnectionNode ? 'connection' : 'regular',
    selectedId,
    selectedNode: selectedNode ? {
      id: selectedNode.id,
      isAI: selectedNode.isAI,
      isConnectionNode: selectedNode.isConnectionNode,
      isSynthesis: selectedNode.isSynthesis,
      hasContent: !!selectedNode.content,
    } : null,
    isConnectionNode,
    isNewConnectionNode,
    isSingleNodeSocratic,
    socraticQuestion,
    socraticRootId,
    shouldShowExploreButton: !isConnectionNode && !isExistingConnectionNode && !isSingleNodeSocratic,
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

  const handleExploreThisIdea = async () => {
    if (!selectedId || !selectedContent) return;

    console.log('💭 Starting single-node Socratic exploration for:', selectedId);
    setIsLoadingAI(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `You are conducting a Socratic exploration of this idea:\n\n"${selectedContent}"\n\nGenerate ONE thoughtful Socratic question that helps the user explore this idea more deeply. The question should probe assumptions, implications, or connections. Just the question, nothing else.`
          }],
          mode: 'socratic'
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const data = await response.json();
      const firstQuestion = data.response;

      console.log('✅ First Socratic question generated:', firstQuestion);

      // Set up Socratic exploration state
      setSocraticQuestion(firstQuestion);
      setSocraticRootId(selectedId);
      setContent('');
      setIsLoadingAI(false);

      // Modal stays open to show the question
    } catch (error) {
      console.error('❌ Failed to start Socratic exploration:', error);
      setIsLoadingAI(false);
      alert('Failed to start exploration. Please try again.');
    }
  };

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
        // Calculate node depth to decide if we should use web search
        let replyDepth = 1;
        let walkReplyId: string | undefined = selectedId || undefined;
        const nexusIdsForReply = new Set(nexuses.map(n => n.id));
        if (walkReplyId && !nexusIdsForReply.has(walkReplyId) && nodes[walkReplyId]) {
          walkReplyId = nodes[walkReplyId].parentId;
          while (walkReplyId && !nexusIdsForReply.has(walkReplyId) && nodes[walkReplyId]) {
            replyDepth++;
            walkReplyId = nodes[walkReplyId].parentId;
          }
        }
        const useSearch = replyDepth >= 2;
        console.log(`🔍 Reply AI: node depth=${replyDepth}, useSearch=${useSearch}`);

        // Build full universe context so AI can search across all nodes
        const universeContext: string[] = [];
        nexuses.forEach(nex => {
          universeContext.push(`[Nexus: ${nex.title}]\n${nex.content}`);
          const children = Object.values(nodes).filter(n => n.parentId === nex.id);
          children.forEach(child => {
            universeContext.push(`  [Node: ${child.title || child.id}]\n  ${child.content.substring(0, 500)}`);
          });
        });
        const universeSnapshot = universeContext.join('\n\n');

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `You are Astryon AI. The user is exploring their conversation universe. Search across ALL nodes to answer their question.

=== FULL UNIVERSE ===
${universeSnapshot}

=== CURRENTLY SELECTED NODE ===
${selectedContent}

=== USER QUESTION ===
${content}

Answer using information from ANY node in the universe, not just the selected one. If the answer draws from multiple nodes, reference which concepts you're connecting.${useSearch ? ' If the universe lacks sufficient information, use web search results to supplement your answer with real-world facts, citations, or current developments.' : ''}`
            }],
            mode: useSearch ? 'ask-with-search' : 'reply'
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
    } else if (isSingleNodeSocratic) {
      // SINGLE-NODE SOCRATIC MODE: User is answering the current question
      if (!content.trim()) return;

      console.log('💭 Single-node Socratic answer:', content);

      // 1. Create user's answer as child of root node
      addNode(content, socraticRootId!, quotedText || undefined);

      // 2. Clear input and show loading
      setContent('');
      setQuotedText(null);
      setIsLoadingAI(true);

      // 3. Build conversation history from root node's children
      const children = Object.values(nodes).filter(n => n.parentId === socraticRootId);
      const conversationHistory = children.map(child => ({
        role: child.isAI ? 'assistant' : 'user',
        content: child.content
      }));

      // Add current answer to history
      conversationHistory.push({
        role: 'user',
        content: content
      });

      // 4. Get AI follow-up question
      console.log('🤖 Getting follow-up Socratic question...');
      const socraticPrompt = `You are conducting a Socratic exploration of this idea:\n\n"${selectedContent}"\n\nConversation so far:\nInitial question: ${socraticQuestion}\nUser's answer: ${content}\n\nGenerate ONE follow-up question that deepens the exploration. Build on the user's answer and probe deeper. Just the question, nothing else.`;

      // Async call to keep modal open
      (async () => {
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: socraticPrompt }],
              mode: 'socratic'
            }),
          });

          if (!response.ok) throw new Error('Failed to get AI response');

          const data = await response.json();
          const followUpQuestion = data.response;

          console.log('✅ Follow-up question:', followUpQuestion);

          // 5. Create AI question node as child of root node
          addAIMessage(followUpQuestion, socraticRootId!);

          // 6. Update current question in state
          setSocraticQuestion(followUpQuestion);
          setIsLoadingAI(false);

          console.log('✅ New question ready - modal updated');
        } catch (error) {
          console.error('❌ Failed to generate follow-up question:', error);
          setIsLoadingAI(false);
          // On error, close modal and reset
          setSocraticQuestion(null);
          setSocraticRootId(null);
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

  const handleClose = async () => {
    // Check if we're ending a connection node Socratic exploration
    if (isExistingConnectionNode && selectedId) {
      const connectionNodeId = selectedId;
      console.log('💎 Ending connection node Socratic exploration - generating synthesis...');

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

    // Check if we're ending a single-node Socratic exploration
    if (isSingleNodeSocratic && socraticRootId) {
      console.log('💎 Ending single-node Socratic exploration - generating synthesis...');

      // Gather all Q&A history from the root node's children
      const children = Object.values(nodes).filter(n => n.parentId === socraticRootId);
      const conversationHistory = children.map(child => ({
        role: child.isAI ? 'assistant' : 'user',
        content: child.content
      }));

      // Add the initial question
      conversationHistory.unshift({
        role: 'assistant',
        content: socraticQuestion || 'Initial question'
      });

      try {
        // Call API for synthesis
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Synthesize this Socratic exploration of the idea "${selectedContent}" into key insights:\n\nConversation:\n${conversationHistory.map((msg, idx) => `${idx + 1}. ${msg.role}: ${msg.content}`).join('\n\n')}\n\nProvide:\n1. Key insights discovered\n2. Deeper understanding gained\n3. Suggested next questions or areas to explore\n\nBe concise but comprehensive.`
            }],
            mode: 'synthesis'
          }),
        });

        if (!response.ok) throw new Error('Failed to get synthesis');

        const data = await response.json();
        const synthesis = data.response;

        // Create synthesis node as child of root
        console.log('💎 Creating synthesis node...');
        addSynthesisNode(synthesis, socraticRootId);
      } catch (error) {
        console.error('❌ Failed to generate synthesis:', error);
        alert('Failed to generate synthesis. The exploration will end without a summary.');
      }

      // Reset single-node Socratic state
      setSocraticQuestion(null);
      setSocraticRootId(null);
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
        <h2 style={{ color: (isConnectionNode || isExistingConnectionNode || isSingleNodeSocratic) ? '#FFD700' : isAIMode ? '#00E5FF' : '#9333EA', marginBottom: '8px', fontSize: '24px' }}>
          {isExistingConnectionNode ? '💭 Socratic Exploration (Connection)' : isConnectionNode ? '🔗 Explore Connection Together' : isSingleNodeSocratic ? '💭 Socratic Exploration' : isAIMode ? '🤖 Ask AI' : 'Reply to Node'}
        </h2>

        {/* AI Mode Toggle & Explore Button - Only for regular nodes */}
        {!isConnectionNode && !isExistingConnectionNode && !isSingleNodeSocratic && (
          <>
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

            {/* Explore This Idea Button */}
            <button
              onClick={handleExploreThisIdea}
              disabled={isLoadingAI}
              style={{
                width: '100%',
                marginBottom: '16px',
                padding: '12px 16px',
                backgroundColor: isLoadingAI ? '#6b7280' : 'rgba(255, 215, 0, 0.1)',
                border: '2px solid #FFD700',
                borderRadius: '8px',
                color: '#FFD700',
                cursor: isLoadingAI ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontSize: '15px',
                fontWeight: 'bold',
              }}
              onMouseEnter={(e) => {
                if (!isLoadingAI) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoadingAI) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
                }
              }}
            >
              {isLoadingAI ? '🤖 Starting exploration...' : '💭 Explore This Idea'}
            </button>
          </>
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

        {/* Show the Socratic question for single-node exploration */}
        {isSingleNodeSocratic && socraticQuestion && (
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
              Exploring:
            </div>
            <div style={{
              color: '#9ca3af',
              fontSize: '14px',
              marginBottom: '12px',
              fontStyle: 'italic',
            }}>
              "{selectedContent.slice(0, 100)}{selectedContent.length > 100 ? '...' : ''}"
            </div>
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
              {socraticQuestion}
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
              : isSingleNodeSocratic
                ? "Type your answer to continue exploring this idea..."
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
            border: (isConnectionNode || isExistingConnectionNode || isSingleNodeSocratic) ? '2px solid #FFD700' : isAIMode ? '2px solid #00E5FF' : '2px solid #9333EA',
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
              backgroundColor: (isExistingConnectionNode || isSingleNodeSocratic) ? '#dc2626' : '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: (isExistingConnectionNode || isSingleNodeSocratic) ? 'bold' : 'normal',
            }}
          >
            {(isExistingConnectionNode || isSingleNodeSocratic) ? '🛑 End Exploration' : 'Cancel'}
          </button>

          <button
            onClick={handleSubmit}
            disabled={!isConnectionNode && !content.trim() && !isLoadingAI}
            style={{
              padding: '10px 20px',
              backgroundColor: isLoadingAI
                ? '#6b7280'
                : (isConnectionNode || content.trim())
                  ? ((isConnectionNode || isExistingConnectionNode || isSingleNodeSocratic) ? '#FFD700' : isAIMode ? '#00E5FF' : '#9333EA')
                  : '#6b7280',
              color: (isConnectionNode || isExistingConnectionNode || isSingleNodeSocratic) ? '#000' : isAIMode ? '#000' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (isConnectionNode || content.trim()) && !isLoadingAI ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            {isLoadingAI
              ? '🤖 AI is thinking...'
              : isSingleNodeSocratic
                ? '💬 Answer'
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