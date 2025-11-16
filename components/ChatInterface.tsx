'use client';

import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import { NodeType } from '@/lib/types';
import SpatialNavigator from './SpatialNavigator';
import DoctrinalGenerationModal from './DoctrinalGenerationModal';

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

  // ⚖️ Doctrinal generation state
  const [isGeneratingDoctrine, setIsGeneratingDoctrine] = useState(false);
  const [doctrinalStage, setDoctrinalStage] = useState<'researching' | 'finding-cases' | 'analyzing' | 'building-map' | 'complete' | 'error'>('researching');
  const [doctrinalError, setDoctrinalError] = useState<string | null>(null);
  const [detectedRuleName, setDetectedRuleName] = useState('');

  const { nexuses, nodes, createChatNexus, addNode, getActivatedConversations, selectedId } = useCanvasStore();

  // 🧠 GAP Mode: Universe activation
  const activatedUniverseIds = useCanvasStore(state => state.activatedUniverseIds);
  const universeLibrary = useCanvasStore(state => state.universeLibrary);

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
  // Now supports multiple universe graphs for cross-universe analysis
  const buildGraphStructure = () => {
    console.log('🧠 GAP Mode: Building graph structure...');
    console.log('🧠 Activated universes:', activatedUniverseIds.length);

    if (nexuses.length === 0 && activatedUniverseIds.length === 0) {
      console.log('🧠 GAP Mode: No universe loaded and no activated universes');
      return null;
    }

    // 🌌 SYNTHESIS MODE: Empty canvas + activated universes = synthesis opportunity
    if (nexuses.length === 0 && activatedUniverseIds.length > 0) {
      console.log('🌌 SYNTHESIS MODE: Empty canvas with', activatedUniverseIds.length, 'activated universes');
      console.log('🌌 This will trigger cross-universe synthesis and create a new universe');
    }

    // 🌌 Helper: Build graph for a single universe from library
    const buildUniverseGraph = (universeId: string) => {
      const universe = universeLibrary[universeId];
      if (!universe) {
        console.warn('🧠 Universe not found:', universeId);
        return null;
      }

      console.log('🧠 Building graph for universe:', universe.title);

      const nexus = universe.nexuses[0]; // Get first nexus
      if (!nexus) return null;

      const universeNodes = Object.values(universe.nodes);

      // Build FULL node data (no compression for cross-universe analysis)
      const fullNodes = universeNodes.map(node => ({
        id: node.id,
        type: node.nodeType || 'user-reply',
        content: node.content, // FULL content
        parentId: node.parentId,
        position: node.position,
        semanticTitle: node.semanticTitle
      }));

      const connections = universeNodes.map(node => ({
        from: node.parentId,
        to: node.id
      }));

      return {
        universeId,
        nexus: {
          id: nexus.id,
          content: nexus.content,
          title: nexus.title,
          position: nexus.position
        },
        nodes: fullNodes,
        connections
      };
    };

    // 🎯 Build current universe graph (if loaded on canvas)
    let currentGraph = null;
    if (nexuses.length > 0) {
      const currentNexus = selectedId
        ? nexuses.find(n => n.id === selectedId) || nexuses[0]
        : nexuses[0];

      if (currentNexus) {
        console.log('🧠 GAP Mode: Current nexus:', currentNexus.title);

        const universeNodes = Object.values(nodes);
        const fullNodes = universeNodes.map(node => ({
          id: node.id,
          type: node.nodeType || 'user-reply',
          content: node.content, // FULL content
          parentId: node.parentId,
          position: node.position,
          semanticTitle: node.semanticTitle
        }));

        const connections = universeNodes.map(node => ({
          from: node.parentId,
          to: node.id
        }));

        currentGraph = {
          nexus: {
            id: currentNexus.id,
            content: currentNexus.content,
            title: currentNexus.title,
            position: currentNexus.position
          },
          nodes: fullNodes,
          connections
        };

        console.log('🧠 Current graph: Nodes:', fullNodes.length);
      }
    }

    // 🌌 Build activated universe graphs
    const activatedGraphs = activatedUniverseIds
      .map(universeId => buildUniverseGraph(universeId))
      .filter(graph => graph !== null);

    console.log('🧠 GAP Mode: Built', activatedGraphs.length, 'activated universe graphs');

    // Calculate total tokens
    const totalData = {
      current: currentGraph,
      activated: activatedGraphs
    };
    const approxTokens = Math.ceil(JSON.stringify(totalData).length / 4);
    console.log('🧠 GAP Mode: Total graph data - Approx tokens:', approxTokens);

    return {
      currentGraph,
      activatedGraphs,
      hasMultipleUniverses: activatedGraphs.length > 0
    };
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

  // 🧠 GAP Mode: Execute parallel tasks
  const executeParallelTasks = async () => {
    console.log('🧠 GAP Mode: Executing parallel tasks...');

    setShowProgressModal(true);
    setIsLoading(true);

    // Initialize progress status
    const initialProgress: { [key: number]: 'pending' | 'complete' | 'error' } = {};
    parallelTasks.forEach((_, index) => {
      initialProgress[index] = 'pending';
    });
    setProgressStatus(initialProgress);

    // Build graph structure
    const graphStructure = buildGraphStructure();

    if (!graphStructure) {
      setError('No graph structure available');
      setShowProgressModal(false);
      setIsLoading(false);
      return;
    }

    // Determine parent node
    const parentId = selectedId || (nexuses.length > 0 ? nexuses[0].id : null);

    if (!parentId) {
      setError('No parent node found');
      setShowProgressModal(false);
      setIsLoading(false);
      return;
    }

    try {
      // Execute all tasks in parallel using Promise.all
      console.log(`🚀 GAP Mode: Starting all ${parallelTasks.length} parallel API calls at ${new Date().toISOString()}`);
      const startTime = Date.now();

      const taskPromises = parallelTasks.map(async (task, index) => {
        const taskStartTime = Date.now();
        try {
          console.log(`🧠 GAP Mode: Task ${index + 1}/${parallelTasks.length} starting at t+${Date.now() - startTime}ms: ${task.substring(0, 50)}...`);

          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'gap-parallel',
              currentGraph: graphStructure.currentGraph,
              activatedGraphs: graphStructure.activatedGraphs,
              task: task
            }),
          });

          if (!response.ok) {
            throw new Error(`Task ${index + 1} failed: ${response.statusText}`);
          }

          const data = await response.json();

          const taskDuration = Date.now() - taskStartTime;
          const totalElapsed = Date.now() - startTime;

          // Update progress to complete
          setProgressStatus(prev => ({ ...prev, [index]: 'complete' }));

          console.log(`✅ GAP Mode: Task ${index + 1} completed at t+${totalElapsed}ms (took ${taskDuration}ms)`);

          return { index, content: data.content, success: true, duration: taskDuration };
        } catch (error) {
          const taskDuration = Date.now() - taskStartTime;
          const totalElapsed = Date.now() - startTime;
          console.error(`❌ GAP Mode: Task ${index + 1} failed at t+${totalElapsed}ms (took ${taskDuration}ms):`, error);

          // Update progress to error
          setProgressStatus(prev => ({ ...prev, [index]: 'error' }));

          return { index, error: error, success: false, duration: taskDuration };
        }
      });

      // Wait for all tasks to complete
      const results = await Promise.all(taskPromises);

      const totalTime = Date.now() - startTime;
      const avgTime = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;
      console.log(`✅ GAP Mode: All ${results.length} parallel tasks completed in ${totalTime}ms (avg task: ${Math.round(avgTime)}ms)`);

      // Wait a moment before creating nodes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create nodes for successful tasks
      const successfulResults = results.filter(r => r.success);

      for (const result of successfulResults) {
        if (result.content) {
          console.log(`🧠 GAP Mode: Creating node for task ${result.index + 1}`);
          addNode(result.content, parentId, undefined, 'ai-response');
          await new Promise(resolve => setTimeout(resolve, 100)); // Space out node creation
        }
      }

      // Close progress modal
      setShowProgressModal(false);
      setProgressStatus({});

      const successCount = successfulResults.length;
      const failCount = results.length - successCount;

      console.log(`✅ GAP Mode: Created ${successCount} nodes`);
      if (failCount > 0) {
        console.warn(`⚠️ GAP Mode: ${failCount} tasks failed`);
      }

    } catch (err) {
      console.error('🧠 GAP Mode: Parallel execution error:', err);
      setError('Parallel execution failed');
      setShowProgressModal(false);
      setProgressStatus({});
    } finally {
      setIsLoading(false);
    }
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

    // ⚖️ DOCTRINAL MODE: Check for doctrine map generation request
    // IMPORTANT: Only check doctrinal patterns if NOT in spatial/explore mode
    const doctrinalPatterns = [
      /create\s+(?:a\s+)?(?:doctrine|doctrinal)\s+(?:map|universe)\s+(?:for|of|about)\s+(.+)/i,
      /generate\s+(?:a\s+)?(?:doctrine|doctrinal)\s+(?:map|universe)\s+(?:for|of|about)\s+(.+)/i,
      /build\s+(?:a\s+)?(?:doctrine|doctrinal)\s+(?:map|universe)\s+(?:for|of|about)\s+(.+)/i,
    ];

    let isDoctrinalMode = false;
    let ruleName = '';

    // Only check doctrinal patterns if NOT in spatial/explore mode
    if (!isSpatialMode) {
      for (const pattern of doctrinalPatterns) {
        const match = userMessage.match(pattern);
        if (match) {
          isDoctrinalMode = true;
          ruleName = match[1].trim();
          break;
        }
      }
    }

    if (isDoctrinalMode) {
      console.log('⚖️ DOCTRINAL MODE DETECTED - Rule:', ruleName);

      setDetectedRuleName(ruleName);
      setIsGeneratingDoctrine(true);
      setDoctrinalStage('researching');
      setDoctrinalError(null);

      try {
        // Stage 1: Researching
        await new Promise(resolve => setTimeout(resolve, 500));
        setDoctrinalStage('finding-cases');

        // Build lightweight GAP context
        const activatedConvos = getActivatedConversations();
        console.log('⚖️ Building lightweight GAP context from', activatedConvos.length, 'activated universes');

        let gapContext = '';
        if (activatedConvos.length > 0) {
          gapContext = '\n\nACTIVATED UNIVERSES (use as PRIMARY source for case selection):\n';
          activatedConvos.forEach(conv => {
            gapContext += `\n**${conv.title}**\n`;
            const truncatedContent = conv.content.substring(0, 300);
            gapContext += `${truncatedContent}${conv.content.length > 300 ? '...' : ''}\n`;

            const universeNodes = Object.values(nodes).filter(n => n.parentId === conv.id);
            if (universeNodes.length > 0) {
              gapContext += '\nCases/Topics in this universe:\n';
              universeNodes.forEach(node => {
                const nodeTitle = node.semanticTitle || node.title || 'Untitled';
                const nodeContent = node.content.substring(0, 150);
                gapContext += `- ${nodeTitle}: ${nodeContent}${node.content.length > 150 ? '...' : ''}\n`;
              });
            }
            gapContext += '---\n';
          });
          console.log('⚖️ GAP context built, length:', gapContext.length, 'characters');
        } else {
          console.log('⚖️ No activated universes - will use Claude training data');
        }

        const prompt = `You are a legal research assistant. Research the doctrine "${ruleName}" and return ONLY a JSON object with no additional text, explanations, or markdown formatting.

CRITICAL: Your response must be ONLY the JSON object. Do not include any text before or after the JSON. Do not wrap it in markdown code blocks.
${gapContext}
${gapContext ? 'Use the activated universes above as your PRIMARY source for case selection. If the activated universes contain relevant cases, prioritize those. You may supplement with additional landmark cases from your training data if needed to reach 5-8 total cases.\n' : ''}
Identify 5-8 landmark cases that define or apply this doctrine.

Return this exact JSON structure:
{
  "ruleStatement": "A clear 1-2 sentence definition of the doctrine",
  "elements": ["element 1", "element 2", "element 3"],
  "cases": [
    {
      "caseName": "Full case name",
      "citation": "Volume Reporter Page (Year)",
      "year": 1944,
      "facts": "2-3 sentences describing the facts",
      "doctrinalAnalysis": "3-4 sentences explaining how the court applied this doctrine",
      "holding": "1-2 sentences stating what the court held",
      "significance": "1-2 sentences explaining why this case matters for understanding the doctrine",
      "caseType": "foundational"
    }
  ]
}

caseType must be one of: "foundational", "refinement", "application", or "overruled"

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;

        // Stage 2: API call
        setDoctrinalStage('analyzing');

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            mode: 'doctrine'
          }),
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const aiContent = data.response;

        // Stage 3: Building map
        setDoctrinalStage('building-map');

        // Parse JSON response
        let doctrineData;
        try {
          let jsonStr = aiContent.trim();
          jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          }
          doctrineData = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error('⚖️ Failed to parse JSON:', parseErr);
          throw new Error('Failed to parse doctrine data from AI response');
        }

        // Create universe
        const nexusTitle = ruleName;
        const nexusContent = `Rule: ${doctrineData.ruleStatement}\n\nElements:\n${doctrineData.elements.map((e: string, i: number) => `${i + 1}. ${e}`).join('\n')}`;

        createChatNexus(nexusTitle, userMessage, nexusContent);
        await new Promise(resolve => setTimeout(resolve, 100));

        const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
        if (!chatNexus) {
          throw new Error('Failed to create doctrine nexus');
        }

        // Create case nodes
        for (const caseData of doctrineData.cases) {
          const caseContent = `${caseData.caseName}\n${caseData.citation}\n\nFacts: ${caseData.facts}\n\nAnalysis: ${caseData.doctrinalAnalysis}\n\nHolding: ${caseData.holding}\n\nSignificance: ${caseData.significance}`;
          addNode(caseContent, chatNexus.id, caseData.caseName, 'ai-response');
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Save universe
        await new Promise(resolve => setTimeout(resolve, 100));
        useCanvasStore.getState().saveCurrentUniverse();

        // Complete
        setDoctrinalStage('complete');
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsGeneratingDoctrine(false);
        setIsLoading(false);
        return;

      } catch (err) {
        console.error('⚖️ Doctrinal generation failed:', err);
        setDoctrinalStage('error');
        setDoctrinalError(err instanceof Error ? err.message : 'Unknown error occurred');
        await new Promise(resolve => setTimeout(resolve, 3000));
        setIsGeneratingDoctrine(false);
        setIsLoading(false);
        return;
      }
    }

    // 🧠 GAP MODE: Check if graph-aware parallel exploration is enabled
    if (gapModeEnabled && !isSpatialMode) {
      console.log('🧠 GAP Mode: ENABLED - Using graph-aware AI');

      // Build graph structure
      const graphStructure = buildGraphStructure();

      if (!graphStructure) {
        console.log('🧠 GAP Mode: No graph structure available, falling back to standard mode');
        setError('GAP Mode requires an active universe. Create or load a universe first.');
        setIsLoading(false);
        setMessage(userMessage); // Restore message
        return;
      }

      // 🌌 SYNTHESIS MODE: Empty canvas + activated universes → create synthesis universe
      const isSynthesisMode = !graphStructure.currentGraph && graphStructure.activatedGraphs.length > 0;

      if (isSynthesisMode) {
        console.log('🌌 SYNTHESIS MODE: Creating synthesis universe from', graphStructure.activatedGraphs.length, 'activated universes');

        try {
          const synthesisResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'gap-synthesize',
              activatedGraphs: graphStructure.activatedGraphs,
              question: userMessage
            }),
          });

          if (!synthesisResponse.ok) {
            throw new Error(`Synthesis failed: ${synthesisResponse.statusText}`);
          }

          const synthesisData = await synthesisResponse.json();
          console.log('✨ Synthesis universe generated:', synthesisData);

          // Create the synthesis universe (similar to spatial mode)
          if (synthesisData.spatialData) {
            const { nexusTitle, nexusContent, nodes } = synthesisData.spatialData;

            // Create nexus
            createChatNexus(nexusTitle, userMessage, nexusContent);
            setIsFirstMessage(false);

            // Wait for nexus creation
            await new Promise(resolve => setTimeout(resolve, 100));

            const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
            if (!chatNexus) {
              throw new Error('Failed to create synthesis nexus');
            }

            // Create child nodes
            for (let i = 0; i < nodes.length; i++) {
              addNode(nodes[i].content, chatNexus.id, undefined, 'ai-response');
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            console.log('✅ Synthesis universe created with', nodes.length, 'nodes');

            // Save to library
            await new Promise(resolve => setTimeout(resolve, 100));
            useCanvasStore.getState().saveCurrentUniverse();

            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.error('❌ Synthesis mode failed:', err);
          setError('Failed to create synthesis universe');
          setIsLoading(false);
          return;
        }
      }

      try {
        // Phase 1: Analyze query with graph context
        console.log('🧠 GAP Mode: Phase 1 - Analyzing query...');
        const analyzeResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'gap-analyze',
            currentGraph: graphStructure.currentGraph,
            activatedGraphs: graphStructure.activatedGraphs,
            question: userMessage
          }),
        });

        if (!analyzeResponse.ok) {
          throw new Error(`Analysis failed: ${analyzeResponse.statusText}`);
        }

        const analysis = await analyzeResponse.json();
        console.log('🧠 GAP Mode: Analysis result:', analysis);

        if (analysis.type === 'parallel' && analysis.tasks && analysis.tasks.length > 0) {
          // Parallel mode: Show planning modal
          console.log('🧠 GAP Mode: Parallel detected -', analysis.tasks.length, 'tasks');
          setParallelTasks(analysis.tasks);
          setPlanningReasoning(analysis.reasoning);
          setShowPlanningModal(true);
          setIsLoading(false);
          return; // Wait for user to confirm execution
        } else {
          // Single mode: Execute directly
          console.log('🧠 GAP Mode: Single response mode');

          const singleResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'gap-single',
              currentGraph: graphStructure.currentGraph,
              activatedGraphs: graphStructure.activatedGraphs,
              question: userMessage
            }),
          });

          if (!singleResponse.ok) {
            throw new Error(`Single task failed: ${singleResponse.statusText}`);
          }

          const singleData = await singleResponse.json();
          console.log('🧠 GAP Mode: Single task complete');

          // Create AI response node
          const parentId = selectedId || (nexuses.length > 0 ? nexuses[0].id : null);

          if (!parentId) {
            throw new Error('No parent node found to attach response');
          }

          // Wait 300ms before creating node
          await new Promise(resolve => setTimeout(resolve, 300));

          // Create the node
          const newNodeId = addNode(singleData.content, parentId, undefined, 'ai-response');

          // Wait for camera animation
          await new Promise(resolve => setTimeout(resolve, 1100));

          // Open modal
          const { selectNode } = useCanvasStore.getState();
          selectNode(newNodeId, true);

          console.log('🧠 GAP Mode: Single node created and opened');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('🧠 GAP Mode: Error:', err);
        setError('GAP Mode failed. Falling back to standard mode.');
        // Fall through to standard mode
      }
    }

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

        // Step 3: Create L1 doctrine nodes ONLY (L2 practice nodes created during guided practice)
        console.log(`🔄 Creating ${nodes.length} doctrine nodes with practice metadata...`);
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          console.log(`✅ Creating doctrine ${i + 1}/${nodes.length}:`, node.content.substring(0, 50) + '...');

          // Create the doctrine node
          const doctrineId = addNode(
            node.content,
            chatNexus.id,
            undefined,
            node.nodeType || 'doctrine'
          );

          // 🎓 Store practice metadata in doctrine node (for Guided Practice to use later)
          if (node.children && Array.isArray(node.children)) {
            console.log(`   📚 Storing ${node.children.length} practice steps as metadata for doctrine ${i + 1}`);
            const { updateNode } = useCanvasStore.getState();
            updateNode(doctrineId, {
              practiceSteps: node.children // Store the practice questions/prompts
            });
          }

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
          <div style={{ color: isSpatialModeActive ? '#9333EA' : (gapModeEnabled ? '#8B5CF6' : '#00FFD4'), fontSize: '14px', fontWeight: 'bold' }}>
            {isSpatialModeActive ? '🌌 Spatial Exploration Mode' : gapModeEnabled ? '🧠 GAP Mode Active' : '🧠 Aurora Chat'} {!isFirstMessage && '(Full Context Active)'}
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

        {/* 🧠 Active Sources Indicator */}
        {gapModeEnabled && activatedUniverseIds.length > 0 && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            border: '1px solid #8B5CF6',
            borderRadius: '6px',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#8B5CF6',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🌌 Active: {activatedUniverseIds.length} {activatedUniverseIds.length === 1 ? 'universe' : 'universes'}</span>
            <button
              onClick={() => {
                // Navigate to Memories page
                window.location.href = '/memories';
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(139, 92, 246, 0.3)',
                color: '#8B5CF6',
                border: '1px solid #8B5CF6',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              View Sources
            </button>
          </div>
        )}

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
                  executeParallelTasks();
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

      <DoctrinalGenerationModal
        isOpen={isGeneratingDoctrine}
        ruleName={detectedRuleName}
        stage={doctrinalStage}
        errorMessage={doctrinalError || undefined}
      />
    </>
  );
}