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
  const updateNode = useCanvasStore((state) => state.updateNode);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const addNode = useCanvasStore((state) => state.addNode);
  const setQuotedText = useCanvasStore((state) => state.setQuotedText);
  const quotedText = useCanvasStore((state) => state.quotedText);
  const createMetaInspirationNode = useCanvasStore((state) => state.createMetaInspirationNode);
  const toggleAnchor = useCanvasStore((state) => state.toggleAnchor);

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
  const [isVisible, setIsVisible] = useState(false);
  const [showAnchorFeedback, setShowAnchorFeedback] = useState(false);

  // Quiz Me / Deep Thinking mode state
  const [explorationMode, setExplorationMode] = useState<'deep-thinking' | 'quiz' | null>(null);
  const [quizFeedback, setQuizFeedback] = useState('');
  const [deepThinkingEngagement, setDeepThinkingEngagement] = useState(''); // AI's response to user's thinking
  const [quizHistory, setQuizHistory] = useState<string[]>([]); // Track previous questions for diverse question generation
  const [deepThinkingHistory, setDeepThinkingHistory] = useState<Array<{
    question: string;
    userAnswer: string;
    aiEngagement: string;
  }>>([]); // Track deep thinking conversation for progressive depth

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

  // Fade-in animation when modal opens
  useEffect(() => {
    if (showContentOverlay) {
      // Reset to invisible
      setIsVisible(false);
      // Trigger fade-in after a tiny delay (for CSS transition to work)
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [showContentOverlay]);

  // ⌨️ KEYBOARD NAVIGATION: Arrow keys to navigate node hierarchy (works globally)
  useEffect(() => {
    if (!node && !nexus) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable) {
        return;
      }

      // Check if we're on a nexus
      const isOnNexus = !!nexus && !node;

      // Get child nodes (L1 nodes for nexus, or regular children for nodes)
      const getChildren = () => {
        const parentId = isOnNexus ? nexus.id : node?.id;
        if (!parentId) return [];

        return Object.values(nodes)
          .filter(n => n.parentId === parentId)
          .sort((a, b) => a.id.localeCompare(b.id));
      };

      // Helper to navigate and show modal
      const navigateAndShow = (targetId: string) => {
        selectNode(targetId, true);
        setShowContentOverlay(true);
      };

      // If on nexus, all arrows should navigate to first L1 node
      if (isOnNexus) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const children = getChildren();
          if (children.length === 0) return;

          navigateAndShow(children[0].id);
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          setShowContentOverlay(false);
          return;
        }

        return;
      }

      // Regular node navigation below
      if (!node) return;

      // Get all sibling nodes (nodes with same parent)
      const getSiblings = () => {
        return Object.values(nodes)
          .filter(n => n.parentId === node.parentId)
          .sort((a, b) => a.id.localeCompare(b.id));
      };

      // Get parent node or nexus
      const getParent = () => {
        if (!node.parentId) return null;

        // Check if parent is a node
        const parentNode = nodes[node.parentId];
        if (parentNode) return parentNode;

        // Check if parent is a nexus
        const parentNexus = nexuses.find(n => n.id === node.parentId);
        return parentNexus || null;
      };

      // Left arrow - previous sibling
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const siblings = getSiblings();
        if (siblings.length <= 1) return;

        const currentIndex = siblings.findIndex(n => n.id === node.id);
        if (currentIndex === -1) return;

        const prevIndex = currentIndex === 0 ? siblings.length - 1 : currentIndex - 1;
        navigateAndShow(siblings[prevIndex].id);
      }

      // Right arrow - next sibling
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const siblings = getSiblings();
        if (siblings.length <= 1) return;

        const currentIndex = siblings.findIndex(n => n.id === node.id);
        if (currentIndex === -1) return;

        const nextIndex = (currentIndex + 1) % siblings.length;
        navigateAndShow(siblings[nextIndex].id);
      }

      // Up arrow - parent node
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const parent = getParent();
        if (!parent) return;

        navigateAndShow(parent.id);
      }

      // Down arrow - first child
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const children = getChildren();
        if (children.length === 0) return;

        navigateAndShow(children[0].id);
      }

      // Escape - close modal
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowContentOverlay(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [node, nexus, nodes, nexuses, selectNode, setShowContentOverlay]);

  // Get all sibling nodes (nodes with same parent) - for UI hint
  const getSiblingNodes = () => {
    if (!node) return [];

    // Get all nodes with the same parent
    const siblings = Object.values(nodes)
      .filter(n => n.parentId === node.parentId)
      .sort((a, b) => {
        // Sort by ID to maintain consistent order (IDs are timestamp-based)
        return a.id.localeCompare(b.id);
      });

    return siblings;
  };

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

    // Reset Socratic state if in Socratic mode (without creating synthesis)
    if (socraticRootId && socraticQuestion) {
      console.log('🚪 Closing modal without synthesis - resetting Socratic state');
      isSocraticModeActive.current = false;
      setSocraticQuestion(null);
      setSocraticRootId(null);
      setInputContent('');
      setActionMode(null);
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

      // Step 1: Wait 300ms after receiving response (moment to breathe)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Create node (camera will animate to it)
      const newNodeId = addNode(combinedContent, selectedId, undefined, 'ai-response');

      setInputContent('');
      setActionMode(null);
      setIsLoadingAI(false);

      // Step 3: Wait for camera animation (800ms) + buffer (300ms) = 1100ms
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Step 4: Open modal smoothly
      selectNode(newNodeId, true);
    } catch (error) {
      console.error('❌ Failed to get AI response:', error);
      setIsLoadingAI(false);
    }
  };

  // 💭 EXPLORE TOGETHER (Deep Thinking or Quiz Mode)
  const handleExploreTogether = async (mode: 'deep-thinking' | 'quiz') => {
    if (!selectedId) return;

    // Set exploration mode
    setExplorationMode(mode);
    setQuizFeedback(''); // Reset any previous feedback
    setDeepThinkingEngagement(''); // Reset any previous engagement

    // 📝 LOAD QUIZ PROGRESS FROM NODE (if exists)
    let existingQuestions: string[] = [];
    if (mode === 'quiz' && node) {
      const progress = node.quizProgress;
      if (progress && progress.questionsAsked.length > 0) {
        existingQuestions = progress.questionsAsked;
        console.log('📚 Resuming quiz - loaded', existingQuestions.length, 'previous questions');
        console.log('📋 Questions asked:', existingQuestions);
      } else {
        console.log('🆕 Starting fresh quiz - no previous progress found');
      }
    }

    setQuizHistory(existingQuestions); // Load existing or start fresh
    setDeepThinkingHistory([]); // Reset deep thinking history for new exploration

    // Start exploration (works for both regular nodes and connection nodes)
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
            content: contextContent  // Send content directly (prompt is in backend now)
          }],
          mode: mode === 'quiz' ? 'quiz' : mode === 'deep-thinking' ? 'deep-thinking' : 'socratic',
          explorationMode: mode,
          previousQuestions: mode === 'quiz' ? existingQuestions : undefined,  // Send existing questions
          conversationHistory: mode === 'deep-thinking' ? [] : undefined  // Empty array for first deep thinking question
        }),
      });

      if (!response.ok) throw new Error('Failed to start exploration');

      const data = await response.json();

      // Set ref IMMEDIATELY (before state updates)
      isSocraticModeActive.current = true;
      console.log(`🔒 ${mode} mode ref set to TRUE - state protected`);

      setSocraticQuestion(data.response);
      setSocraticRootId(selectedId);
      setInputContent('');
      setIsLoadingAI(false);
    } catch (error) {
      console.error(`❌ Failed to start ${mode} exploration:`, error);
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
    const metaNodeId = createMetaInspirationNode(nexus.id);
    console.log('✅ Meta-node created:', metaNodeId);

    // Animate camera to new meta-node and open modal
    setTimeout(() => {
      selectNode(metaNodeId, true);
    }, 100);
  };

  // Handle Socratic/Quiz answer submission
  const handleSocraticAnswer = async () => {
    if (!inputContent.trim() || !socraticRootId || !socraticQuestion) return;

    console.log(`💭 Starting ${explorationMode} answer submission...`);
    console.log('   Root ID:', socraticRootId);
    console.log('   Current question:', socraticQuestion.substring(0, 50) + '...');
    console.log('   Current selectedId:', selectedId);

    const userAnswerText = inputContent.trim();
    setIsLoadingAI(true);

    try {
      // For quiz mode: Get grading feedback
      // For deep-thinking mode: Get next question
      const isQuizMode = explorationMode === 'quiz';
      console.log(`🤖 Requesting ${isQuizMode ? 'quiz grading' : 'next question'} from AI...`);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Previous question: "${socraticQuestion}"\nUser's answer: "${userAnswerText}"\n\n${
              isQuizMode
                ? 'Grade this answer and provide feedback.'
                : 'Engage with their thinking and ask the next question.'
            }`
          }],
          mode: isQuizMode ? 'quiz' : explorationMode === 'deep-thinking' ? 'deep-thinking' : 'socratic',
          explorationMode,
          conversationHistory: explorationMode === 'deep-thinking' ? deepThinkingHistory : undefined  // Pass history for progressive depth
        }),
      });

      if (!response.ok) throw new Error('Failed to continue exploration');

      const data = await response.json();

      if (isQuizMode) {
        // Quiz mode: Display feedback
        const feedback = data.response;
        console.log('✅ Received quiz feedback:', feedback.substring(0, 100) + '...');

        setQuizFeedback(feedback);
        setInputContent('');
        setIsLoadingAI(false);

        // Add current question to history for diverse question generation
        const updatedQuizHistory = [...quizHistory, socraticQuestion];
        if (socraticQuestion) {
          setQuizHistory(updatedQuizHistory);
          console.log('📋 Added to quiz history. Total questions:', updatedQuizHistory.length);
        }

        // 💾 SAVE QUIZ PROGRESS TO NODE
        if (node && socraticQuestion) {
          const wasCorrect = feedback.includes('✓') || feedback.includes('✅') || feedback.toLowerCase().includes('correct');

          const updatedProgress = {
            questionsAsked: updatedQuizHistory,
            answersGiven: [
              ...(node.quizProgress?.answersGiven || []),
              {
                question: socraticQuestion,
                answer: userAnswerText,
                wasCorrect
              }
            ],
            lastQuizDate: Date.now(),
            completedCycles: node.quizProgress?.completedCycles || 0
          };

          updateNode(node.id, { quizProgress: updatedProgress });
          console.log('💾 Quiz progress saved:', updatedProgress.questionsAsked.length, 'questions');
        }

        // Create a single node with question, answer, and feedback
        const quizNode = `Q: ${socraticQuestion}\n\nA: ${userAnswerText}\n\n${feedback}`;
        console.log('📝 Creating quiz answer node with feedback...');
        addNode(quizNode, socraticRootId);

        // Keep modal open to show feedback
        setTimeout(() => {
          console.log('🔓 Keeping modal open to show quiz feedback');
          selectNode(socraticRootId, true);
          setShowContentOverlay(true);
        }, 100);
      } else {
        // Deep thinking mode: Show engagement + next question
        const fullResponse = data.response;
        console.log('✅ Received deep thinking response:', fullResponse.substring(0, 100) + '...');

        // Parse the response: Split by double newlines to separate engagement from next question
        const paragraphs = fullResponse.split('\n\n').filter(p => p.trim());

        // First paragraph(s) are engagement, last one is the next question
        const engagement = paragraphs.slice(0, -1).join('\n\n').trim();
        const nextQuestion = paragraphs[paragraphs.length - 1].trim();

        console.log('💭 Engagement:', engagement.substring(0, 50) + '...');
        console.log('❓ Next question:', nextQuestion.substring(0, 50) + '...');

        // CRITICAL: Keep ref TRUE to protect state during node creation
        isSocraticModeActive.current = true;
        console.log('🔒 Deep thinking mode ref STILL TRUE - continuing protection');

        // Show engagement in UI
        setDeepThinkingEngagement(engagement);

        // Save to conversation history for progressive depth
        if (socraticQuestion) {
          setDeepThinkingHistory([
            ...deepThinkingHistory,
            {
              question: socraticQuestion,
              userAnswer: userAnswerText,
              aiEngagement: engagement
            }
          ]);
          console.log('📋 Added to deep thinking history. Total rounds:', deepThinkingHistory.length + 1);
        }

        // Update state with next question
        setSocraticQuestion(nextQuestion);
        setInputContent('');
        setIsLoadingAI(false);

        // Create node with user's answer + AI's engagement
        const exchangeNode = `Q: ${socraticQuestion}\n\nA: ${userAnswerText}\n\n💡 ${engagement}`;
        console.log('📝 Creating deep thinking exchange node...');
        addNode(exchangeNode, socraticRootId);

        // Keep modal open to show engagement
        setTimeout(() => {
          console.log('🔓 Keeping modal open to show deep thinking engagement');
          selectNode(socraticRootId, true);
          setShowContentOverlay(true);
        }, 100);

        console.log('✅ Deep thinking exchange complete - showing engagement before next question');
      }
    } catch (error) {
      console.error(`❌ Failed to continue ${explorationMode} dialogue:`, error);
      setIsLoadingAI(false);
    }
  };

  // Continue deep thinking exploration (after viewing engagement)
  const handleContinueDeepThinking = () => {
    console.log('🧠 Continuing deep thinking exploration...');

    // Clear engagement to show answer input again
    setDeepThinkingEngagement('');

    // Next question is already set in state, just need to clear engagement
    console.log('✅ Ready for next answer, question:', socraticQuestion?.substring(0, 50) + '...');
  };

  // Ask another quiz question (after viewing feedback)
  const handleAskAnotherQuestion = async () => {
    if (!socraticRootId) return;

    console.log('🔄 Asking another quiz question...');
    console.log('📋 Previous questions:', quizHistory.length);

    // Clear previous state
    setQuizFeedback('');
    setInputContent('');
    setIsLoadingAI(true);

    try {
      // Get a new quiz question based on the original content
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: displayContent  // Send content directly
          }],
          mode: 'quiz',
          explorationMode: 'quiz',
          previousQuestions: quizHistory  // ← Send history for diverse questions
        }),
      });

      if (!response.ok) throw new Error('Failed to get next question');

      const data = await response.json();

      console.log('✅ New quiz question generated:', data.response.substring(0, 50) + '...');

      // Update state with new question
      setSocraticQuestion(data.response);
      setIsLoadingAI(false);

      // Keep modal open on the root node
      setTimeout(() => {
        selectNode(socraticRootId, true);
        setShowContentOverlay(true);
      }, 100);

    } catch (error) {
      console.error('❌ Failed to get next question:', error);
      setQuizFeedback('Error loading next question. Please try again.');
      setIsLoadingAI(false);
    }
  };

  // End quiz (no synthesis for quiz mode)
  const handleEndQuiz = () => {
    if (!socraticRootId) return;

    console.log('🏁 Ending quiz mode - no synthesis');

    // CRITICAL: Clear the ref to allow normal state clearing
    isSocraticModeActive.current = false;
    console.log('🔓 Quiz mode ref set to FALSE - quiz ended');

    setSocraticQuestion(null);
    setSocraticRootId(null);
    setInputContent('');
    setQuizFeedback('');
    setExplorationMode(null);
    setActionMode(null);

    // Close modal
    selectNode(selectedId, false);
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

      // Step 1: Wait 300ms after receiving synthesis (moment to breathe)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Create synthesis node (camera will animate to it)
      const { addSynthesisNode } = useCanvasStore.getState();
      const synthesisNodeId = addSynthesisNode(data.response, socraticRootId);

      // CRITICAL: Clear the ref to allow normal state clearing
      isSocraticModeActive.current = false;
      console.log('🔓 Socratic mode ref set to FALSE - exploration ended');

      setSocraticQuestion(null);
      setSocraticRootId(null);
      setInputContent('');
      setDeepThinkingEngagement('');
      setActionMode(null);
      setIsLoadingAI(false);

      // Step 3: Wait for camera animation (800ms) + buffer (300ms) = 1100ms
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Step 4: Open modal smoothly
      selectNode(synthesisNodeId, true);
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
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`fixed z-[2001] transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '70vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/50 rounded-2xl shadow-2xl flex flex-col"
          style={{
            maxHeight: '90vh',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >

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

              {/* Anchor Button - Top Center */}
              {node && !isConnectionNode && !node.id.startsWith('meta-inspiration') && (
                <div className="flex flex-col items-center mx-6">
                  <button
                    onClick={() => {
                      toggleAnchor(node.id);
                      setShowAnchorFeedback(true);
                      setTimeout(() => setShowAnchorFeedback(false), 2000);
                    }}
                    className={`px-6 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-medium text-sm
                      ${node.isAnchored
                        ? 'bg-yellow-600/40 border-2 border-yellow-400 text-yellow-200'
                        : 'bg-transparent hover:bg-yellow-600/20 border-2 border-yellow-500/50 text-yellow-300'}`}
                  >
                    ⚓ {node.isAnchored ? 'Anchored' : 'Anchor Node'}
                  </button>
                  {showAnchorFeedback && (
                    <div className="text-xs text-cyan-300 mt-1 animate-pulse">
                      {node.isAnchored ? '✓ Anchored!' : '✓ Removed'}
                    </div>
                  )}
                </div>
              )}

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
            {/* Socratic Question / Quiz Display */}
            {socraticQuestion && (
              <div className={`p-4 ${
                explorationMode === 'quiz'
                  ? 'bg-gradient-to-r from-purple-900/30 to-purple-800/30 border-b border-purple-500/20'
                  : 'bg-gradient-to-r from-cyan-900/30 to-purple-900/30 border-b border-cyan-500/20'
              }`}>
                {/* Header with progress indicator */}
                <div className="flex justify-between items-center mb-2">
                  <div className={`text-sm font-semibold ${
                    explorationMode === 'quiz' ? 'text-purple-300' : 'text-cyan-300'
                  }`}>
                    {explorationMode === 'quiz' ? '📝 Quiz Question' : '💭 Socratic Question'}
                  </div>
                  {explorationMode === 'quiz' && (
                    <div className="text-xs text-purple-400/60">
                      Question {quizHistory.length + 1}/7
                    </div>
                  )}
                </div>

                {/* Progress bar for quiz mode */}
                {explorationMode === 'quiz' && (
                  <div className="mb-3">
                    <div className="w-full h-1.5 bg-purple-950/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500 ease-out"
                        style={{ width: `${((quizHistory.length + 1) / 7) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="text-gray-200 text-base mb-3">{socraticQuestion}</div>

                {/* Show quiz feedback if available */}
                {quizFeedback && explorationMode === 'quiz' && (
                  <div className={`mb-3 p-4 rounded-lg ${
                    quizFeedback.includes('🎉') || quizFeedback.toLowerCase().includes('excellent work')
                      ? 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-2 border-purple-400/50'
                      : 'bg-purple-950/30 border border-purple-500/30'
                  }`}>
                    {(quizFeedback.includes('🎉') || quizFeedback.toLowerCase().includes('excellent work')) && (
                      <div className="text-purple-300 text-xs font-semibold mb-2 uppercase tracking-wide flex items-center gap-2">
                        🎉 Quiz Complete!
                      </div>
                    )}
                    <div
                      className="text-purple-200 text-sm"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        lineHeight: '1.6'
                      }}
                    >
                      {quizFeedback}
                    </div>
                  </div>
                )}

                {/* Show deep thinking engagement if available */}
                {deepThinkingEngagement && explorationMode === 'deep-thinking' && (
                  <div className="mb-3 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <div className="text-yellow-200 text-xs font-semibold mb-2 uppercase tracking-wide">
                      💡 Building on your thinking:
                    </div>
                    <div
                      className="text-gray-200 text-sm"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        lineHeight: '1.6'
                      }}
                    >
                      {deepThinkingEngagement}
                    </div>
                  </div>
                )}

                {/* Textarea - hide when showing engagement for deep thinking or feedback for quiz */}
                {!((explorationMode === 'deep-thinking' && deepThinkingEngagement) || (explorationMode === 'quiz' && quizFeedback)) && (
                  <textarea
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    placeholder={explorationMode === 'quiz' ? 'Type your answer...' : 'Share your thoughts...'}
                    disabled={isLoadingAI}
                    className={`w-full bg-slate-950/50 text-gray-200 border rounded-lg p-3
                             focus:outline-none focus:border-${explorationMode === 'quiz' ? 'purple' : 'cyan'}-500/50 resize-none ${
                      explorationMode === 'quiz' ? 'border-purple-500/20' : 'border-cyan-500/20'
                    } ${isLoadingAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                    rows={3}
                  />
                )}
                <div className="flex gap-2 mt-3">
                  {explorationMode === 'quiz' ? (
                    <>
                      {/* Show different buttons based on whether feedback exists */}
                      {quizFeedback ? (
                        // After feedback: Show "Another Question" button
                        <>
                          <button
                            onClick={handleAskAnotherQuestion}
                            disabled={isLoadingAI}
                            className="flex-1 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50
                                     text-purple-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingAI ? '🔄 Loading...' : '📝 Another Question'}
                          </button>
                          <button
                            onClick={handleEndQuiz}
                            disabled={isLoadingAI}
                            className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50
                                     text-gray-300 rounded-lg transition-all disabled:opacity-50"
                          >
                            End Quiz
                          </button>
                        </>
                      ) : (
                        // Before feedback: Show "Submit Answer" button
                        <>
                          <button
                            onClick={handleSocraticAnswer}
                            disabled={isLoadingAI || !inputContent.trim()}
                            className="flex-1 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50
                                     text-purple-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingAI ? '✍️ Grading...' : 'Submit Answer'}
                          </button>
                          <button
                            onClick={handleEndQuiz}
                            disabled={isLoadingAI}
                            className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50
                                     text-gray-300 rounded-lg transition-all disabled:opacity-50"
                          >
                            End Quiz
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Deep Thinking mode buttons - show different buttons based on engagement */}
                      {deepThinkingEngagement ? (
                        // After AI engagement: Show "Continue Exploring" button
                        <>
                          <button
                            onClick={handleContinueDeepThinking}
                            disabled={isLoadingAI}
                            className="flex-1 px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50
                                     text-yellow-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                          >
                            {isLoadingAI ? '🤔 Thinking...' : '🧠 Continue Exploring'}
                          </button>
                          <button
                            onClick={handleEndExploration}
                            disabled={isLoadingAI}
                            className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50
                                     text-gray-300 rounded-lg transition-all disabled:opacity-50"
                          >
                            End & Synthesize
                          </button>
                        </>
                      ) : (
                        // Before AI engagement: Show "Share My Thinking" button
                        <>
                          <button
                            onClick={handleSocraticAnswer}
                            disabled={isLoadingAI || !inputContent.trim()}
                            className="flex-1 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50
                                     text-cyan-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingAI ? '🤔 Thinking...' : '💭 Share My Thinking'}
                          </button>
                          <button
                            onClick={handleEndExploration}
                            disabled={isLoadingAI}
                            className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50
                                     text-gray-300 rounded-lg transition-all disabled:opacity-50"
                          >
                            End & Synthesize
                          </button>
                        </>
                      )}
                    </>
                  )}
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
                    onClick={() => handleExploreTogether('deep-thinking')}
                    disabled={isLoadingAI}
                    className="flex-1 px-4 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 text-yellow-300 rounded-lg transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                  >
                    🧠 Explore This Idea (Deep Thinking)
                  </button>
                  <button
                    onClick={() => handleExploreTogether('quiz')}
                    disabled={isLoadingAI}
                    className="flex-1 px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 rounded-lg transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                  >
                    📝 Quiz Me On This (Test Knowledge)
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

                {/* Keyboard Navigation Hint */}
                {node && (
                  <div
                    style={{
                      marginTop: '20px',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '11px',
                      color: 'rgba(255, 255, 255, 0.5)',
                      textAlign: 'center',
                    }}
                  >
                    ↑↓ parent/child • ←→ siblings • Esc to close
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
