'use client';

import { useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import SpatialNavigator from '../SpatialNavigator';
import DoctrinalGenerationModal from '../DoctrinalGenerationModal';
import { useChatState } from './useChatState';
import ChatUI from './ChatUI';
import GapModeModals from './GapModeModals';
import { handleDoctrinalMode, handleGapMode, handleStandardMode } from './messageHandlers';

export default function ChatInterface() {
  const chatState = useChatState();
  const canvasStore = useCanvasStore();

  const {
    message,
    setMessage,
    setIsLoading,
    setError,
    isFirstMessage,
    gapModeEnabled,
    setIsFirstMessage,
    setCurrentParentId,
  } = chatState;

  const { selectedId, nexuses } = canvasStore;

  useEffect(() => {
    if (selectedId) {
        setIsFirstMessage(false);
        setCurrentParentId(selectedId);
    } else {
        setIsFirstMessage(true);
        setCurrentParentId(null);
    }
  }, [selectedId, setIsFirstMessage, setCurrentParentId]);

  const executeParallelTasks = async () => {
    chatState.setShowProgressModal(true);
    setIsLoading(true);

    const initialProgress: { [key: number]: 'pending' | 'complete' | 'error' } = {};
    chatState.parallelTasks.forEach((_, index) => {
      initialProgress[index] = 'pending';
    });
    chatState.setProgressStatus(initialProgress);

    const graphStructure = canvasStore.buildGraphStructure();

    if (!graphStructure) {
      setError('No graph structure available');
      chatState.setShowProgressModal(false);
      setIsLoading(false);
      return;
    }

    const parentId = selectedId || (nexuses.length > 0 ? nexuses[0].id : null);

    if (!parentId) {
      setError('No parent node found');
      chatState.setShowProgressModal(false);
      setIsLoading(false);
      return;
    }

    try {
      const taskPromises = chatState.parallelTasks.map(async (task, index) => {
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'gap-parallel',
              currentGraph: graphStructure.currentGraph,
              activatedGraphs: graphStructure.activatedGraphs,
              task: task,
            }),
          });

          if (!response.ok) {
            throw new Error(`Task ${index + 1} failed: ${response.statusText}`);
          }

          const data = await response.json();
          chatState.setProgressStatus(prev => ({ ...prev, [index]: 'complete' }));
          return { index, content: data.content, success: true };
        } catch (error) {
          chatState.setProgressStatus(prev => ({ ...prev, [index]: 'error' }));
          return { index, error: error, success: false };
        }
      });

      const results = await Promise.all(taskPromises);
      await new Promise(resolve => setTimeout(resolve, 500));

      const successfulResults = results.filter(r => r.success);

      for (const result of successfulResults) {
        if (result.content) {
          canvasStore.addNode(result.content, parentId, undefined, 'ai-response');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      chatState.setShowProgressModal(false);
      chatState.setProgressStatus({});
    } catch {
      setError('Parallel execution failed');
      chatState.setShowProgressModal(false);
      chatState.setProgressStatus({});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    const isSpatialMode = userMessage.includes('**');
    const cleanMessage = userMessage;

    setMessage('');
    setIsLoading(true);
    setError(null);

    const doctrinalPatterns = [
      /create\s+(?:a\s+)?(?:doctrine|doctrinal)\s+(?:map|universe)\s+(?:for|of|about)\s+(.+)/i,
      /generate\s+(?:a\s+)?(?:doctrine|doctrinal)\s+(?:map|universe)\s+(?:for|of|about)\s+(.+)/i,
      /build\s+(?:a\s+)?(?:doctrine|doctrinal)\s+(?:map|universe)\s+(?:for|of|about)\s+(.+)/i,
    ];

    let isDoctrinalMode = false;
    let ruleName = '';

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

    const messageHandlerArgs = {
      userMessage,
      isFirstMessage,
      cleanMessage,
      isSpatialMode,
      ...chatState,
      ...canvasStore,
    };

    if (isDoctrinalMode) {
      handleDoctrinalMode({ ...messageHandlerArgs, ruleName });
    } else if (gapModeEnabled && !isSpatialMode) {
      handleGapMode(messageHandlerArgs);
    } else {
      handleStandardMode(messageHandlerArgs);
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
      <ChatUI
        {...chatState}
        isSpatialModeActive={isSpatialModeActive}
        handleSendMessage={handleSendMessage}
        handleKeyPress={handleKeyPress}
        activatedUniverseIds={canvasStore.activatedUniverseIds}
      />
      <GapModeModals
        {...chatState}
        executeParallelTasks={executeParallelTasks}
      />
      <SpatialNavigator
        sections={chatState.spatialSections}
        isVisible={chatState.showSpatialNavigator}
      />
      <DoctrinalGenerationModal
        isOpen={chatState.isGeneratingDoctrine}
        ruleName={chatState.detectedRuleName}
        stage={chatState.doctrinalStage}
        errorMessage={chatState.doctrinalError || undefined}
      />
    </>
  );
}