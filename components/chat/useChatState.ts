
'use client';

import { useState } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export type DoctrinalStage = 'researching' | 'finding-cases' | 'analyzing' | 'building-map' | 'complete' | 'error';

export function useChatState() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [spatialSections, setSpatialSections] = useState<Array<{ title: string; type: string }>>([]);
  const [showSpatialNavigator, setShowSpatialNavigator] = useState(false);

  // GAP Mode state
  const [gapModeEnabled, setGapModeEnabled] = useState(false);
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [parallelTasks, setParallelTasks] = useState<string[]>([]);
  const [planningReasoning, setPlanningReasoning] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressStatus, setProgressStatus] = useState<{ [key: number]: 'pending' | 'complete' | 'error' }>({});

  // Doctrinal generation state
  const [isGeneratingDoctrine, setIsGeneratingDoctrine] = useState(false);
  const [doctrinalStage, setDoctrinalStage] = useState<DoctrinalStage>('researching');
  const [doctrinalError, setDoctrinalError] = useState<string | null>(null);
  const [detectedRuleName, setDetectedRuleName] = useState('');

  return {
    message,
    setMessage,
    isLoading,
    setIsLoading,
    error,
    setError,
    currentParentId,
    setCurrentParentId,
    isFirstMessage,
    setIsFirstMessage,
    conversationHistory,
    setConversationHistory,
    spatialSections,
    setSpatialSections,
    showSpatialNavigator,
    setShowSpatialNavigator,
    gapModeEnabled,
    setGapModeEnabled,
    showPlanningModal,
    setShowPlanningModal,
    parallelTasks,
    setParallelTasks,
    planningReasoning,
    setPlanningReasoning,
    showProgressModal,
    setShowProgressModal,
    progressStatus,
    setProgressStatus,
    isGeneratingDoctrine,
    setIsGeneratingDoctrine,
    doctrinalStage,
    setDoctrinalStage,
    doctrinalError,
    setDoctrinalError,
    detectedRuleName,
    setDetectedRuleName,
  };
}
