export type NodeType =
  | 'user-reply'
  | 'ai-response'
  | 'socratic-question'
  | 'socratic-answer'
  | 'inspiration'
  | 'synthesis'
  | 'doctrine'
  | 'intuition-example'
  | 'model-answer'
  | 'imitate'
  | 'quiz-mc'
  | 'quiz-short-answer'
  | 'application-scenario';

export interface MCQ {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: string;
  explanation: string;
}

export interface ShortAnswer {
  question: string;
  sampleAnswer: string;
}

export interface ApplicationEssay {
  question: string;
  rubric: string;
}

export interface Node {
  id: string;
  position: [number, number, number];
  title: string;
  content: string;
  quotedText?: string;
  parentId: string;
  children: string[];
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
  isCompleted?: boolean;       // Flag to mark this node as completed (unlocks next node)

  // Video playback
  videoUrl?: string | null;    // YouTube or Vimeo URL for embedded video
  videoStart?: number | null;  // Start time in seconds
  videoEnd?: number | null;    // End time in seconds

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

  // Course questions (for course builder)
  mcqQuestions?: MCQ[];
  shortAnswerQuestions?: ShortAnswer[];

  // Guided Practice metadata (for doctrine nodes)
  practiceSteps?: Array<{
    content: string;
    nodeType: NodeType;
    options?: string[];
    correctOption?: string;
    explanation?: string;
  }>;
}