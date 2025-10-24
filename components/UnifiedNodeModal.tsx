'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCanvasStore } from '@/lib/store';

type ActionMode = 'user-reply' | 'ask-ai' | 'explore-together' | null;

export default function UnifiedNodeModal() {
  const pathname = usePathname();
  const isExplorePage = pathname === '/explore' || pathname === '/create' || pathname === '/chat';

  const selectedId = useCanvasStore((state) => state.selectedId);
  const nodes = useCanvasStore((state) => state.nodes);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const showContentOverlay = useCanvasStore((state) => state.showContentOverlay);
  const setShowContentOverlay = useCanvasStore((state) => state.setShowContentOverlay);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const updateNexusContent = useCanvasStore((state) => state.updateNexusContent);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const addNode = useCanvasStore((state) => state.addNode);
  const setQuotedText = useCanvasStore((state) => state.setQuotedText);
  const quotedText = useCanvasStore((state) => state.quotedText);
  const createMetaInspirationNode = useCanvasStore((state) => state.createMetaInspirationNode);

  // Content editing state
  const [editedContent, setEditedContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Action mode state
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [inputContent, setInputContent] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [socraticQuestion, setSocraticQuestion] = useState<string | null>(null);
  const [socraticRootId, setSocraticRootId] = useState<string | null>(null);

  // CRITICAL: Use a ref to immediately track Socratic mode (prevents race conditions with async state)
  const isSocraticModeActive = useRef(false);

  // Find selected node or nexus
  const node = selectedId ? nodes[selectedId] : null;
  const nexus = selectedId ? nexuses.find((n) => n.id === selectedId) : null;
  const selectedItem = node || nexus;

  // For connection nodes, build content from all connected nodes
  const getConnectionContent = () => {
    if (!node?.isConnectionNode || !node.connectionNodes) {
      console.log('❌ Not a connection node or no connectionNodes:', {
        isConnectionNode: node?.isConnectionNode,
        connectionNodes: node?.connectionNodes
      });
      return node?.content || '';
    }

    console.log('🔗 Connection node detected:', {
      nodeId: node.id,
      connectionNodes: node.connectionNodes,
      nodeCount: node.connectionNodes.length,
      isMetaInspiration: node.id.startsWith('meta-inspiration')
    });

    const contentParts: string[] = [];

    // For meta-inspiration nodes, first element is the nexus ID
    const isMetaNode = node.id.startsWith('meta-inspiration');
    if (isMetaNode && node.connectionNodes.length > 0) {
      const nexusId = node.connectionNodes[0];
      const nexus = nexuses.find(n => n.id === nexusId);
      if (nexus) {
        console.log('  🌌 Found nexus:', nexus.title);
        contentParts.push(`━━━ NEXUS: ${nexus.title} ━━━\n${nexus.content}`);
      }

      // Remaining items are nodes
      for (let i = 1; i < node.connectionNodes.length; i++) {
        const nodeId = node.connectionNodes[i];
        const foundNode = nodes[nodeId];
        if (foundNode) {
          const label = foundNode.title || `Node ${i}`;
          console.log(`  Node ${i}: ${label.substring(0, 30)}...`);
          contentParts.push(`━━━ ${label} ━━━\n${foundNode.content}`);
        }
      }
    } else {
      // Regular connection node - all items are nodes
      node.connectionNodes.forEach((id, idx) => {
        const foundNode = nodes[id];
        if (foundNode) {
          const label = foundNode.title || `Node ${idx + 1}`;
          console.log(`  Node ${idx + 1}: ${label.substring(0, 30)}...`);
          contentParts.push(`━━━ ${label} ━━━\n${foundNode.content}`);
        }
      });
    }

    console.log('📦 Content parts found:', contentParts.length);

    if (contentParts.length === 0) {
      console.log('⚠️ No content parts found, falling back to node content');
      return node?.content || '';
    }

    const combined = contentParts.join('\n\n');
    console.log('✅ Combined content length:', combined.length);
    return combined;
  };

  const displayContent = node?.isConnectionNode ? getConnectionContent() : (selectedItem?.content || '');

  console.log('🎨 UnifiedNodeModal render:', {
    selectedId,
    hasNode: !!node,
    hasNexus: !!nexus,
    showContentOverlay,
    actionMode,
    isConnectionNode: node?.isConnectionNode,
    displayContentLength: displayContent?.length,
    selectedItemContentLength: selectedItem?.content?.length,
  });

  // Initialize edited content when selection changes
  useEffect(() => {
    console.log('📝 useEffect for content initialization triggered:', {
      hasSelectedItem: !!selectedItem,
      hasTextareaRef: !!textareaRef.current,
      displayContentLength: displayContent?.length,
      isConnectionNode: node?.isConnectionNode,
    });

    if (selectedItem && textareaRef.current) {
      const content = displayContent;
      console.log('✍️ Setting textarea content:', {
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      });
      setEditedContent(content);
      setHasUnsavedChanges(false);
      textareaRef.current.value = content;
      console.log('✅ Textarea value set, length:', textareaRef.current.value.length);
    }
  }, [selectedId, selectedItem, displayContent]);

  // Auto-save on node switch
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (hasUnsavedChanges && selectedItem && isExplorePage && textareaRef.current) {
        const currentValue = textareaRef.current.value;
        if (node) {
          updateNodeContent(node.id, currentValue);
        } else if (nexus) {
          updateNexusContent(nexus.id, currentValue);
        }
      }
    };
  }, [selectedId]);

  // Reset action mode when modal closes or selection changes
  // CRITICAL: Don't clear Socratic state if we're still on the same root node during exploration
  useEffect(() => {
    console.log('🔄 useEffect triggered:', {
      showContentOverlay,
      selectedId,
      socraticRootId,
      hasSocraticQuestion: !!socraticQuestion,
      isSocraticModeActive: isSocraticModeActive.current
    });

    // CRITICAL FIX: Check the ref for immediate protection (prevents async state race conditions)
    if (isSocraticModeActive.current) {
      console.log('💭 Socratic mode ACTIVE (via ref) - PRESERVING all state');
      return; // Don't clear ANYTHING during active Socratic exploration
    }

    // Check state-based Socratic mode as backup
    if (socraticRootId) {
      console.log('💭 Active Socratic exploration (via state) - PRESERVING question state');
      // Only clear if we navigate to a DIFFERENT node that's not the root
      if (selectedId && selectedId !== socraticRootId) {
        console.log('🔀 Navigating away from Socratic root - clearing state');
        setSocraticQuestion(null);
        setSocraticRootId(null);
        setActionMode(null);
        setInputContent('');
      }
      return;
    }

    // Not in Socratic mode - normal clearing logic
    if (!showContentOverlay) {
      console.log('❌ Modal closing (no Socratic mode) - clearing action mode');
      setActionMode(null);
      setInputContent('');
    }
  }, [selectedId, showContentOverlay, socraticRootId, socraticQuestion]);

  // Debug render tracking
  useEffect(() => {
    if (showContentOverlay && selectedItem) {
      console.log('🎨 UnifiedNodeModal FULL RENDER:', {
        selectedId,
        isNode: !!node,
        isNexus: !!nexus,
        isConnectionNode: node?.isConnectionNode,
        actionMode,
        socraticQuestion: socraticQuestion ? socraticQuestion.substring(0, 50) + '...' : null,
        socraticRootId,
        showContentOverlay,
        willShowSocraticSection: !!socraticQuestion
      });
    }
  }, [showContentOverlay, selectedId, actionMode, socraticQuestion, socraticRootId, node, nexus]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setHasUnsavedChanges(true);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const currentValue = textareaRef.current?.value || '';
      if (isExplorePage && selectedItem) {
        if (node) {
          updateNodeContent(node.id, currentValue);
        } else if (nexus) {
          updateNexusContent(nexus.id, currentValue);
        }
        setHasUnsavedChanges(false);
        console.log('✅ Auto-saved changes to:', selectedItem.id);
      }
    }, 1000);
  };

  const handleClose = () => {
    // Save before closing if there are unsaved changes
    if (hasUnsavedChanges && selectedItem && isExplorePage && textareaRef.current) {
      const currentValue = textareaRef.current.value;
      if (node) {
        updateNodeContent(node.id, currentValue);
      } else if (nexus) {
        updateNexusContent(nexus.id, currentValue);
      }
    }

    // If in Socratic mode, generate synthesis
    if (socraticRootId && socraticQuestion) {
      handleEndExploration();
      return;
    }

    selectNode(selectedId, false);
  };

  // 💬 USER REPLY
  const handleUserReply = () => {
    if (!inputContent.trim() || !selectedId) return;

    const content = quotedText
      ? `> ${quotedText}\n\n${inputContent.trim()}`
      : inputContent.trim();

    addNode(content, selectedId);
    setInputContent('');
    setActionMode(null);
    setQuotedText(null);

    setTimeout(() => {
      selectNode(selectedId, false);
    }, 200);
  };

  // 🤖 ASK AI
  const handleAskAI = async () => {
    if (!inputContent.trim() || !selectedId) return;

    setIsLoadingAI(true);

    try {
      const contextContent = displayContent || '';
      const fullPrompt = `Context from selected node:\n"${contextContent}"\n\nUser question: ${inputContent.trim()}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: fullPrompt }],
          mode: 'standard',
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const data = await response.json();
      const combinedContent = `You: ${inputContent.trim()}\n\nClaude: ${data.response}`;
      addNode(combinedContent, selectedId);

      setInputContent('');
      setActionMode(null);
      setIsLoadingAI(false);

      setTimeout(() => {
        selectNode(selectedId, false);
      }, 200);
    } catch (error) {
      console.error('❌ Failed to get AI response:', error);
      setIsLoadingAI(false);
    }
  };

  // 💭 EXPLORE TOGETHER
  const handleExploreTogether = async () => {
    if (!selectedId) return;

    // Start Socratic exploration (works for both regular nodes and connection nodes)
    setIsLoadingAI(true);

    try {
      // Use displayContent to get all connected nodes' content for connection nodes
      const contextContent = displayContent;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `You are conducting a Socratic exploration of this idea:\n\n"${contextContent}"\n\nGenerate ONE thoughtful Socratic question that challenges assumptions, explores implications, or probes deeper understanding. Keep it concise (1-2 sentences).`
          }],
          mode: 'socratic'
        }),
      });

      if (!response.ok) throw new Error('Failed to start exploration');

      const data = await response.json();

      // Set ref IMMEDIATELY (before state updates)
      isSocraticModeActive.current = true;
      console.log('🔒 Socratic mode ref set to TRUE - state protected');

      setSocraticQuestion(data.response);
      setSocraticRootId(selectedId);
      setInputContent('');
      setIsLoadingAI(false);
    } catch (error) {
      console.error('❌ Failed to start Socratic exploration:', error);
      setIsLoadingAI(false);
    }
  };

  // 🌌 EXPLORE ENTIRE UNIVERSE
  const handleExploreUniverse = () => {
    if (!nexus) {
      console.error('❌ Cannot explore universe - not a nexus');
      return;
    }

    console.log('🌌 Creating meta-inspiration node for nexus:', nexus.id);
    createMetaInspirationNode(nexus.id);

    // Close modal and select the new meta-inspiration node
    setTimeout(() => {
      selectNode(selectedId, false);
    }, 200);
  };

  // Handle Socratic answer submission
  const handleSocraticAnswer = async () => {
    if (!inputContent.trim() || !socraticRootId || !socraticQuestion) return;

    console.log('💭 Starting Socratic answer submission...');
    console.log('   Root ID:', socraticRootId);
    console.log('   Current question:', socraticQuestion.substring(0, 50) + '...');
    console.log('   Current selectedId:', selectedId);

    const userAnswerText = inputContent.trim();
    setIsLoadingAI(true);

    try {
      // Get AI's next question FIRST (before creating nodes)
      console.log('🤖 Requesting next Socratic question from AI...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Previous question: "${socraticQuestion}"\nUser's answer: "${userAnswerText}"\n\nGenerate the NEXT Socratic question to continue the exploration. Keep it concise.`
          }],
          mode: 'socratic'
        }),
      });

      if (!response.ok) throw new Error('Failed to continue exploration');

      const data = await response.json();
      const nextQuestion = data.response;
      console.log('✅ Received next question:', nextQuestion.substring(0, 50) + '...');

      // CRITICAL: Keep ref TRUE to protect state during node creation
      isSocraticModeActive.current = true;
      console.log('🔒 Socratic mode ref STILL TRUE - continuing protection');

      // NOW update state FIRST before creating any nodes
      console.log('🔄 Updating Socratic state with new question BEFORE creating nodes');
      setSocraticQuestion(nextQuestion);
      setInputContent('');
      setIsLoadingAI(false);

      // THEN create the nodes (this will trigger auto-selection but state is already updated)
      const userAnswer = `Q: ${socraticQuestion}\n\nA: ${userAnswerText}`;
      console.log('📝 Creating user answer node...');
      addNode(userAnswer, socraticRootId);

      const nextQuestionNode = `Next Question:\n${nextQuestion}`;
      console.log('📝 Creating AI question node...');
      addNode(nextQuestionNode, socraticRootId);

      // CRITICAL FIX: addNode calls selectNode(newId, false) which CLOSES the modal
      // We need to force it back open and select the root node
      setTimeout(() => {
        console.log('🔓 Forcing modal to stay open and selecting root node');
        selectNode(socraticRootId, true);
        setShowContentOverlay(true);
      }, 100);

      console.log('✅ Socratic exploration continuing - state updated, nodes created');
      console.log('   New question in state:', nextQuestion.substring(0, 30));
    } catch (error) {
      console.error('❌ Failed to continue Socratic dialogue:', error);
      setIsLoadingAI(false);
    }
  };

  // End exploration and create synthesis
  const handleEndExploration = async () => {
    if (!socraticRootId) return;

    setIsLoadingAI(true);

    try {
      const rootNode = nodes[socraticRootId];
      if (!rootNode) throw new Error('Root node not found');

      const explorationNodes = Object.values(nodes)
        .filter(n => n.parentId === socraticRootId)
        .sort((a, b) => {
          const aTime = parseInt(a.id.split('-')[1]) || 0;
          const bTime = parseInt(b.id.split('-')[1]) || 0;
          return aTime - bTime;
        });

      const conversation = explorationNodes.map(n => n.content).join('\n\n---\n\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Original idea: "${rootNode.content}"\n\nSocratic exploration:\n${conversation}\n\nGenerate a brief synthesis (2-3 sentences) of key insights discovered.`
          }],
          mode: 'synthesis'
        }),
      });

      if (!response.ok) throw new Error('Failed to generate synthesis');

      const data = await response.json();

      // Create synthesis node using the special synthesis node creator
      const { addSynthesisNode } = useCanvasStore.getState();
      addSynthesisNode(data.response, socraticRootId);

      // CRITICAL: Clear the ref to allow normal state clearing
      isSocraticModeActive.current = false;
      console.log('🔓 Socratic mode ref set to FALSE - exploration ended');

      setSocraticQuestion(null);
      setSocraticRootId(null);
      setInputContent('');
      setActionMode(null);
      setIsLoadingAI(false);

      setTimeout(() => {
        selectNode(selectedId, false);
      }, 200);
    } catch (error) {
      console.error('❌ Failed to create synthesis:', error);
      setIsLoadingAI(false);
    }
  };

  // Connection analysis (for connection nodes)
  const handleConnectionAnalysis = async () => {
    if (!node?.isConnectionNode || !node.connectionNodes || node.connectionNodes.length < 2) return;

    setIsLoadingAI(true);

    try {
      const [sourceId, targetId] = node.connectionNodes;
      const sourceNode = nodes[sourceId];
      const targetNode = nodes[targetId];

      if (!sourceNode || !targetNode) {
        throw new Error('Connected nodes not found');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Analyze the connection between these two ideas:\n\nIdea 1: "${sourceNode.content}"\n\nIdea 2: "${targetNode.content}"\n\nProvide a thoughtful synthesis of how these ideas relate, complement, or challenge each other. Be specific and insightful (2-3 paragraphs).`
          }],
          mode: 'connection'
        }),
      });

      if (!response.ok) throw new Error('Failed to analyze connection');

      const data = await response.json();

      // Update connection node with AI analysis
      updateNodeContent(node.id, `🔗 Connection Analysis:\n\n${data.response}`);

      setIsLoadingAI(false);
      setActionMode(null);

      setTimeout(() => {
        selectNode(selectedId, false);
      }, 200);
    } catch (error) {
      console.error('❌ Failed to analyze connection:', error);
      setIsLoadingAI(false);
    }
  };

  // Highlight quoted text selection
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const highlightedText = selection?.toString().trim() || '';

    if (highlightedText && actionMode === 'user-reply') {
      setQuotedText(highlightedText);
      console.log('📝 Quoted text:', highlightedText);
    }
  };

  // Don't show if nothing selected or overlay is hidden
  if (!selectedItem || !showContentOverlay) return null;

  const isConnectionNode = node?.isConnectionNode || false;
  // Show all three buttons for both regular nodes and connection nodes
  const shouldShowUserReplyButton = true;
  const shouldShowAskAIButton = true;
  const shouldShowExploreButton = true;

  console.log('🔘 Button section render - DETAILED:', {
    isConnectionNode,
    nodeType: node ? 'node' : nexus ? 'nexus' : 'unknown',
    nodeIsConnectionNode: node?.isConnectionNode,
    actionMode,
    socraticQuestion: !!socraticQuestion,
    showingActionModeInput: !!actionMode,
    willShowButtonRow: !socraticQuestion,
    selectedId
  });

  console.log('🔘 Individual button visibility:', {
    shouldShowUserReplyButton,
    shouldShowAskAIButton,
    shouldShowExploreButton,
    totalButtonsToShow: [shouldShowUserReplyButton, shouldShowAskAIButton, shouldShowExploreButton].filter(Boolean).length
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000]"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[2001]"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '70vw',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/50 rounded-2xl shadow-2xl h-full flex flex-col">

          {/* TOP SECTION - Content Display */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-cyan-500/30 flex items-start justify-between flex-shrink-0">
              <div className="flex-1">
                <h2 className={`text-2xl font-bold mb-2 ${(node?.isSynthesis) ? 'text-cyan-300' : isConnectionNode ? 'text-yellow-300' : 'text-cyan-400'}`}>
                  {selectedItem.title || (selectedItem.content?.substring(0, 50) + (selectedItem.content?.length > 50 ? '...' : ''))}
                </h2>
                <div className="flex items-center gap-4">
                  {hasUnsavedChanges && isExplorePage && (
                    <div className="text-sm text-yellow-400 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                      Saving...
                    </div>
                  )}
                  {!hasUnsavedChanges && isExplorePage && selectedItem && (
                    <div className="text-sm text-green-400/80 flex items-center gap-2">
                      ✓ Saved
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    ID: {selectedItem.id}
                  </div>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {isExplorePage && selectedItem ? (
                <div className="relative h-full flex flex-col">
                  <textarea
                    key={selectedId}
                    ref={textareaRef}
                    defaultValue={displayContent}
                    onChange={handleContentChange}
                    onMouseUp={handleTextSelection}
                    className="w-full flex-1 bg-slate-950/50 text-gray-200 border border-cyan-500/20 rounded-lg p-4
                             focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30
                             resize-none text-base leading-relaxed"
                    placeholder="Start typing to edit this section..."
                    spellCheck={true}
                    style={{ minHeight: '300px' }}
                  />
                  <div className="mt-2 text-xs text-gray-500 italic">
                    💡 Changes auto-save as you type • Ctrl+Z to undo works naturally
                  </div>
                </div>
              ) : (
                <div
                  className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap"
                  onMouseUp={handleTextSelection}
                >
                  {displayContent || 'No content available.'}
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM SECTION - Action Buttons */}
          <div className="border-t border-cyan-500/30 flex-shrink-0">
            {/* Socratic Question Display */}
            {socraticQuestion && (
              <div className="p-4 bg-gradient-to-r from-cyan-900/30 to-purple-900/30 border-b border-cyan-500/20">
                <div className="text-sm text-cyan-300 mb-2 font-semibold">💭 Socratic Question:</div>
                <div className="text-gray-200 text-base mb-3">{socraticQuestion}</div>
                <textarea
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={isLoadingAI}
                  className="w-full bg-slate-950/50 text-gray-200 border border-cyan-500/20 rounded-lg p-3
                           focus:outline-none focus:border-cyan-500/50 resize-none"
                  rows={3}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSocraticAnswer}
                    disabled={isLoadingAI || !inputContent.trim()}
                    className="flex-1 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50
                             text-cyan-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingAI ? '🤔 Thinking...' : 'Continue Exploration'}
                  </button>
                  <button
                    onClick={handleEndExploration}
                    disabled={isLoadingAI}
                    className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50
                             text-purple-300 rounded-lg transition-all disabled:opacity-50"
                  >
                    End & Synthesize
                  </button>
                </div>
              </div>
            )}

            {/* Action Mode Input */}
            {actionMode && !socraticQuestion && (
              <div className="p-4 bg-slate-950/30 border-b border-cyan-500/20">
                <div className="text-sm text-cyan-300 mb-2 font-semibold">
                  {actionMode === 'user-reply' && '💬 Your Reply'}
                  {actionMode === 'ask-ai' && '🤖 Ask AI'}
                </div>
                {quotedText && actionMode === 'user-reply' && (
                  <div className="mb-2 p-2 bg-purple-900/20 border-l-4 border-purple-500 rounded text-sm text-gray-300 italic">
                    &gt; {quotedText}
                  </div>
                )}
                <textarea
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  placeholder={
                    actionMode === 'user-reply'
                      ? 'Type your reply...'
                      : 'What would you like to know about this?'
                  }
                  disabled={isLoadingAI}
                  className="w-full bg-slate-950/50 text-gray-200 border border-cyan-500/20 rounded-lg p-3
                           focus:outline-none focus:border-cyan-500/50 resize-none"
                  rows={3}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={actionMode === 'user-reply' ? handleUserReply : handleAskAI}
                    disabled={isLoadingAI || !inputContent.trim()}
                    className="flex-1 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50
                             text-cyan-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingAI ? '⏳ Loading...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => {
                      setActionMode(null);
                      setInputContent('');
                      setQuotedText(null);
                    }}
                    className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50
                             text-gray-300 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons Row */}
            {!socraticQuestion && (
              <div className="p-4 space-y-3">
                {/* First row: 3 standard buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setActionMode('user-reply')}
                    disabled={actionMode === 'user-reply'}
                    className={`flex-1 px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-medium
                      ${actionMode === 'user-reply'
                        ? 'bg-purple-600/40 border-2 border-purple-400 text-purple-200'
                        : 'bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300'}`}
                  >
                    💬 User Reply
                  </button>
                  <button
                    onClick={() => setActionMode('ask-ai')}
                    disabled={actionMode === 'ask-ai' || isLoadingAI}
                    className={`flex-1 px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-medium
                      ${actionMode === 'ask-ai'
                        ? 'bg-cyan-600/40 border-2 border-cyan-400 text-cyan-200'
                        : 'bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300'}`}
                  >
                    🤖 Ask AI
                  </button>
                  <button
                    onClick={handleExploreTogether}
                    disabled={isLoadingAI}
                    className="flex-1 px-4 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 text-yellow-300 rounded-lg transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                  >
                    💭 Explore This Idea
                  </button>
                </div>

                {/* Second row: Explore Entire Universe button (only for nexuses) */}
                {nexus && (
                  <button
                    onClick={handleExploreUniverse}
                    disabled={isLoadingAI}
                    className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20
                             hover:from-indigo-600/30 hover:to-purple-600/30
                             border-2 border-indigo-500/50 text-indigo-300 rounded-lg transition-all
                             flex items-center justify-center gap-2 font-medium disabled:opacity-50
                             shadow-lg shadow-indigo-500/10"
                  >
                    🌌 Explore Entire Universe
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
