'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCanvasStore } from '@/lib/store';
import { parseVideoUrl } from '@/lib/videoUtils';
import ApplicationEssaySection from './ApplicationEssaySection';
import { NodeType } from '@/lib/types';
import {
  buildDoctrinePracticeBundle,
  getAvailablePracticeSteps,
  type DoctrinePracticeBundle,
  type PracticeStepId,
} from '@/lib/guidedPracticeHelpers';
import { generateUniverseStudyGuide, UniverseDefinition } from '@/lib/studyGuideGenerator';
import { StudyGuideWriteUp } from '@/lib/types';
import { loadVideoFile } from '@/lib/db';

type ActionMode = 'user-reply' | 'ask-ai' | 'explore-together' | null;

// VideoPlayer component with YouTube API for proper end time enforcement
function VideoPlayer({ videoUrl, startTime, endTime }: {
  videoUrl: string;
  startTime?: number | null;
  endTime?: number | null;
}) {
  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [playerId] = useState(`youtube-player-${Math.random().toString(36).substr(2, 9)}`);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Check if this is a blob URL (uploaded video)
  const isBlobUrl = videoUrl.startsWith('blob:');

  // For blob URLs, use HTML5 video player
  useEffect(() => {
    if (!isBlobUrl || !videoRef.current) return;

    const video = videoRef.current;

    // Set start time when video loads
    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
      if (startTime && startTime > 0) {
        video.currentTime = startTime;
      }
    };

    // Monitor playback and enforce end time
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (endTime && video.currentTime >= endTime) {
        video.pause();
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isBlobUrl, videoUrl, startTime, endTime]);

  // For YouTube URLs, use existing YouTube API logic
  useEffect(() => {
    if (isBlobUrl) return; // Skip YouTube logic for blob URLs

    const parsedVideo = parseVideoUrl(videoUrl, startTime, endTime);
    if (!parsedVideo || parsedVideo.provider !== 'youtube') {
      return; // Only handle YouTube for now
    }

    // Extract video ID from embed URL
    const videoIdMatch = parsedVideo.embedUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) return;
    const videoId = videoIdMatch[1];

    // Load YouTube IFrame API
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    function initPlayer() {
      playerRef.current = new (window as any).YT.Player(playerId, {
        videoId: videoId,
        playerVars: {
          start: startTime && startTime > 0 ? Math.floor(startTime) : undefined,
          autoplay: 0,
          modestbranding: 1,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    }

    function onPlayerReady(event: any) {
      // Get the total video duration
      const duration = event.target.getDuration();
      setVideoDuration(duration);
    }

    function onPlayerStateChange(event: any) {
      // When video is playing, monitor the time
      if (event.data === (window as any).YT.PlayerState.PLAYING && endTime && endTime > 0) {
        // Clear any existing interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        // Check every 100ms if we've reached the end time and update progress
        intervalRef.current = setInterval(() => {
          if (playerRef.current && playerRef.current.getCurrentTime) {
            const time = playerRef.current.getCurrentTime();
            setCurrentTime(time);

            if (time >= endTime) {
              playerRef.current.pauseVideo();
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          }
        }, 100);
      }

      // Clear interval when video is paused or ended
      if (event.data === (window as any).YT.PlayerState.PAUSED ||
        event.data === (window as any).YT.PlayerState.ENDED) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [videoUrl, startTime, endTime, playerId, isBlobUrl]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate segment position and width for timeline
  const segmentStart = startTime || 0;
  const segmentEnd = endTime || videoDuration || 0;
  const totalDuration = videoDuration || segmentEnd;

  const segmentLeftPercent = totalDuration > 0 ? (segmentStart / totalDuration) * 100 : 0;
  const segmentWidthPercent = totalDuration > 0 ? ((segmentEnd - segmentStart) / totalDuration) * 100 : 100;

  // For uploaded videos (blob URLs), use HTML5 video player
  if (isBlobUrl) {
    return (
      <div className="w-full mx-auto" style={{ maxWidth: '1000px' }}>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="absolute top-0 left-0 w-full h-full rounded-lg border-2 border-cyan-500/30"
          />
        </div>

        {/* Timeline Indicator */}
        {videoDuration && (
          <div className="mt-4 px-2">
            <div className="flex justify-between items-center mb-2 text-xs text-gray-400">
              <span>Section: {formatTime(segmentStart)} - {formatTime(segmentEnd)}</span>
              <span>Total: {formatTime(totalDuration)}</span>
            </div>

            {/* Timeline bar */}
            <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              {/* Grayed out left section */}
              {segmentStart > 0 && (
                <div
                  className="absolute top-0 left-0 h-full bg-gray-900/50"
                  style={{ width: `${segmentLeftPercent}%` }}
                />
              )}

              {/* Active playable segment */}
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-x-2 border-cyan-400"
                style={{
                  left: `${segmentLeftPercent}%`,
                  width: `${segmentWidthPercent}%`
                }}
              >
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs font-bold text-cyan-300 drop-shadow-lg">
                    {formatTime(segmentEnd - segmentStart)} segment
                  </span>
                </div>
              </div>

              {/* Grayed out right section */}
              {segmentEnd < totalDuration && (
                <div
                  className="absolute top-0 right-0 h-full bg-gray-900/50"
                  style={{ width: `${100 - (segmentLeftPercent + segmentWidthPercent)}%` }}
                />
              )}

              {/* Current playback position indicator */}
              {currentTime > 0 && currentTime >= segmentStart && currentTime <= segmentEnd && (
                <div
                  className="absolute top-0 h-full w-1 bg-red-500 transition-all duration-100"
                  style={{
                    left: `${(currentTime / totalDuration) * 100}%`
                  }}
                >
                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full shadow-lg" />
                </div>
              )}
            </div>

            {/* Time labels */}
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>0:00</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const parsedVideo = parseVideoUrl(videoUrl, startTime, endTime);

  console.log('🎬 VideoPlayer rendering:', {
    videoUrl,
    startTime,
    endTime,
    parsedVideo,
  });

  if (!parsedVideo) {
    console.error('❌ Failed to parse video URL:', videoUrl);
    return null;
  }

  // For YouTube, use the div that will be replaced by the player
  if (parsedVideo.provider === 'youtube') {
    console.log('✅ Using YouTube IFrame API for:', parsedVideo.embedUrl);
    return (
      <div className="w-full mx-auto" style={{ maxWidth: '1000px' }}>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <div
            id={playerId}
            className="absolute top-0 left-0 w-full h-full rounded-lg border-2 border-cyan-500/30"
          />
        </div>

        {/* Timeline Indicator */}
        {videoDuration && (
          <div className="mt-4 px-2">
            <div className="flex justify-between items-center mb-2 text-xs text-gray-400">
              <span>Section: {formatTime(segmentStart)} - {formatTime(segmentEnd)}</span>
              <span>Total: {formatTime(totalDuration)}</span>
            </div>

            {/* Timeline bar */}
            <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              {/* Grayed out left section */}
              {segmentStart > 0 && (
                <div
                  className="absolute top-0 left-0 h-full bg-gray-900/50"
                  style={{ width: `${segmentLeftPercent}%` }}
                />
              )}

              {/* Active playable segment */}
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-x-2 border-cyan-400"
                style={{
                  left: `${segmentLeftPercent}%`,
                  width: `${segmentWidthPercent}%`
                }}
              >
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs font-bold text-cyan-300 drop-shadow-lg">
                    {formatTime(segmentEnd - segmentStart)} segment
                  </span>
                </div>
              </div>

              {/* Grayed out right section */}
              {segmentEnd < totalDuration && (
                <div
                  className="absolute top-0 right-0 h-full bg-gray-900/50"
                  style={{ width: `${100 - (segmentLeftPercent + segmentWidthPercent)}%` }}
                />
              )}

              {/* Current playback position indicator */}
              {currentTime > 0 && currentTime >= segmentStart && currentTime <= segmentEnd && (
                <div
                  className="absolute top-0 h-full w-1 bg-red-500 transition-all duration-100"
                  style={{
                    left: `${(currentTime / totalDuration) * 100}%`
                  }}
                >
                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full shadow-lg" />
                </div>
              )}
            </div>

            {/* Time labels */}
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>0:00</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // For other providers (Vimeo, etc), use regular iframe
  console.log('🎥 Using fallback iframe for:', {
    provider: parsedVideo.provider,
    embedUrl: parsedVideo.embedUrl,
  });

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: '1000px', paddingBottom: '56.25%' }}>
      <iframe
        src={parsedVideo.embedUrl}
        className="absolute top-0 left-0 w-full h-full rounded-lg border-2 border-cyan-500/30"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export default function UnifiedNodeModal() {
  const pathname = usePathname();
  const isExplorePage = pathname === '/explore' || pathname === '/create' || pathname === '/chat';

  const selectedId = useCanvasStore((state) => state.selectedId);
  const nodes = useCanvasStore((state) => state.nodes);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const showContentOverlay = useCanvasStore((state) => state.showContentOverlay);
  const isApplicationLabMode = useCanvasStore((state) => state.isApplicationLabMode);
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
  const getNodeChildrenCount = useCanvasStore((state) => state.getNodeChildrenCount);
  const deleteNode = useCanvasStore((state) => state.deleteNode);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState({ childrenCount: 0 });

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

  // Loaded video URL from IndexedDB
  const [loadedVideoUrl, setLoadedVideoUrl] = useState<string | null>(null);

  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Quiz Me / Deep Thinking mode state
  const [explorationMode, setExplorationMode] = useState<'deep-thinking' | 'quiz' | 'quiz-mc' | null>(null);
  const [quizFeedback, setQuizFeedback] = useState('');
  const [deepThinkingEngagement, setDeepThinkingEngagement] = useState(''); // AI's response to user's thinking
  const [quizHistory, setQuizHistory] = useState<string[]>([]); // Track previous questions for diverse question generation
  const [deepThinkingHistory, setDeepThinkingHistory] = useState<Array<{
    question: string;
    userAnswer: string;
    aiEngagement: string;
  }>>([]); // Track deep thinking conversation for progressive depth

  // Quiz format selection modal
  const [showQuizFormatModal, setShowQuizFormatModal] = useState(false);

  // Multiple choice quiz state
  const [mcQuestions, setMcQuestions] = useState<Array<{
    question: string;
    options: { A: string; B: string; C: string; D: string };
    correctAnswer: string;
    explanation: string;
  }>>([]);
  const [currentMcQuestion, setCurrentMcQuestion] = useState(0);
  const [selectedMcAnswer, setSelectedMcAnswer] = useState<string | null>(null);
  const [mcAnswered, setMcAnswered] = useState(false);
  const [mcResults, setMcResults] = useState<Array<{
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }>>([]);

  // Application essay state
  const [showEssaySection, setShowEssaySection] = useState(false);

  // 🌱 EVOLVING NEXUS - Toggle for viewing original content vs mastery summary
  const [showOriginalContent, setShowOriginalContent] = useState(false);

  // 🎓 GUIDED PRACTICE - State for atomization-based practice panel
  const [showGuidedPractice, setShowGuidedPractice] = useState(false);
  const [activePracticeStep, setActivePracticeStep] = useState<PracticeStepId>('intuition');
  const [practiceStepInput, setPracticeStepInput] = useState('');
  const [practiceStepFeedback, setPracticeStepFeedback] = useState('');
  const [isGradingPractice, setIsGradingPractice] = useState(false);

  // Track progress for each L1 node separately
  const [l1NodeProgress, setL1NodeProgress] = useState<Record<string, PracticeStepId>>({});
  const [currentL1NodeId, setCurrentL1NodeId] = useState<string | null>(null);

  // Intuition question state
  const [intuitionQuestion, setIntuitionQuestion] = useState<{
    question: string;
    options: string[];
  } | null>(null);
  const [selectedIntuitionOption, setSelectedIntuitionOption] = useState<string | null>(null);
  const [isLoadingIntuitionQuestion, setIsLoadingIntuitionQuestion] = useState(false);
  const [intuitionQuestionNodeId, setIntuitionQuestionNodeId] = useState<string | null>(null);

  // 🎓 COMPLETION MODAL - Show study guide on universe completion
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedStudyGuide, setCompletedStudyGuide] = useState<StudyGuideWriteUp | null>(null);
  const [showStudyGuideViewer, setShowStudyGuideViewer] = useState(false);

  // CRITICAL: Use a ref to immediately track Socratic mode (prevents race conditions with async state)
  const isSocraticModeActive = useRef(false);

  // Find selected node or nexus
  const node = selectedId ? nodes[selectedId] : null;

  // Load uploaded video file from IndexedDB if needed
  useEffect(() => {
    const loadVideo = async () => {
      if (!node || node.videoUrl !== 'uploaded-video') {
        setLoadedVideoUrl(null);
        return;
      }

      // Find the universe ID (parent nexus)
      let currentId = node.parentId;
      while (currentId) {
        const foundNexus = nexuses.find(n => n.id === currentId);
        if (foundNexus) {
          // Load video from IndexedDB
          const videoUrl = await loadVideoFile(foundNexus.id);
          setLoadedVideoUrl(videoUrl);
          console.log('✅ Loaded video file from IndexedDB for universe:', foundNexus.id);
          return;
        }

        const parentNode = nodes[currentId];
        if (parentNode) {
          currentId = parentNode.parentId;
        } else {
          break;
        }
      }
    };

    loadVideo();
  }, [node, nodes, nexuses]);

  // 🔄 MANAGE GUIDED PRACTICE PROGRESS when switching between L1 nodes
  useEffect(() => {
    if (!node) return;

    // Check if this node has guided practice (is an L1 doctrine node)
    const bundle = buildDoctrinePracticeBundle(node, nodes);
    if (!bundle) {
      // Not an L1 node with guided practice - ignore
      return;
    }

    // Check if we've switched to a different L1 node
    if (currentL1NodeId !== node.id) {
      console.log('🔄 Switched to L1 node:', node.id);

      // Save current progress for previous L1 node (if any)
      if (currentL1NodeId) {
        setL1NodeProgress(prev => ({
          ...prev,
          [currentL1NodeId]: activePracticeStep
        }));
      }

      // Update current L1 node ID
      setCurrentL1NodeId(node.id);

      // Load saved progress for this L1 node, or start from beginning
      const steps = getAvailablePracticeSteps(bundle);
      const savedStep = l1NodeProgress[node.id];
      const stepToUse = savedStep && steps.includes(savedStep) ? savedStep : steps[0];

      console.log('📖 Loading L1 progress:', {
        nodeId: node.id,
        savedStep,
        stepToUse,
        isNewL1: !savedStep
      });

      // Reset guided practice UI state
      setShowGuidedPractice(false);
      setActivePracticeStep(stepToUse || 'intuition');
      setPracticeStepInput('');
      setPracticeStepFeedback('');
      setIsGradingPractice(false);
    }
  }, [selectedId, node, nodes, currentL1NodeId, activePracticeStep, l1NodeProgress]);
  const nexus = selectedId ? nexuses.find((n) => n.id === selectedId) : null;
  const selectedItem = node || nexus;

  // Find root nexus for a node (traverse up the parent chain)
  const getRootNexus = (nodeObj: typeof node): typeof nexus => {
    if (!nodeObj) return null;

    let currentId = nodeObj.parentId;
    while (currentId) {
      // Check if current is a nexus
      const foundNexus = nexuses.find(n => n.id === currentId);
      if (foundNexus) return foundNexus;

      // Otherwise, check if it's a node and go up
      const parentNode = nodes[currentId];
      if (parentNode) {
        currentId = parentNode.parentId;
      } else {
        break;
      }
    }
    return null;
  };

  // Get the appropriate nexus (either selected nexus or root nexus of selected node)
  const displayNexus = nexus || getRootNexus(node);

  // 🎓 GUIDED PRACTICE - Build practice bundle if available
  const practiceBundle: DoctrinePracticeBundle | null = node
    ? buildDoctrinePracticeBundle(node, nodes)
    : null;
  const availablePracticeSteps = practiceBundle
    ? getAvailablePracticeSteps(practiceBundle)
    : [];
  const hasGuidedPractice = availablePracticeSteps.length > 0;

  // Debug logging
  if (node) {
    console.log('🎓 Guided Practice Debug:', {
      nodeId: node.id,
      nodeTitle: node.title,
      childrenCount: node.children?.length || 0,
      children: node.children,
      practiceBundle: practiceBundle,
      availablePracticeSteps: availablePracticeSteps,
      hasGuidedPractice: hasGuidedPractice
    });
  }

  // Toast notification helper
  const showToastNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000); // Auto-dismiss after 3 seconds
  };

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

  // 🎓 EVOLVING NEXUS - Display Application Lab for completed nexuses (unless user wants to see original)
  const isApplicationLabNexus = nexus && nexus.evolutionState === 'application-lab' && nexus.applicationLabConfig;
  const displayContent = node?.isConnectionNode
    ? getConnectionContent()
    : (isApplicationLabNexus && !showOriginalContent)
      ? (nexus.applicationLabConfig?.doctrineSummary || '')
      : (selectedItem?.content || '');

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
      // 🔬 Don't clear if Application Lab is active
      if (isApplicationLabMode) {
        console.log('⚠️ Skipping modal cleanup - Application Lab is active');
        return;
      }

      console.log('❌ Modal closing (no Socratic mode) - clearing action mode');
      setActionMode(null);
      setInputContent('');
    }
  }, [selectedId, showContentOverlay, socraticRootId, socraticQuestion, isApplicationLabMode]);

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

      // Delete/Backspace - delete node
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteClick();
      }

      // Escape - close modal
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          setShowContentOverlay(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [node, nexus, nodes, nexuses, selectNode, setShowContentOverlay, showDeleteConfirm]);

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

  // ➡️ NAVIGATE TO NEXT PRACTICE STEP - From a completed L2 node
  const handleGoToNextPracticeStep = () => {
    if (!node || !node.parentId) return;

    // Determine next step based on current node type
    const nextStepMap: Record<string, PracticeStepId | null> = {
      'intuition-example': 'model',
      'model-answer': 'imitate',
      'imitate': 'quiz',
      'quiz-mc': 'synthesis',
      'quiz-short-answer': 'synthesis',
      'synthesis': null, // Final step, no next
    };

    const nextStep = node.nodeType ? nextStepMap[node.nodeType] : null;

    if (nextStep) {
      // Navigate to parent doctrine node
      selectNode(node.parentId, true);

      // Open guided practice panel and set active step
      setTimeout(() => {
        setShowGuidedPractice(true);
        setActivePracticeStep(nextStep);
      }, 300);
    }
  };

  // 💾 SAVE PRACTICE STEP WITHOUT AI FEEDBACK - Creates L2 node and animates to it
  const handleSavePracticeStepOnly = async (stepType: string, userAnswer: string, referenceContent: string) => {
    if (!userAnswer.trim()) return;

    try {
      // Create L2 practice node with question + answer (no AI feedback)
      const nodeTypeMap: Record<string, NodeType> = {
        'intuition': 'intuition-example',
        'imitate': 'imitate',
        'scenario': 'synthesis'
      };

      // Different formatting for intuition step (includes gut reaction label)
      let combinedContent = '';
      if (stepType === 'intuition') {
        combinedContent = `${referenceContent}\n\n---\n\n**Your Gut Reaction:**\n${userAnswer}`;
      } else {
        combinedContent = `${referenceContent}\n\n---\n\n**Your Response:**\n${userAnswer}`;
      }

      const newNodeId = addNode(combinedContent, node!.id, undefined, nodeTypeMap[stepType] || 'user-reply');

      console.log('💾 Practice step saved (no AI feedback):', newNodeId);

      // Clear input
      setPracticeStepInput('');

      // 🎬 SMOOTH FLOW: Show the new purple diamond appearing
      // Step 1: Longer pause to let the purple diamond materialize and settle
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 2: Animate camera to the new node and open its modal
      // User will interact with this modal, then click button to continue
      selectNode(newNodeId, true);

      setToastMessage('💾 Your answer has been saved!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('❌ Failed to save practice step:', error);
    }
  };

  // 💡 GENERATE INTUITION QUESTION - AI generates engaging question for doctrine
  const generateIntuitionQuestion = async (doctrineContent: string, nodeId: string) => {
    if (intuitionQuestionNodeId === nodeId && intuitionQuestion) {
      // Already have a question for this node
      return;
    }

    setIsLoadingIntuitionQuestion(true);
    setIntuitionQuestion(null);
    setSelectedIntuitionOption(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: doctrineContent }],
          mode: 'intuition-question'
        }),
      });

      if (!response.ok) throw new Error('Failed to generate intuition question');

      const data = await response.json();
      setIntuitionQuestion(data.response);
      setIntuitionQuestionNodeId(nodeId);
    } catch (error) {
      console.error('❌ Failed to generate intuition question:', error);
      // Use fallback question
      setIntuitionQuestion({
        question: "What's your gut reaction to this doctrine? Does it feel fair or problematic?",
        options: [
          "This seems like a reasonable balance of interests",
          "This feels like it protects the powerful at the expense of the vulnerable",
          "This creates necessary but uncomfortable tradeoffs",
          "The real-world effects probably differ from the stated purpose"
        ]
      });
    } finally {
      setIsLoadingIntuitionQuestion(false);
    }
  };

  // 🎓 GRADE PRACTICE STEP - AI grades user's practice attempt
  const handleGradePracticeStep = async (stepType: string, userAnswer: string, referenceContent: string) => {
    if (!userAnswer.trim()) return;

    setIsGradingPractice(true);
    setPracticeStepFeedback('');

    try {
      let gradingPrompt = '';

      if (stepType === 'imitate') {
        gradingPrompt = `The student was asked to apply this reasoning pattern:

"${referenceContent}"

Their attempt:
"${userAnswer}"

Provide constructive feedback in 2-3 sentences on:
1. Whether they correctly applied the pattern
2. What they did well
3. One specific way to improve (if needed)

Be encouraging but honest about accuracy.`;
      } else if (stepType === 'scenario') {
        gradingPrompt = `The student was given this application scenario:

"${referenceContent}"

Their analysis:
"${userAnswer}"

Provide constructive feedback in 2-3 sentences on:
1. Whether they correctly analyzed the scenario
2. Key insights they demonstrated
3. Any important aspects they might have missed

Be encouraging and help them think more deeply.`;
      } else if (stepType === 'intuition') {
        gradingPrompt = `The student was shown this intuition example and asked for their gut reaction and where it sits in their world model:

"${referenceContent}"

Their intuitive response:
"${userAnswer}"

This is a DIAGNOSTIC moment. Use their gut reaction to adapt your teaching:

- If they show CONFUSION or MISUNDERSTANDING: Make the content more concrete, relatable, or surprising. Use an analogy, tell a story, or reframe the concept.
- If they show ACCURATE INTUITION or CURIOSITY: Build on their understanding! Go deeper, pose a challenging question, or reveal non-obvious connections.
- If they express SKEPTICISM or CHALLENGE: Acknowledge their critical thinking and show evidence or why it matters.
- If they seem SUPERFICIAL or INDIFFERENT: Spark deeper engagement with a provocative angle or reveal surprising implications.

Provide a response in TWO parts:

**Part 1 - Adaptive Response (1-2 sentences):**
Acknowledge their intuitive understanding and help them refine or deepen their mental model.

**Part 2 - Interesting Factoid (2-3 sentences):**
Generate ONE interesting, engaging factoid or insight that's TAILORED to their current understanding:
- If confused/uncertain → Make it concrete with a clear example or analogy
- If accurate/curious → Go deeper, show complexity, or reveal counterintuitive aspects
- If skeptical → Provide surprising evidence or show real-world implications
- If superficial → Reveal hidden depth or connect to bigger principles

Format your response EXACTLY like this:

💬 **Response:** [Your adaptive response here]

✨ **Factoid:** [Your tailored factoid here]

Be conversational and human, not formulaic.`;
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: gradingPrompt }],
          mode: 'standard',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Failed to get AI feedback');

      const data = await response.json();
      setPracticeStepFeedback(data.response);
      setIsGradingPractice(false);

      // 🎯 Create L2 practice node (purple diamond) for each step
      const nodeTypeMap: Record<string, NodeType> = {
        'intuition': 'intuition-example',
        'imitate': 'imitate',
        'scenario': 'synthesis'
      };

      // Different formatting for intuition step (includes gut reaction)
      let combinedContent = '';
      if (stepType === 'intuition') {
        combinedContent = `${referenceContent}\n\n---\n\n**Your Gut Reaction:**\n${userAnswer}\n\n${data.response}`;
      } else {
        combinedContent = `${referenceContent}\n\n---\n\n**Your Response:**\n${userAnswer}\n\n**AI Feedback:**\n${data.response}`;
      }

      const newNodeId = addNode(combinedContent, node!.id, undefined, nodeTypeMap[stepType] || 'user-reply');

      console.log('✨ Practice step completed! Purple diamond created:', newNodeId);

      // Clear input
      setPracticeStepInput('');

      // 🎬 SMOOTH FLOW: Show the new purple diamond appearing
      // Step 1: Longer pause to let the purple diamond materialize and settle
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 2: Animate camera to the new node and open its modal
      // User will interact with this modal, then click button to continue
      selectNode(newNodeId, true);
    } catch (error: any) {
      console.error('❌ Failed to grade practice step:', error);
      if (error.name === 'AbortError') {
        setPracticeStepFeedback('Request timed out. The AI is taking too long to respond. Please try again.');
      } else {
        setPracticeStepFeedback('Sorry, could not get feedback at this time. Please try again.');
      }
      setIsGradingPractice(false);
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

  // Handle delete button click
  const handleDeleteClick = () => {
    // Check if it's a nexus
    if (nexus && !node) {
      alert('Cannot delete nexus. To remove this universe, use the Delete button on the Memories page.');
      return;
    }

    if (!node) return;

    // Get children count
    const childrenCount = getNodeChildrenCount(node.id);

    setDeleteInfo({ childrenCount });
    setShowDeleteConfirm(true);
  };

  // Handle confirmed delete
  const handleConfirmDelete = () => {
    if (!node) return;

    console.log('🗑️ User confirmed delete');

    // Delete the node (cascade handled in store)
    deleteNode(node.id);

    // Close confirmation and modal
    setShowDeleteConfirm(false);
    setShowContentOverlay(false);

    console.log('✅ Node deleted');
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
            content: `Previous question: "${socraticQuestion}"\nUser's answer: "${userAnswerText}"\n\n${isQuizMode
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

          // 🎯 MARK NODE AS COMPLETED AFTER 3 QUESTIONS (shows engagement with material)
          if (updatedProgress.questionsAsked.length >= 3 && !node.isCompleted) {
            console.log('🎯 Quiz threshold reached (3 questions) - marking node as completed');
            const { markNodeCompleted } = useCanvasStore.getState();
            const wasUnlocked = markNodeCompleted(node.id);

            if (wasUnlocked) {
              console.log('🔓 Next section unlocked!');
              showToastNotification('🔓 Next section unlocked!');
            }
          }
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

  // End quiz - returns to guided practice panel
  const handleEndQuiz = () => {
    if (!socraticRootId) return;

    console.log('🏁 Ending quiz mode - returning to guided practice');

    // CRITICAL: Clear the ref to allow normal state clearing
    isSocraticModeActive.current = false;
    console.log('🔓 Quiz mode ref set to FALSE - quiz ended');

    setSocraticQuestion(null);
    setSocraticRootId(null);
    setInputContent('');
    setQuizFeedback('');
    setExplorationMode(null);
    setActionMode(null);

    // Return to guided practice panel at quiz step (keep modal open)
    if (node?.parentId) {
      console.log('🔙 Returning to guided practice panel');
      selectNode(node.parentId, true);

      setTimeout(() => {
        setShowGuidedPractice(true);
        setActivePracticeStep('quiz');
      }, 300);
    } else {
      // Fallback: close modal if no parent
      selectNode(selectedId, false);
    }
  };

  // 📝 MULTIPLE CHOICE QUIZ
  const handleStartMultipleChoice = async () => {
    if (!selectedId) return;

    setShowQuizFormatModal(false);
    setExplorationMode('quiz-mc');
    setIsLoadingAI(true);

    try {
      const contextContent = displayContent;

      // 🚀 OPTIMIZATION: Generate first question immediately, then queue the rest
      const generateQuestion = async (questionNumber: number) => {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: contextContent
            }],
            mode: 'quiz-mc',
            numberOfQuestions: 1, // Generate one at a time
            questionNumber // Pass which question this is (for variety)
          }),
        });

        if (!response.ok) throw new Error('Failed to generate MC quiz');

        const data = await response.json();

        // Parse MARKDOWN response (not JSON!)
        const rawText = (data.content || data.response || '').trim();
        console.log('📥 Raw response from quiz API:', rawText.substring(0, 300));

        try {
          // Parse markdown format
          const questionMatch = rawText.match(/\*\*Question:\*\*\s*([\s\S]*?)(?=\*\*Options:\*\*)/);
          const optionsSection = rawText.match(/\*\*Options:\*\*\s*([\s\S]*?)(?=\*\*Correct Answer:\*\*)/);
          const correctMatch = rawText.match(/\*\*Correct Answer:\*\*\s*([A-D])/i);
          const explanationMatch = rawText.match(/\*\*Explanation:\*\*\s*([\s\S]*?)$/);

          if (!questionMatch || !optionsSection || !correctMatch || !explanationMatch) {
            throw new Error('Could not parse markdown format');
          }

          const question = questionMatch[1].trim();
          const optionsText = optionsSection[1].trim();

          console.log('🔍 Options section text:', optionsText);

          // Parse options - split by A), B), C), D) and extract text between them
          const optionA = optionsText.match(/A\)([\s\S]*?)(?=B\)|$)/i);
          const optionB = optionsText.match(/B\)([\s\S]*?)(?=C\)|$)/i);
          const optionC = optionsText.match(/C\)([\s\S]*?)(?=D\)|$)/i);
          const optionD = optionsText.match(/D\)([\s\S]*?)$/i);

          console.log('🔍 Option A match:', optionA);
          console.log('🔍 Option B match:', optionB);
          console.log('🔍 Option C match:', optionC);
          console.log('🔍 Option D match:', optionD);

          const options = [
            optionA ? optionA[1].trim() : '',
            optionB ? optionB[1].trim() : '',
            optionC ? optionC[1].trim() : '',
            optionD ? optionD[1].trim() : ''
          ];

          console.log('📋 Parsed options:', options);

          if (options.some(opt => !opt)) {
            console.error('❌ Some options are empty!');
            console.error('Options text was:', optionsText);
            throw new Error(`Failed to parse all options. Got: ${JSON.stringify(options)}`);
          }

          const correctAnswer = correctMatch[1].toUpperCase();
          const explanation = explanationMatch[1].trim();

          const parsedQuestion = {
            question,
            options: {
              A: options[0],
              B: options[1],
              C: options[2],
              D: options[3]
            },
            correctAnswer, // Keep as letter 'A', 'B', 'C', or 'D'
            explanation
          };

          console.log('✅ Parsed MC question:', parsedQuestion.question.substring(0, 100));
          return parsedQuestion;
        } catch (parseError) {
          console.error('❌ Failed to parse quiz markdown:', parseError);
          console.error('📄 Raw response:', rawText);
          throw new Error('AI returned invalid format. Please try again.');
        }
      };

      // Generate first question immediately
      console.log('📝 Generating question 1/5...');
      const firstQuestion = await generateQuestion(1);

      setMcQuestions([firstQuestion]);
      setCurrentMcQuestion(0);
      setSelectedMcAnswer(null);
      setMcAnswered(false);
      setMcResults([]);
      setSocraticRootId(selectedId);
      isSocraticModeActive.current = true;
      setIsLoadingAI(false);

      console.log('✅ First question ready! Generating remaining questions in background...');

      // 🔄 Generate remaining 4 questions in background
      (async () => {
        for (let i = 2; i <= 5; i++) {
          try {
            console.log(`📝 Background: Generating question ${i}/5...`);
            const question = await generateQuestion(i);
            setMcQuestions(prev => [...prev, question]);
            console.log(`✅ Background: Question ${i}/5 ready`);
          } catch (err) {
            console.error(`❌ Failed to generate background question ${i}:`, err);
          }
        }
        console.log('✅ All questions generated!');
      })();

    } catch (error) {
      console.error('❌ Failed to generate MC quiz:', error);
      setExplorationMode(null);
      setIsLoadingAI(false);
    }
  };

  // Submit MC answer
  const handleSubmitMcAnswer = () => {
    if (!selectedMcAnswer || mcAnswered || !socraticRootId) return;

    const currentQ = mcQuestions[currentMcQuestion];
    const isCorrect = selectedMcAnswer === currentQ.correctAnswer;

    setMcResults([
      ...mcResults,
      {
        question: currentQ.question,
        selectedAnswer: selectedMcAnswer,
        correctAnswer: currentQ.correctAnswer,
        isCorrect
      }
    ]);

    // Create a user reply node in 3D space
    const resultEmoji = isCorrect ? '✓' : '✗';
    const mcAnswerNode = `Q: ${currentQ.question}\n\nYour answer: ${selectedMcAnswer}) ${currentQ.options[selectedMcAnswer as keyof typeof currentQ.options]}\n\n${resultEmoji} ${isCorrect ? 'Correct!' : 'Incorrect'}\n\n${currentQ.explanation}`;

    console.log('📝 Creating MC answer node...');
    addNode(mcAnswerNode, socraticRootId);

    setMcAnswered(true);

    // Keep modal open to show feedback
    setTimeout(() => {
      selectNode(socraticRootId, true);
      setShowContentOverlay(true);
    }, 100);
  };

  // Next MC question
  const handleNextMcQuestion = () => {
    if (currentMcQuestion < mcQuestions.length - 1) {
      setCurrentMcQuestion(currentMcQuestion + 1);
      setSelectedMcAnswer(null);
      setMcAnswered(false);
    }
  };

  // End MC quiz - returns to guided practice panel
  const handleEndMcQuiz = () => {
    // 💾 SAVE MCQ RESULTS TO NODE & MARK AS COMPLETED
    if (node && mcResults.length > 0) {
      console.log('📊 Saving MCQ quiz results to node:', node.id);

      // Convert MCQ results to answersGiven format
      const mcAnswersGiven = mcResults.map(result => ({
        question: result.question,
        answer: result.selectedAnswer,
        wasCorrect: result.isCorrect
      }));

      // Update node with MCQ progress
      const updatedProgress = {
        questionsAsked: mcQuestions.map(q => q.question),
        answersGiven: [
          ...(node.quizProgress?.answersGiven || []),
          ...mcAnswersGiven
        ],
        lastQuizDate: Date.now(),
        completedCycles: (node.quizProgress?.completedCycles || 0) + 1
      };

      updateNode(node.id, { quizProgress: updatedProgress });
      console.log('✅ MCQ progress saved:', updatedProgress.questionsAsked.length, 'questions');

      // 🎓 TRACK QUIZ RESULTS TO UNIVERSE RUN
      const { activeUniverseIds, getCurrentRun, addQuizResult, startUniverseRun } = useCanvasStore.getState();
      const activeUniverseId = activeUniverseIds[0];
      if (activeUniverseId) {
        let currentRun = getCurrentRun(activeUniverseId);

        // Start a run if one doesn't exist
        if (!currentRun) {
          const runId = startUniverseRun(activeUniverseId);
          currentRun = getCurrentRun(activeUniverseId);
          console.log('🎓 Started new universe run:', runId);
        }

        if (currentRun) {
          // Track each quiz result
          mcResults.forEach(result => {
            const mcQuestion = mcQuestions.find(q => q.question === result.question);
            addQuizResult(currentRun!.id, {
              nodeId: node.id,
              doctrineTitle: node.title,
              questionType: 'mcq',
              question: result.question,
              userAnswer: result.selectedAnswer,
              correctAnswer: result.correctAnswer,
              wasCorrect: result.isCorrect,
              explanation: mcQuestion?.explanation || '',
              timestamp: Date.now(),
            });
          });
          console.log('🎓 Tracked', mcResults.length, 'quiz results to run:', currentRun.id);
        }
      }

      // 🎯 MARK NODE AS COMPLETED AND UNLOCK NEXT
      const { markNodeCompleted } = useCanvasStore.getState();
      const wasUnlocked = markNodeCompleted(node.id);

      if (wasUnlocked) {
        console.log('🔓 Next section unlocked!');
        showToastNotification('🔓 Next section unlocked!');
      }
    }

    isSocraticModeActive.current = false;
    setSocraticRootId(null);
    setExplorationMode(null);
    setMcQuestions([]);
    setCurrentMcQuestion(0);
    setSelectedMcAnswer(null);
    setMcAnswered(false);
    setMcResults([]);

    // Navigate to next node in conversation after quiz completion
    if (node?.parentId) {
      // Get all sibling nodes (nodes with same parent)
      const siblings = Object.values(nodes)
        .filter(n => n.parentId === node.parentId)
        .sort((a, b) => a.id.localeCompare(b.id));

      const currentIndex = siblings.findIndex(n => n.id === node.id);

      if (currentIndex !== -1 && currentIndex < siblings.length - 1) {
        // There's a next sibling - navigate to it
        const nextSibling = siblings[currentIndex + 1];
        console.log('➡️ Moving to next node:', nextSibling.id);
        selectNode(nextSibling.id, true);
        setShowContentOverlay(true);

        // Show toast notification
        showToastNotification('✨ Moving to next section');
      } else {
        // No next sibling - return to the nexus
        // Find the nexus by traversing up the tree
        let currentId: string | undefined = node.parentId;
        let foundNexus = null;

        while (currentId) {
          foundNexus = nexuses.find(n => n.id === currentId);
          if (foundNexus) break;

          const parentNode: { parentId?: string } | undefined = nodes[currentId];
          currentId = parentNode?.parentId;
        }

        if (foundNexus) {
          console.log('🏠 Returning to nexus:', foundNexus.id);
          selectNode(foundNexus.id, true);
          setShowContentOverlay(true);

          // 🎓 UNIVERSE COMPLETION - Generate study guide
          const {
            activeUniverseIds,
            universeLibrary,
            getCurrentRun,
            completeUniverseRun,
            saveStudyGuideWriteUp,
          } = useCanvasStore.getState();

          const activeUniverseId = activeUniverseIds[0];
          if (activeUniverseId && universeLibrary[activeUniverseId]) {
            const universe = universeLibrary[activeUniverseId];
            const currentRun = getCurrentRun(activeUniverseId);

            if (currentRun) {
              console.log('🎓 Completing universe run:', currentRun.id);

              // Complete the run
              completeUniverseRun(currentRun.id);

              // Build universe definition for generator
              const universeDefinition: UniverseDefinition = {
                id: activeUniverseId,
                title: universe.nexuses[0]?.title || 'Universe',
                nexuses: universe.nexuses.map(n => ({
                  id: n.id,
                  title: n.title,
                  content: n.content,
                })),
                nodes: universe.nodes,
              };

              // Get the completed run (with metrics) from updated store state
              const updatedUniverse = useCanvasStore.getState().universeLibrary[activeUniverseId];
              const completedRun = updatedUniverse?.runs?.find(r => r.id === currentRun.id);

              if (completedRun) {
                // Generate study guide
                const studyGuide = generateUniverseStudyGuide(completedRun, universeDefinition);

                // Save to store
                saveStudyGuideWriteUp(studyGuide);

                console.log('🎓 Study guide generated:', studyGuide.id);

                // Show completion modal
                setCompletedStudyGuide(studyGuide);
                setShowCompletionModal(true);
              }
            } else {
              // No run was started, just show completion toast
              showToastNotification('🎉 All sections complete! Returned to nexus');
            }
          } else {
            showToastNotification('🎉 All sections complete! Returned to nexus');
          }
        } else {
          // Fallback: close modal if no nexus found
          selectNode(selectedId, false);
        }
      }
    } else {
      // Fallback: close modal if no parent
      selectNode(selectedId, false);
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
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`fixed z-[2001] transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '1400px',
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
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-cyan-500/30 flex items-start justify-between flex-shrink-0">
              <div className="flex-1">
                <h2 className={`text-2xl font-bold mb-2 ${(node?.isSynthesis) ? 'text-cyan-300' : isConnectionNode ? 'text-yellow-300' : 'text-cyan-400'}`}>
                  {displayNexus?.title || selectedItem.title || (selectedItem.content?.substring(0, 50) + (selectedItem.content?.length > 50 ? '...' : ''))}
                </h2>
                <div className="flex items-center gap-4">
                  {/* 🎓 EVOLVING NEXUS - Show Application Lab badge and toggle */}
                  {isApplicationLabNexus && (
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 bg-gradient-to-r from-yellow-600/20 to-cyan-500/20 border border-yellow-400/50 rounded-full text-xs font-semibold text-yellow-200 flex items-center gap-1.5">
                        🎓 Application Lab
                      </div>
                      <button
                        onClick={() => setShowOriginalContent(!showOriginalContent)}
                        className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-500/50 rounded-lg text-xs text-slate-300 hover:text-white transition-all"
                      >
                        {showOriginalContent ? '← Back to Lab' : 'View Original'}
                      </button>
                    </div>
                  )}

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

              {/* Application Essay Button - For nexuses with application essays */}
              {nexus?.applicationEssay && (
                <div className="flex flex-col items-center mx-6">
                  <button
                    onClick={() => setShowEssaySection(true)}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all font-bold flex items-center gap-2"
                  >
                    📝 Application Essay
                  </button>
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

            {/* Video Player (if node has video) */}
            {node?.videoUrl && (
              <div className="px-6 pt-6 pb-3 flex-shrink-0">
                <VideoPlayer
                  videoUrl={loadedVideoUrl || node.videoUrl}
                  startTime={node.videoStart}
                  endTime={node.videoEnd}
                />
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 p-6">
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
                <>
                  {/* 🎓 APPLICATION LAB VIEW - Show structured lab content */}
                  {isApplicationLabNexus && !showOriginalContent && nexus.applicationLabConfig ? (
                    <div className="space-y-6">
                      {/* Doctrine Summary */}
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-300 mb-3">📚 What You've Learned</h3>
                        <div className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                          {nexus.applicationLabConfig.doctrineSummary}
                        </div>
                      </div>

                      {/* Scenarios */}
                      {nexus.applicationLabConfig.scenarios && nexus.applicationLabConfig.scenarios.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-cyan-300 mb-3">🎯 Application Scenarios</h3>
                          <div className="space-y-4">
                            {nexus.applicationLabConfig.scenarios.map((scenario, index) => (
                              <div key={scenario.id} className="p-4 bg-slate-800/50 border border-cyan-500/30 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 text-sm font-semibold">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-gray-200 mb-2">{scenario.prompt}</div>
                                    {scenario.guidance && (
                                      <div className="text-sm text-cyan-300/70 italic mt-2 pl-3 border-l-2 border-cyan-500/30">
                                        💡 {scenario.guidance}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Final Essay Prompt */}
                      {nexus.applicationLabConfig.finalEssayPrompt && (
                        <div>
                          <h3 className="text-lg font-semibold text-yellow-300 mb-3">✍️ Capstone Application Essay</h3>
                          <div className="p-4 bg-gradient-to-r from-yellow-900/20 to-yellow-800/20 border border-yellow-400/40 rounded-lg">
                            <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                              {nexus.applicationLabConfig.finalEssayPrompt}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rubric (Optional) */}
                      {nexus.applicationLabConfig.rubric && (
                        <div>
                          <h3 className="text-lg font-semibold text-purple-300 mb-3">📊 Grading Rubric</h3>
                          <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                            <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                              {nexus.applicationLabConfig.rubric}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap"
                      onMouseUp={handleTextSelection}
                    >
                      {displayContent || 'No content available.'}
                    </div>
                  )}
                </>
              )}

              {/* Old "Continue to Next Step" button removed - now handled in action buttons section */}

              {/* 🎉 PRACTICE COMPLETE BUTTON - Appears when viewing completed synthesis node */}
              {node &&
                node.nodeType === 'synthesis' &&
                node.content.includes('**Your Response:**') && // Check if completed
                (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => {
                        if (node.parentId) {
                          selectNode(node.parentId, true);
                        }
                      }}
                      className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg transition-all font-bold text-lg shadow-lg hover:shadow-xl flex items-center gap-3"
                    >
                      🎉 Practice Complete - Return to Doctrine
                    </button>
                  </div>
                )
              }

              {/* 🎓 L2 PRACTICE NODE ANSWER SECTION - Only show for incomplete nodes */}
              {node && ['intuition-example', 'imitate', 'application-scenario'].includes(node.nodeType || '') &&
                !node.content.includes('**Your Response:**') && ( // Only show if not yet answered
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-2 border-purple-500/30 rounded-lg">
                    <h3 className="text-lg font-semibold text-purple-300 mb-3">
                      {node.nodeType === 'intuition-example' && '💡 Share Your Thoughts'}
                      {node.nodeType === 'imitate' && '🎯 Your Answer'}
                      {node.nodeType === 'application-scenario' && '🌍 Your Analysis'}
                    </h3>

                    <textarea
                      value={practiceStepInput}
                      onChange={(e) => setPracticeStepInput(e.target.value)}
                      placeholder={
                        node.nodeType === 'intuition-example' ? 'What are your initial thoughts?' :
                          node.nodeType === 'imitate' ? 'Apply the reasoning pattern here...' :
                            'How would you analyze this scenario?'
                      }
                      rows={node.nodeType === 'application-scenario' ? 8 : 5}
                      className="w-full px-4 py-3 bg-slate-900 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none mb-3"
                    />

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (practiceStepInput.trim()) {
                            const stepType = node.nodeType === 'intuition-example' ? 'intuition' :
                              node.nodeType === 'imitate' ? 'imitate' : 'scenario';
                            handleGradePracticeStep(stepType, practiceStepInput, node.content);
                            setPracticeStepInput('');
                          }
                        }}
                        disabled={!practiceStepInput.trim() || isGradingPractice}
                        className="flex-1 px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                      >
                        {isGradingPractice ? '⏳ Getting Feedback...' : '🎓 Get AI Feedback'}
                      </button>
                      <button
                        onClick={() => {
                          const stepType = node.nodeType === 'intuition-example' ? 'intuition'
                            : node.nodeType === 'imitate' ? 'imitate'
                              : 'scenario';
                          handleSavePracticeStepOnly(stepType, practiceStepInput, node.content);
                        }}
                        disabled={!practiceStepInput.trim() || isGradingPractice}
                        className="px-6 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                      >
                        💾 Save Only
                      </button>
                    </div>

                    {practiceStepFeedback && (
                      <div className="mt-4 bg-purple-900/20 border border-purple-500/50 rounded-lg p-4">
                        <p className="text-sm font-semibold text-purple-300 mb-2">✨ AI Feedback:</p>
                        <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{practiceStepFeedback}</p>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* BOTTOM SECTION - Action Buttons */}
          <div className="border-t border-cyan-500/30 flex-shrink-0">
            {/* Socratic Question / Quiz Display */}
            {socraticQuestion && (
              <div className={`p-4 ${explorationMode === 'quiz'
                ? 'bg-gradient-to-r from-purple-900/30 to-purple-800/30 border-b border-purple-500/20'
                : 'bg-gradient-to-r from-cyan-900/30 to-purple-900/30 border-b border-cyan-500/20'
                }`}>
                {/* Header with progress indicator */}
                <div className="flex justify-between items-center mb-2">
                  <div className={`text-sm font-semibold ${explorationMode === 'quiz' ? 'text-purple-300' : 'text-cyan-300'
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
                  <div className={`mb-3 p-4 rounded-lg ${quizFeedback.includes('🎉') || quizFeedback.toLowerCase().includes('excellent work')
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

                    {/* Synthesis removed from L1 guided practice - only for application labs */}
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
                             focus:outline-none focus:border-${explorationMode === 'quiz' ? 'purple' : 'cyan'}-500/50 resize-none ${explorationMode === 'quiz' ? 'border-purple-500/20' : 'border-cyan-500/20'
                      } ${isLoadingAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                    rows={3}
                  />
                )}
                <div className="flex gap-2 mt-3">
                  {explorationMode === 'quiz' ? (
                    <>
                      {/* Show different buttons based on whether feedback exists */}
                      {quizFeedback ? (
                        // After feedback: Show "Another Question" and "Done" buttons
                        <>
                          <button
                            onClick={handleAskAnotherQuestion}
                            disabled={isLoadingAI}
                            className="flex-1 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50
                                     text-cyan-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingAI ? '🔄 Loading...' : '📝 Another Question'}
                          </button>
                          <button
                            onClick={handleEndQuiz}
                            disabled={isLoadingAI}
                            className="flex-1 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50
                                     text-purple-300 rounded-lg transition-all disabled:opacity-50 font-medium"
                          >
                            Done
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
                            Close
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
                {/* Check if this is a practice L2 node */}
                {node && node.parentId && (node.nodeType === 'intuition-example' || node.nodeType === 'imitate') ? (
                  // PRACTICE L2 NODE LAYOUT: Simplified buttons + prominent Continue button
                  <>
                    {/* Row 1: Just basic actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setActionMode('user-reply')}
                        disabled={actionMode === 'user-reply'}
                        className={`flex-1 px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-medium
                          ${actionMode === 'user-reply'
                            ? 'bg-purple-600/40 border-2 border-purple-400 text-purple-200'
                            : 'bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300'}`}
                      >
                        💬 Reply
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
                        onClick={handleDeleteClick}
                        className="px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 rounded-lg transition-all flex items-center justify-center gap-2 font-medium"
                        title="Delete this node"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Row 2: Continue to Next Step button (prominent) */}
                    {(() => {
                      const parentNode = nodes[node.parentId];
                      if (!parentNode) return null;

                      const parentBundle = buildDoctrinePracticeBundle(parentNode, nodes);
                      if (!parentBundle) return null;

                      const parentSteps = getAvailablePracticeSteps(parentBundle);

                      // Determine next step based on node type
                      let nextStep: PracticeStepId | null = null;

                      if (node.nodeType === 'intuition-example') {
                        const currentIndex = parentSteps.indexOf('intuition');
                        if (currentIndex >= 0 && currentIndex < parentSteps.length - 1) {
                          nextStep = parentSteps[currentIndex + 1];
                        }
                      } else if (node.nodeType === 'imitate') {
                        const currentIndex = parentSteps.indexOf('imitate');
                        if (currentIndex >= 0 && currentIndex < parentSteps.length - 1) {
                          nextStep = parentSteps[currentIndex + 1];
                        }
                      }

                      if (!nextStep) return null;

                      const nextStepLabel =
                        nextStep === 'intuition' ? '💡 Intuition' :
                          nextStep === 'model' ? '📐 Model' :
                            nextStep === 'imitate' ? '🎯 Imitate' :
                              nextStep === 'quiz' ? '📝 Quiz' :
                                'Next Step';

                      return (
                        <button
                          onClick={() => {
                            selectNode(node.parentId!, true);
                            setTimeout(() => {
                              setShowGuidedPractice(true);
                              setActivePracticeStep(nextStep!);
                            }, 300);
                          }}
                          className="w-full px-6 py-4 bg-gradient-to-r from-yellow-600/20 to-amber-600/20
                                   hover:from-yellow-600/30 hover:to-amber-600/30
                                   border-2 border-yellow-500/50 text-yellow-300 rounded-lg transition-all
                                   flex items-center justify-center gap-3 font-semibold text-lg
                                   shadow-lg shadow-yellow-500/10"
                        >
                          Continue to {nextStepLabel}
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </button>
                      );
                    })()}
                  </>
                ) : (
                  // STANDARD NODE LAYOUT: Full button set
                  <>
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
                        onClick={() => {
                          if (hasGuidedPractice) {
                            setShowGuidedPractice(true);
                            if (!activePracticeStep || !availablePracticeSteps.includes(activePracticeStep)) {
                              setActivePracticeStep(availablePracticeSteps[0]);
                            }
                          } else {
                            setShowQuizFormatModal(true);
                          }
                        }}
                        disabled={isLoadingAI}
                        className="flex-1 px-4 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 text-yellow-300 rounded-lg transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                      >
                        {hasGuidedPractice ? (
                          activePracticeStep && availablePracticeSteps.includes(activePracticeStep) ? (
                            activePracticeStep === 'intuition' ? '💡 Intuition' :
                              activePracticeStep === 'model' ? '📐 Model' :
                                activePracticeStep === 'imitate' ? '🎯 Imitate' :
                                  activePracticeStep === 'quiz' ? '📝 Quiz' :
                                    '🎓 Guided Practice'
                          ) : '🎓 Guided Practice'
                        ) : '📝 Quiz Me'}
                      </button>

                      {node && !nexus && (
                        <button
                          onClick={handleDeleteClick}
                          className="px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 rounded-lg transition-all flex items-center justify-center gap-2 font-medium"
                          title="Delete this node (Delete key)"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Third row: Explore Entire Universe button (only for nexuses) */}
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

                {/* 🎓 PRACTICE RUN CONTROLS - Only for nexuses with universe data */}
                {nexus && (() => {
                  const { activeUniverseIds, universeLibrary, getCurrentRun, getUniverseWriteUps, resetUniverseForPractice } = useCanvasStore.getState();
                  const activeUniverseId = activeUniverseIds[0];
                  if (!activeUniverseId || !universeLibrary[activeUniverseId]) return null;

                  const universe = universeLibrary[activeUniverseId];
                  const currentRun = getCurrentRun(activeUniverseId);
                  const completedRuns = universe.runs?.filter(r => r.status === 'completed') || [];
                  const writeUps = getUniverseWriteUps(activeUniverseId);
                  const totalRuns = universe.runs?.length || 0;

                  return (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      {/* Current Run Indicator */}
                      {currentRun && (
                        <div className="mb-3 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-400 text-sm font-medium">
                              Practice Run #{totalRuns}
                            </span>
                            <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded">
                              In Progress
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Completed Runs Summary */}
                      {completedRuns.length > 0 && !currentRun && (
                        <div className="mb-3 p-3 bg-slate-800/50 border border-slate-600/30 rounded-lg">
                          <div className="text-sm text-gray-400">
                            {completedRuns.length} completed run{completedRuns.length !== 1 ? 's' : ''}
                            {writeUps.length > 0 && (
                              <span className="ml-2 text-emerald-400">
                                • {writeUps.length} study guide{writeUps.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Practice Again Button */}
                      {(completedRuns.length > 0 || !currentRun) && (
                        <button
                          onClick={() => {
                            const newRunId = resetUniverseForPractice(activeUniverseId);
                            if (newRunId) {
                              showToastNotification(`🎓 Started new practice run #${(universe.runs?.length || 0) + 1}`);
                            }
                          }}
                          className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/20
                                   hover:from-emerald-600/30 hover:to-teal-600/30
                                   border-2 border-emerald-500/50 text-emerald-300 rounded-lg transition-all
                                   flex items-center justify-center gap-2 font-medium
                                   shadow-lg shadow-emerald-500/10"
                        >
                          {currentRun ? '🔄 Restart Practice' : '🎓 Start New Practice Run'}
                        </button>
                      )}

                      {/* View Past Study Guides */}
                      {writeUps.length > 0 && (
                        <button
                          onClick={() => {
                            // Show most recent study guide
                            const latestWriteUp = writeUps[writeUps.length - 1];
                            setCompletedStudyGuide(latestWriteUp);
                            setShowStudyGuideViewer(true);
                          }}
                          className="w-full mt-2 px-4 py-2 bg-slate-800/50
                                   hover:bg-slate-700/50
                                   border border-slate-600/50 text-gray-400 rounded-lg transition-all
                                   flex items-center justify-center gap-2 text-sm"
                        >
                          📚 View Study Guides ({writeUps.length})
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Keyboard Navigation Hint */}
                {node && !showDeleteConfirm && (
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
                    ↑↓ parent/child • ←→ siblings • Delete to remove • Esc to close
                  </div>
                )}

                {/* Delete Confirmation Dialog */}
                {showDeleteConfirm && node && (
                  <div className="mt-6 p-6 bg-slate-950/80 border-2 border-red-500/50 rounded-lg">
                    <div className="flex items-center gap-2 text-xl font-bold text-red-400 mb-4">
                      ⚠️ Delete this node?
                    </div>

                    {/* Node content preview */}
                    <div className="p-3 bg-purple-900/20 border-l-4 border-purple-500 rounded text-sm text-gray-300 mb-4 max-h-24 overflow-auto">
                      "{node.content.slice(0, 150)}{node.content.length > 150 ? '...' : ''}"
                    </div>

                    {/* Children warning */}
                    {deleteInfo.childrenCount > 0 && (
                      <div className="p-3 bg-red-900/20 border-l-4 border-red-500 rounded text-sm mb-4">
                        <strong className="text-red-400">This will also delete:</strong>
                        <ul className="mt-2 ml-5 list-disc text-gray-300">
                          <li>{deleteInfo.childrenCount} child node{deleteInfo.childrenCount !== 1 ? 's' : ''}</li>
                          <li>All their connections</li>
                        </ul>
                      </div>
                    )}

                    {/* Warning */}
                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-sm text-red-400 font-bold text-center mb-4">
                      ⚠️ This cannot be undone
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmDelete}
                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
                      >
                        Delete Forever
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quiz Format Selection Modal */}
      {showQuizFormatModal && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2004]"
            onClick={() => setShowQuizFormatModal(false)}
          />
          <div className="fixed z-[2005] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] max-w-90vw">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-purple-500/50 rounded-2xl shadow-2xl p-8">
              <h2 className="text-2xl font-bold text-purple-300 mb-6">Choose Quiz Format</h2>

              <div className="space-y-4 mb-6">
                {/* Short Answer Option */}
                <button
                  onClick={() => {
                    setShowQuizFormatModal(false);
                    handleExploreTogether('quiz');
                  }}
                  className="w-full p-6 bg-purple-900/20 hover:bg-purple-900/40 border-2 border-purple-500/50 hover:border-purple-400 rounded-xl transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">📝</div>
                    <div className="flex-1">
                      <div className="text-xl font-bold text-purple-200 mb-1">Short Answer</div>
                      <div className="text-sm text-gray-400">Write detailed responses</div>
                    </div>
                  </div>
                </button>

                {/* Multiple Choice Option */}
                <button
                  onClick={handleStartMultipleChoice}
                  className="w-full p-6 bg-cyan-900/20 hover:bg-cyan-900/40 border-2 border-cyan-500/50 hover:border-cyan-400 rounded-xl transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">✓</div>
                    <div className="flex-1">
                      <div className="text-xl font-bold text-cyan-200 mb-1">Multiple Choice</div>
                      <div className="text-sm text-gray-400">Select from 4 options</div>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowQuizFormatModal(false)}
                className="w-full px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50 text-gray-300 rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Multiple Choice Quiz Display */}
      {explorationMode === 'quiz-mc' && mcQuestions.length > 0 && currentMcQuestion < mcQuestions.length && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2002]"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="fixed z-[2003] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[700px] max-w-90vw max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/50 rounded-2xl shadow-2xl p-8">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold text-cyan-300">
                  Question {currentMcQuestion + 1} of {mcQuestions.length}
                </div>
                <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${((currentMcQuestion + 1) / mcQuestions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="mb-6">
                <h3 className="text-xl text-gray-200 leading-relaxed">{mcQuestions[currentMcQuestion].question}</h3>
              </div>

              {/* Options */}
              <div className="space-y-3 mb-6">
                {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                  const isSelected = selectedMcAnswer === letter;
                  const isCorrect = letter === mcQuestions[currentMcQuestion].correctAnswer;
                  const showResult = mcAnswered;

                  let bgClass = 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-600';
                  let textClass = 'text-gray-200';

                  if (showResult) {
                    if (isCorrect) {
                      bgClass = 'bg-green-900/40 border-green-500';
                      textClass = 'text-green-200';
                    } else if (isSelected && !isCorrect) {
                      bgClass = 'bg-red-900/40 border-red-500';
                      textClass = 'text-red-200';
                    }
                  } else if (isSelected) {
                    bgClass = 'bg-cyan-900/40 border-cyan-500';
                    textClass = 'text-cyan-200';
                  }

                  return (
                    <button
                      key={letter}
                      onClick={() => !mcAnswered && setSelectedMcAnswer(letter)}
                      disabled={mcAnswered}
                      className={`w-full p-4 border-2 rounded-lg transition-all text-left ${bgClass} ${textClass} ${!mcAnswered && 'cursor-pointer'} ${mcAnswered && 'cursor-default'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="font-bold text-lg mt-0.5">{letter})</div>
                        <div className="flex-1">{mcQuestions[currentMcQuestion].options[letter]}</div>
                        {showResult && isCorrect && <div className="text-xl">✓</div>}
                        {showResult && isSelected && !isCorrect && <div className="text-xl">✗</div>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Feedback/Explanation */}
              {mcAnswered && (
                <div className={`mb-6 p-4 rounded-lg border-2 ${mcResults[mcResults.length - 1]?.isCorrect
                  ? 'bg-green-900/20 border-green-500/50'
                  : 'bg-red-900/20 border-red-500/50'
                  }`}>
                  <div className={`font-bold mb-2 ${mcResults[mcResults.length - 1]?.isCorrect ? 'text-green-300' : 'text-red-300'
                    }`}>
                    {mcResults[mcResults.length - 1]?.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                  </div>
                  {!mcResults[mcResults.length - 1]?.isCorrect && (
                    <div className="text-sm text-gray-300 mb-2">
                      You selected: {selectedMcAnswer}) {mcQuestions[currentMcQuestion].options[selectedMcAnswer as keyof typeof mcQuestions[0]['options']]}
                      <br />
                      Correct answer: {mcQuestions[currentMcQuestion].correctAnswer}) {mcQuestions[currentMcQuestion].options[mcQuestions[currentMcQuestion].correctAnswer as keyof typeof mcQuestions[0]['options']]}
                    </div>
                  )}
                  <div className="text-sm text-gray-300 mt-2 border-t border-gray-600 pt-2">
                    <strong>Explanation:</strong> {mcQuestions[currentMcQuestion].explanation}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {!mcAnswered ? (
                  <>
                    <button
                      onClick={handleSubmitMcAnswer}
                      disabled={!selectedMcAnswer}
                      className="flex-1 px-6 py-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={handleEndMcQuiz}
                      className="px-6 py-3 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50 text-gray-300 rounded-lg transition-all"
                    >
                      End Quiz
                    </button>
                  </>
                ) : (
                  <>
                    {currentMcQuestion < mcQuestions.length - 1 ? (
                      <button
                        onClick={handleNextMcQuestion}
                        className="flex-1 px-6 py-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 rounded-lg transition-all font-medium"
                      >
                        Next Question →
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentMcQuestion(mcQuestions.length)}
                        className="flex-1 px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 rounded-lg transition-all font-medium"
                      >
                        View Results →
                      </button>
                    )}
                    <button
                      onClick={handleEndMcQuiz}
                      className="px-6 py-3 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50 text-gray-300 rounded-lg transition-all"
                    >
                      End Quiz
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Final Score Display */}
      {explorationMode === 'quiz-mc' && currentMcQuestion >= mcQuestions.length && mcResults.length > 0 && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2002]"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="fixed z-[2003] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[700px] max-w-90vw">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-purple-500/50 rounded-2xl shadow-2xl p-8">
              <h2 className="text-3xl font-bold text-purple-300 mb-2 text-center">Quiz Complete!</h2>

              {/* Score */}
              <div className="text-center mb-6">
                <div className="text-6xl font-bold text-cyan-300 mb-2">
                  {mcResults.filter(r => r.isCorrect).length} / {mcResults.length}
                </div>
                <div className="text-xl text-gray-400">
                  ({Math.round((mcResults.filter(r => r.isCorrect).length / mcResults.length) * 100)}%)
                </div>
              </div>

              {/* Results List */}
              <div className="space-y-2 mb-6 max-h-80 overflow-y-auto">
                {mcResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${result.isCorrect
                      ? 'bg-green-900/20 border-green-500/30'
                      : 'bg-red-900/20 border-red-500/30'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl mt-0.5">
                        {result.isCorrect ? '✓' : '✗'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-gray-200 mb-1">
                          <strong>Q{idx + 1}:</strong> {result.question}
                        </div>
                        {!result.isCorrect && (
                          <div className="text-xs text-gray-400">
                            Your answer: {result.selectedAnswer} • Correct: {result.correctAnswer}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCurrentMcQuestion(0);
                    setSelectedMcAnswer(null);
                    setMcAnswered(false);
                    setMcResults([]);
                  }}
                  className="flex-1 px-6 py-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 rounded-lg transition-all font-medium"
                >
                  Take Again
                </button>
                <button
                  onClick={handleEndMcQuiz}
                  className="flex-1 px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 rounded-lg transition-all font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 🎓 GUIDED PRACTICE PANEL */}
      {showGuidedPractice && practiceBundle && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2002]"
            onClick={() => setShowGuidedPractice(false)}
          />
          <div className="fixed z-[2003] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 border-2 border-purple-500/50 rounded-2xl shadow-2xl p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-purple-300">🎓 Guided Practice</h2>
                <button
                  onClick={() => setShowGuidedPractice(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {/* Step Navigation */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                {availablePracticeSteps.map((stepId, idx) => {
                  const stepLabels: Record<PracticeStepId, string> = {
                    intuition: '💡 Intuition',
                    model: '📐 Model',
                    imitate: '🎯 Imitate',
                    quiz: '📝 Quiz',
                    synthesis: '🔗 Synthesis',
                    scenario: '🌍 Scenario', // Legacy support
                  };

                  const isActive = activePracticeStep === stepId;
                  const stepIndex = availablePracticeSteps.indexOf(activePracticeStep);
                  const isPast = idx < stepIndex;

                  return (
                    <button
                      key={stepId}
                      onClick={() => setActivePracticeStep(stepId)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all font-medium text-sm
                        ${isActive
                          ? 'bg-purple-600 text-white border-2 border-purple-400'
                          : isPast
                            ? 'bg-green-900/30 text-green-300 border border-green-500/50'
                            : 'bg-slate-700/50 text-gray-300 border border-slate-600 hover:bg-slate-600/50'
                        }`}
                    >
                      {stepLabels[stepId]}
                    </button>
                  );
                })}
              </div>

              {/* Step Content */}
              <div className="min-h-[300px] mb-6">
                {/* Intuition Step - always available, uses doctrine content if no specific intuition node */}
                {activePracticeStep === 'intuition' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-cyan-300">💡 Build Your Intuition</h3>

                    {/* Show intuition example content (or doctrine content as fallback) */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-cyan-500/30">
                      <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {practiceBundle.intuitionExampleNode?.content || practiceBundle.conceptNode?.content || ''}
                      </p>
                    </div>

                    {/* Generate question when this step becomes active */}
                    {(() => {
                      const contentToUse = practiceBundle.intuitionExampleNode?.content || practiceBundle.conceptNode?.content || '';
                      const nodeId = practiceBundle.conceptNode?.id || '';
                      if (contentToUse && nodeId && !isLoadingIntuitionQuestion && intuitionQuestionNodeId !== nodeId) {
                        // Trigger question generation (using setTimeout to avoid render loop)
                        setTimeout(() => generateIntuitionQuestion(contentToUse, nodeId), 0);
                      }
                      return null;
                    })()}

                    {/* Loading state */}
                    {isLoadingIntuitionQuestion && (
                      <div className="flex items-center justify-center py-6">
                        <div className="text-cyan-300 flex items-center gap-2">
                          <span className="animate-spin">⏳</span>
                          <span>Generating your reflection question...</span>
                        </div>
                      </div>
                    )}

                    {/* Question with options */}
                    {intuitionQuestion && !isLoadingIntuitionQuestion && (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-cyan-900/30 to-purple-900/30 rounded-lg p-4 border border-cyan-500/50">
                          <p className="text-lg font-medium text-white leading-relaxed">
                            {intuitionQuestion.question}
                          </p>
                        </div>

                        {/* Clickable options */}
                        <div className="grid grid-cols-1 gap-2">
                          {intuitionQuestion.options.map((option, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedIntuitionOption(option)}
                              className={`text-left px-4 py-3 rounded-lg transition-all ${selectedIntuitionOption === option
                                ? 'bg-cyan-600/40 border-2 border-cyan-400 text-white'
                                : 'bg-slate-700/50 border border-slate-600 text-gray-300 hover:bg-slate-600/50 hover:border-slate-500'
                                }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>

                        {/* Free-form elaboration */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            {selectedIntuitionOption
                              ? "Elaborate on your choice - what experiences or reasoning led you there?"
                              : "Or share your own perspective..."}
                          </label>
                          <textarea
                            value={practiceStepInput}
                            onChange={(e) => setPracticeStepInput(e.target.value)}
                            placeholder={selectedIntuitionOption
                              ? "Explain your thinking, connect to personal experience, or add nuance..."
                              : "Share your own take on this doctrine..."}
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          const contentToUse = practiceBundle.intuitionExampleNode?.content || practiceBundle.conceptNode?.content || '';
                          const fullResponse = selectedIntuitionOption
                            ? `Selected: "${selectedIntuitionOption}"\n\nElaboration: ${practiceStepInput}`
                            : practiceStepInput;
                          if ((selectedIntuitionOption || practiceStepInput.trim()) && contentToUse) {
                            handleGradePracticeStep('intuition', fullResponse, contentToUse);
                            setPracticeStepInput('');
                            setSelectedIntuitionOption(null);
                          }
                        }}
                        disabled={(!selectedIntuitionOption && !practiceStepInput.trim()) || isGradingPractice}
                        className="flex-1 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                      >
                        {isGradingPractice ? '⏳ Getting Response...' : '💬 Continue'}
                      </button>
                      <button
                        onClick={() => {
                          const fullResponse = selectedIntuitionOption
                            ? `Selected: "${selectedIntuitionOption}"\n\nElaboration: ${practiceStepInput}`
                            : practiceStepInput;
                          handleSavePracticeStepOnly('intuition', fullResponse, practiceBundle.intuitionExampleNode?.content || practiceBundle.conceptNode?.content || '');
                        }}
                        disabled={(!selectedIntuitionOption && !practiceStepInput.trim()) || isGradingPractice}
                        className="px-6 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                      >
                        💾 Save Only
                      </button>
                    </div>

                    {practiceStepFeedback && (
                      <div className="bg-cyan-900/20 border border-cyan-500/50 rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-cyan-300 mb-2">✨ AI Insight:</p>
                          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{practiceStepFeedback}</p>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-cyan-500/30">
                          {practiceBundle.modelAnswerNode && (
                            <button
                              onClick={() => {
                                setPracticeStepFeedback('');
                                setPracticeStepInput('');
                                setActivePracticeStep('model');
                              }}
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2"
                            >
                              Continue to Model Step
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPracticeStepFeedback('');
                              setPracticeStepInput('');
                            }}
                            className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50 text-gray-300 rounded-lg transition-all"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Model Step */}
                {activePracticeStep === 'model' && practiceBundle.modelAnswerNode && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-300">📐 Model Reasoning Pattern</h3>
                    <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 rounded-lg p-4 border border-blue-500/30">
                      <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {practiceBundle.modelAnswerNode.content}
                      </p>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                      <p className="text-sm text-blue-200">
                        💡 <strong>Tip:</strong> Study this pattern carefully - you'll apply it in the next step.
                      </p>
                    </div>
                  </div>
                )}

                {/* Imitate Step */}
                {activePracticeStep === 'imitate' && practiceBundle.imitateNode && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-yellow-300">🎯 Imitate the Pattern</h3>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-yellow-500/30">
                      <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {practiceBundle.imitateNode.content}
                      </p>
                    </div>

                    {/* Show model answer reference */}
                    {practiceBundle.modelAnswerNode && (
                      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                        <p className="text-xs text-blue-300 font-semibold mb-1">📐 Reference Pattern:</p>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {practiceBundle.modelAnswerNode.content}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Your attempt:
                      </label>
                      <textarea
                        value={practiceStepInput}
                        onChange={(e) => setPracticeStepInput(e.target.value)}
                        placeholder="Apply the reasoning pattern you just learned..."
                        rows={6}
                        className="w-full px-4 py-3 bg-slate-900 border border-yellow-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 resize-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (practiceStepInput.trim() && practiceBundle.modelAnswerNode) {
                            handleGradePracticeStep('imitate', practiceStepInput, practiceBundle.modelAnswerNode.content);
                            setPracticeStepInput('');
                          }
                        }}
                        disabled={!practiceStepInput.trim() || isGradingPractice}
                        className="flex-1 px-6 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                      >
                        {isGradingPractice ? '⏳ Getting Feedback...' : '🎓 Get AI Feedback'}
                      </button>
                      <button
                        onClick={() => handleSavePracticeStepOnly('imitate', practiceStepInput, practiceBundle.modelAnswerNode!.content)}
                        disabled={!practiceStepInput.trim() || isGradingPractice}
                        className="px-6 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                      >
                        💾 Save Only
                      </button>
                    </div>

                    {practiceStepFeedback && (
                      <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-green-300 mb-2">✨ AI Feedback:</p>
                          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{practiceStepFeedback}</p>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-green-500/30">
                          {(practiceBundle.quizMcNode || practiceBundle.quizShortAnswerNode) && (
                            <button
                              onClick={() => {
                                setPracticeStepFeedback('');
                                setPracticeStepInput('');
                                setActivePracticeStep('quiz');
                              }}
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2"
                            >
                              Continue to Quiz
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPracticeStepFeedback('');
                              setPracticeStepInput('');
                            }}
                            className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50 text-gray-300 rounded-lg transition-all"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quiz Step */}
                {activePracticeStep === 'quiz' && (practiceBundle.quizMcNode || practiceBundle.quizShortAnswerNode) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-purple-300">📝 Test Your Understanding</h3>
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-sm text-purple-200">
                        Click the button below to take the quiz for this section. You'll return here when complete.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        // Close guided practice panel before showing quiz format modal
                        setShowGuidedPractice(false);
                        // Brief delay to let guided practice close smoothly
                        setTimeout(() => {
                          setShowQuizFormatModal(true);
                        }, 200);
                      }}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all font-medium"
                    >
                      Start Quiz
                    </button>
                  </div>
                )}

                {/* Synthesis Step (Final Application Scenario) */}
                {activePracticeStep === 'synthesis' && practiceBundle.synthesisNode && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-cyan-300">🔗 Synthesis & Application</h3>
                    <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 rounded-lg p-4 border border-cyan-500/30">
                      <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {practiceBundle.synthesisNode.content}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Your synthesis and application:
                      </label>
                      <textarea
                        value={practiceStepInput}
                        onChange={(e) => setPracticeStepInput(e.target.value)}
                        placeholder="Apply everything you've learned to analyze this scenario..."
                        rows={8}
                        className="w-full px-4 py-3 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (practiceStepInput.trim()) {
                            handleGradePracticeStep('scenario', practiceStepInput, practiceBundle.synthesisNode!.content);
                          }
                        }}
                        disabled={!practiceStepInput.trim() || isGradingPractice}
                        className="flex-1 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                      >
                        {isGradingPractice ? '⏳ Getting Feedback...' : '🎓 Complete & Get Feedback'}
                      </button>
                      <button
                        onClick={async () => {
                          if (practiceStepInput.trim()) {
                            const combinedContent = `${practiceBundle.synthesisNode!.content}\n\n---\n\n**Your Response:**\n${practiceStepInput}`;
                            const newNodeId = addNode(combinedContent, node!.id, undefined, 'synthesis');
                            setPracticeStepInput('');

                            // Brief pause to let the cyan icosahedron materialize
                            await new Promise(resolve => setTimeout(resolve, 600));

                            // Animate camera to the new synthesis node
                            selectNode(newNodeId, true);

                            // Show success message
                            setToastMessage('🎉 Synthesis complete! All practice steps finished.');
                            setShowToast(true);
                            setTimeout(() => {
                              setShowToast(false);
                              setShowGuidedPractice(false);
                            }, 3000);
                          }
                        }}
                        disabled={!practiceStepInput.trim() || isGradingPractice}
                        className="px-6 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                      >
                        💾 Save Only
                      </button>
                    </div>

                    {practiceStepFeedback && (
                      <div className="bg-cyan-900/20 border border-cyan-500/50 rounded-lg p-4">
                        <p className="text-sm font-semibold text-cyan-300 mb-2">✨ AI Feedback:</p>
                        <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{practiceStepFeedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4 border-t border-purple-500/30">
                <button
                  onClick={() => {
                    const currentIdx = availablePracticeSteps.indexOf(activePracticeStep);
                    if (currentIdx > 0) {
                      setActivePracticeStep(availablePracticeSteps[currentIdx - 1]);
                      setPracticeStepInput('');
                      setPracticeStepFeedback('');
                    }
                  }}
                  disabled={availablePracticeSteps.indexOf(activePracticeStep) === 0}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-600 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    const currentIdx = availablePracticeSteps.indexOf(activePracticeStep);
                    if (currentIdx < availablePracticeSteps.length - 1) {
                      setActivePracticeStep(availablePracticeSteps[currentIdx + 1]);
                      setPracticeStepInput('');
                      setPracticeStepFeedback('');
                    }
                  }}
                  disabled={availablePracticeSteps.indexOf(activePracticeStep) === availablePracticeSteps.length - 1}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-gray-600 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 🎓 COMPLETION MODAL - Universe Completion Summary */}
      {showCompletionModal && completedStudyGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002,
          }}
          onClick={() => setShowCompletionModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
              border: '2px solid #10b981',
              boxShadow: '0 20px 60px rgba(16, 185, 129, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎓</div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', margin: '0 0 8px 0' }}>
                Universe Complete!
              </h2>
              <p style={{ color: '#94a3b8', margin: 0 }}>
                {completedStudyGuide.universeTitle}
              </p>
            </div>

            {/* Quiz Score Summary */}
            {completedStudyGuide.quizSnapshot && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '24px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8' }}>Quiz Score</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                    {completedStudyGuide.quizSnapshot.correctAnswers}/{completedStudyGuide.quizSnapshot.totalQuestions}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Accuracy</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                    {completedStudyGuide.quizSnapshot.accuracyPercentage}%
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowCompletionModal(false);
                  setShowStudyGuideViewer(true);
                }}
                style={{
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                View Study Guide
              </button>

              <button
                onClick={() => setShowCompletionModal(false)}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎓 STUDY GUIDE VIEWER - Full Study Guide Content */}
      {showStudyGuideViewer && completedStudyGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10003,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#0f172a',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>
                Study Guide
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
                {completedStudyGuide.universeTitle}
              </p>
            </div>
            <button
              onClick={() => setShowStudyGuideViewer(false)}
              style={{
                padding: '8px 16px',
                background: '#334155',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '24px',
              maxWidth: '900px',
              margin: '0 auto',
              width: '100%',
            }}
          >
            <div
              style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '32px',
                color: '#e2e8f0',
                fontSize: '15px',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
              }}
            >
              {completedStudyGuide.content}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#10b981',
            color: '#FFFFFF',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 10001,
            fontSize: '16px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'slideInUp 0.3s ease-out',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Application Essay Section - Full Screen Overlay */}
      {showEssaySection && nexus?.applicationEssay && (
        <ApplicationEssaySection
          applicationEssay={nexus.applicationEssay}
          onClose={() => setShowEssaySection(false)}
        />
      )}
    </>
  );
}
