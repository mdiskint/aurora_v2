export type NodeType = 'user-reply' | 'ai-response' | 'socratic-question' | 'socratic-answer' | 'inspiration' | 'synthesis';

export interface Node {
  id: string;
  position: [number, number, number];
  title: string;
  content: string;
  quotedText?: string;
  parentId: string;
  children: string[];
  videoUrl?: string;
  audioUrl?: string;
  isAI?: boolean;
  connectionNodes?: string[];  // IDs of the nodes this connection bridges (2+)
  isConnectionNode?: boolean;  // Flag to identify connection nodes
  isSynthesis?: boolean;       // Flag to identify synthesis/insight nodes
  nodeType?: NodeType;         // Visual type for geometry and color
  semanticTitle?: string;      // AI-generated 5-10 word summary for navigation
  isAnchored?: boolean;        // Flag to mark this node as anchored for quick navigation
  anchoredAt?: number;         // Timestamp when node was anchored
  isLocked?: boolean;          // Flag to mark this node as locked (course mode)

  // Quiz progress tracking
  quizProgress?: {
    questionsAsked: string[];
    answersGiven: Array<{
      question: string;
      answer: string;
      wasCorrect: boolean;
    }>;
    lastQuizDate: number;
    completedCycles: number; // How many times they've gone through all aspects
  };
}