
import { useChatState } from "./useChatState";
import { CanvasStore, useCanvasStore } from "@/lib/store";

type MessageHandlerArgs = {
    userMessage: string;
    isFirstMessage: boolean;
    cleanMessage: string;
    isSpatialMode: boolean;
} & ReturnType<typeof useChatState> & CanvasStore;


export async function handleDoctrinalMode({
    userMessage,
    ruleName,
    setDetectedRuleName,
    setIsGeneratingDoctrine,
    setDoctrinalStage,
    setDoctrinalError,
    getActivatedConversations,
    nodes,
    createChatNexus,
    addNode,
    saveCurrentUniverse,
    setIsLoading,
}: MessageHandlerArgs & { ruleName: string }) {
    setDetectedRuleName(ruleName);
    setIsGeneratingDoctrine(true);
    setDoctrinalStage('researching');
    setDoctrinalError(null);

    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setDoctrinalStage('finding-cases');

        const activatedConvos = getActivatedConversations();
        let gapContext = '';
        if (activatedConvos.length > 0) {
            gapContext = '\n\nACTIVATED UNIVERSES (use as PRIMARY source for case selection):\n';
            activatedConvos.forEach(conv => {
                gapContext += `\n**${conv.title}**\n`;
                const truncatedContent = conv.content.substring(0, 300);
                gapContext += `${truncatedContent}${conv.content.length > 300 ? '...' : ''}\n`;

                const astryonUniverseNodes = Object.values(nodes).filter(n => n.parentId === conv.id);
                if (astryonUniverseNodes.length > 0) {
                    gapContext += '\nCases/Topics in this universe:\n';
                    astryonUniverseNodes.forEach(node => {
                        const nodeTitle = node.semanticTitle || node.title || 'Untitled';
                        const nodeContent = node.content.substring(0, 150);
                        gapContext += `- ${nodeTitle}: ${nodeContent}${node.content.length > 150 ? '...' : ''}\n`;
                    });
                }
                gapContext += '---\n';
            });
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

        setDoctrinalStage('analyzing');

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                mode: 'doctrine',

            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const aiContent = data.response;

        setDoctrinalStage('building-map');

        let doctrineData;
        try {
            let jsonStr = aiContent.trim();
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            doctrineData = JSON.parse(jsonStr);
        } catch {
            throw new Error('Failed to parse doctrine data from AI response');
        }

        const nexusTitle = ruleName;
        const nexusContent = `Rule: ${doctrineData.ruleStatement}\n\nElements:\n${doctrineData.elements.map((e: string, i: number) => `${i + 1}. ${e}`).join('\n')}`;

        createChatNexus(nexusTitle, userMessage, nexusContent);
        await new Promise(resolve => setTimeout(resolve, 100));

        const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
        if (!chatNexus) {
            throw new Error('Failed to create doctrine nexus');
        }

        for (const caseData of doctrineData.cases) {
            const caseContent = `${caseData.caseName}\n${caseData.citation}\n\nFacts: ${caseData.facts}\n\nAnalysis: ${caseData.doctrinalAnalysis}\n\nHolding: ${caseData.holding}\n\nSignificance: ${caseData.significance}`;
            addNode(caseContent, chatNexus.id, caseData.caseName, 'ai-response');
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        saveCurrentUniverse();

        setDoctrinalStage('complete');
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsGeneratingDoctrine(false);
        setIsLoading(false);
        return;

    } catch (err) {
        setDoctrinalStage('error');
        setDoctrinalError(err instanceof Error ? err.message : 'Unknown error occurred');
        await new Promise(resolve => setTimeout(resolve, 3000));
        setIsGeneratingDoctrine(false);
        setIsLoading(false);
        return;
    }
}

export async function handleGapMode(args: MessageHandlerArgs) {
    const {
        userMessage,
        buildGraphStructure,
        setError,
        setIsLoading,
        setMessage,
        createChatNexus,
        setIsFirstMessage,
        addNode,
        saveCurrentUniverse,
        setParallelTasks,
        setPlanningReasoning,
        setShowPlanningModal,
        selectNode,
        nexuses,
        selectedId
    } = args;

    const graphStructure = buildGraphStructure();

    if (!graphStructure) {
        setError('GAP Mode requires an active universe. Create or load a universe first.');
        setIsLoading(false);
        setMessage(userMessage);
        return;
    }

    const isSynthesisMode = !graphStructure.currentGraph && graphStructure.activatedGraphs.length > 0;

    if (isSynthesisMode) {
        try {
            const synthesisResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'gap-synthesize',
                    activatedGraphs: graphStructure.activatedGraphs,
                    question: userMessage,
                }),
            });

            if (!synthesisResponse.ok) {
                throw new Error(`Synthesis failed: ${synthesisResponse.statusText}`);
            }

            const synthesisData = await synthesisResponse.json();

            if (synthesisData.spatialData) {
                const { nexusTitle, nexusContent, nodes: spatialNodes } = synthesisData.spatialData;

                createChatNexus(nexusTitle, userMessage, nexusContent);
                setIsFirstMessage(false);

                await new Promise(resolve => setTimeout(resolve, 100));

                const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
                if (!chatNexus) {
                    throw new Error('Failed to create synthesis nexus');
                }

                for (let i = 0; i < spatialNodes.length; i++) {
                    addNode(spatialNodes[i].content, chatNexus.id, undefined, 'ai-response');
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                await new Promise(resolve => setTimeout(resolve, 100));
                saveCurrentUniverse();

                setIsLoading(false);
                return;
            }
        } catch {
            setError('Failed to create synthesis universe');
            setIsLoading(false);
            return;
        }
    }

    try {
        const analyzeResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'gap-analyze',
                currentGraph: graphStructure.currentGraph,
                activatedGraphs: graphStructure.activatedGraphs,
                question: userMessage,
            }),
        });

        if (!analyzeResponse.ok) {
            throw new Error(`Analysis failed: ${analyzeResponse.statusText}`);
        }

        const analysis = await analyzeResponse.json();

        if (analysis.type === 'parallel' && analysis.tasks && analysis.tasks.length > 0) {
            setParallelTasks(analysis.tasks);
            setPlanningReasoning(analysis.reasoning);
            setShowPlanningModal(true);
            setIsLoading(false);
            return;
        } else {
            const singleResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'gap-single',
                    currentGraph: graphStructure.currentGraph,
                    activatedGraphs: graphStructure.activatedGraphs,
                    question: userMessage,
                }),
            });

            if (!singleResponse.ok) {
                throw new Error(`Single task failed: ${singleResponse.statusText}`);
            }

            const singleData = await singleResponse.json();

            const parentId = selectedId || (nexuses.length > 0 ? nexuses[0].id : null);

            if (!parentId) {
                throw new Error('No parent node found to attach response');
            }

            await new Promise(resolve => setTimeout(resolve, 300));

            const newNodeId = addNode(singleData.content, parentId, undefined, 'ai-response');

            await new Promise(resolve => setTimeout(resolve, 1100));

            selectNode(newNodeId, true);

            setIsLoading(false);
            return;
        }
    } catch {
        setError('GAP Mode failed. Falling back to standard mode.');
    }
}

export async function handleStandardMode(args: MessageHandlerArgs) {
    const {
        cleanMessage,
        isFirstMessage,
        isSpatialMode,
        conversationHistory,
        buildConversationContext,
        setConversationHistory,
        createChatNexus,
        setIsFirstMessage,
        selectNode,
        saveCurrentUniverse,
        addNode,
        updateNode,
        activeUniverseId,
        createSnapshot,
        selectedId,
        currentParentId,
        setError,
        setIsLoading,
    } = args;

    let title = 'Chat';
    let actualPrompt = cleanMessage;

    if (isFirstMessage) {
        const titleIndex = cleanMessage.toLowerCase().indexOf('title:');
        const promptIndex = cleanMessage.toLowerCase().indexOf('prompt:');

        if (titleIndex !== -1 && promptIndex !== -1 && promptIndex > titleIndex) {
            title = cleanMessage.substring(titleIndex + 6, promptIndex).trim();
            actualPrompt = cleanMessage.substring(promptIndex + 7).trim();
        } else {
            if (isSpatialMode) {
                const words = cleanMessage.split(' ').slice(0, 5).join(' ');
                title = words + (cleanMessage.split(' ').length > 5 ? '...' : '');
            }
        }
    }

    const fullContext = buildConversationContext();
    const messagesForAPI = [...conversationHistory, { role: 'user' as const, content: actualPrompt }];
    const updatedHistory = isSpatialMode
        ? conversationHistory
        : messagesForAPI;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messagesForAPI,
                mode: isSpatialMode ? 'spatial' : 'standard',
                conversationContext: fullContext,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
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

        if (data.spatialData) {
            const { nexusTitle, nexusContent, nodes: spatialNodes } = data.spatialData;

            createChatNexus(nexusTitle, actualPrompt, nexusContent);
            setIsFirstMessage(false);

            await new Promise(resolve => setTimeout(resolve, 100));

            const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));

            if (!chatNexus) {
                throw new Error('Nexus creation failed');
            }

            for (let i = 0; i < spatialNodes.length; i++) {
                const node = spatialNodes[i];
                const doctrineId = addNode(
                    node.content,
                    chatNexus.id,
                    undefined,
                    node.nodeType || 'doctrine'
                );

                if (node.children && Array.isArray(node.children)) {
                    updateNode(doctrineId, {
                        practiceSteps: node.children
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 50));
            }

            await new Promise(resolve => setTimeout(resolve, 100));
            saveCurrentUniverse();

            if (activeUniverseId) {
                createSnapshot(activeUniverseId);
            }
        } else {
            const aiResponse = data.response;
            const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: aiResponse }];
            setConversationHistory(finalHistory);

            if (isFirstMessage) {
                createChatNexus(title, actualPrompt, aiResponse);
                setIsFirstMessage(false);

                setTimeout(() => {
                    const chatNexus = useCanvasStore.getState().nexuses.find(n => n.id.startsWith('chat-'));
                    if (chatNexus) {
                        selectNode(chatNexus.id, true);
                    }
                }, 300);

                setTimeout(() => {
                    saveCurrentUniverse();
                }, 400);
            } else {
                const parentId = selectedId || currentParentId;

                if (!parentId) {
                    throw new Error('No parent node found');
                }

                await new Promise(resolve => setTimeout(resolve, 300));

                const combinedContent = `You: ${actualPrompt}\n\nClaude: ${aiResponse}`;
                const newNodeId = addNode(combinedContent, parentId, undefined, 'ai-response');

                await new Promise(resolve => setTimeout(resolve, 1100));

                selectNode(newNodeId, true);
            }
        }
    } catch {
        setError('Failed to send message. Make sure the server is running.');
    } finally {
        setIsLoading(false);
    }
}
