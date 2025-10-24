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
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const updateNexusContent = useCanvasStore((state) => state.updateNexusContent);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const addNode = useCanvasStore((state) => state.addNode);
  const setQuotedText = useCanvasStore((state) => state.setQuotedText);
  const quotedText = useCanvasStore((state) => state.quotedText);

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

  // Find selected node or nexus
  const node = selectedId ? nodes[selectedId] : null;
  const nexus = selectedId ? nexuses.find((n) => n.id === selectedId) : null;
  const selectedItem = node || nexus;

  console.log('🎨 UnifiedNodeModal render:', {
    selectedId,
    hasNode: !!node,
    hasNexus: !!nexus,
    showContentOverlay,
    actionMode,
    isConnectionNode: node?.isConnectionNode,
  });

  // Initialize edited content when selection changes
  useEffect(() => {
    if (selectedItem && textareaRef.current) {
      const content = selectedItem.content || '';
      setEditedContent(content);
      setHasUnsavedChanges(false);
      textareaRef.current.value = content;
    }
  }, [selectedId, selectedItem]);

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
  useEffect(() => {
    setActionMode(null);
    setInputContent('');
    setSocraticQuestion(null);
    setSocraticRootId(null);
  }, [selectedId, showContentOverlay]);

  // Debug render tracking
  useEffect(() => {
    if (showContentOverlay && selectedItem) {
      console.log('🎨 UnifiedNodeModal FULL RENDER:', {
        selectedId,
        isNode: !!node,
        isNexus: !!nexus,
        isConnectionNode: node?.isConnectionNode,
        actionMode,
        socraticQuestion: !!socraticQuestion,
        showContentOverlay
      });
    }
  }, [showContentOverlay, selectedId, actionMode, socraticQuestion, node, nexus]);

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
    if (!inputContent.trim()) return;

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
      const contextContent = selectedItem?.content || '';
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
      addNode(combinedContent, selectedId, true);

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

    // If this is a connection node, use connection analysis
    if (node?.isConnectionNode) {
      handleConnectionAnalysis();
      return;
    }

    // Otherwise, start Socratic exploration
    setIsLoadingAI(true);

    try {
      const contextContent = selectedItem?.content || '';

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
      setSocraticQuestion(data.response);
      setSocraticRootId(selectedId);
      setInputContent('');
      setIsLoadingAI(false);
    } catch (error) {
      console.error('❌ Failed to start Socratic exploration:', error);
      setIsLoadingAI(false);
    }
  };

  // Handle Socratic answer submission
  const handleSocraticAnswer = async () => {
    if (!inputContent.trim() || !socraticRootId || !socraticQuestion) return;

    setIsLoadingAI(true);

    try {
      // Create user answer node
      const userAnswer = `Q: ${socraticQuestion}\n\nA: ${inputContent.trim()}`;
      addNode(userAnswer, socraticRootId);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Get AI's next question
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Previous question: "${socraticQuestion}"\nUser's answer: "${inputContent.trim()}"\n\nGenerate the NEXT Socratic question to continue the exploration. Keep it concise.`
          }],
          mode: 'socratic'
        }),
      });

      if (!response.ok) throw new Error('Failed to continue exploration');

      const data = await response.json();

      // Create AI question node
      const nextQuestion = `Next Question:\n${data.response}`;
      addNode(nextQuestion, socraticRootId, true);

      // Update for next round
      setSocraticQuestion(data.response);
      setInputContent('');
      setIsLoadingAI(false);
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

      // Create synthesis node
      addNode(`💎 Synthesis:\n${data.response}`, socraticRootId, false, true);

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
    if (!node?.isConnectionNode || !node.connectionData) return;

    setIsLoadingAI(true);

    try {
      const { sourceId, targetId } = node.connectionData;
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
  const shouldShowUserReplyButton = !isConnectionNode;
  const shouldShowAskAIButton = !isConnectionNode;
  const shouldShowExploreButton = true; // Always show

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
                    ref={textareaRef}
                    defaultValue={editedContent}
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
                  {selectedItem.content || 'No content available.'}
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
              <div
                className="p-4 flex gap-3"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  width: '100%',
                  border: '2px solid red' // DEBUG: Temporary border to see container
                }}
              >
                {/* For regular nodes and nexus, show all 3 buttons */}
                {!isConnectionNode ? (
                  <>
                    <button
                      onClick={() => setActionMode('user-reply')}
                      disabled={actionMode === 'user-reply'}
                      className={`flex-1 px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-medium
                        ${actionMode === 'user-reply'
                          ? 'bg-purple-600/40 border-2 border-purple-400 text-purple-200'
                          : 'bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300'}`}
                      style={{ border: '2px solid green' }} // DEBUG
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
                      style={{ border: '2px solid blue' }} // DEBUG
                    >
                      🤖 Ask AI
                    </button>
                    <button
                      onClick={handleExploreTogether}
                      disabled={isLoadingAI}
                      className="flex-1 px-4 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 text-yellow-300 rounded-lg transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                      style={{ border: '2px solid orange' }} // DEBUG
                    >
                      💭 Explore Together
                    </button>
                  </>
                ) : (
                  /* For connection nodes, only show Explore Together */
                  <button
                    onClick={handleExploreTogether}
                    disabled={isLoadingAI}
                    className="flex-1 px-4 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 text-yellow-300 rounded-lg transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                    style={{ border: '2px solid orange' }} // DEBUG
                  >
                    💭 Explore Together
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
