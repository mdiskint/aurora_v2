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

// ============================================
// UNIVERSE RUN & STUDY GUIDE TYPES
// ============================================

export type UniverseRunStatus = 'in_progress' | 'completed';

// Individual learning artifact captured during a run
export interface IntuitionResponse {
  nodeId: string;
  doctrineTitle: string;
  question: string;
  selectedOption?: string;
  elaboration: string;
  aiFeedback: string;
  timestamp: number;
}

export interface ImitationAttempt {
  nodeId: string;
  doctrineTitle: string;
  prompt: string;
  userAnswer: string;
  aiFeedback: string;
  timestamp: number;
}

export interface QuizResult {
  nodeId: string;
  doctrineTitle: string;
  questionType: 'mcq' | 'short-answer';
  question: string;
  userAnswer: string;
  correctAnswer?: string;
  wasCorrect: boolean;
  explanation: string;
  timestamp: number;
}

export interface SynthesisAnalysis {
  nodeId: string;
  doctrineTitle: string;
  scenario: string;
  userAnalysis: string;
  aiFeedback?: string;
  timestamp: number;
}

// A specific playthrough of a universe
export interface UniverseRun {
  id: string;
  universeId: string;
  startedAt: number;
  completedAt?: number;
  status: UniverseRunStatus;

  // Learning artifacts captured during this run
  intuitionResponses: IntuitionResponse[];
  imitationAttempts: ImitationAttempt[];
  quizResults: QuizResult[];
  synthesisAnalyses: SynthesisAnalysis[];

  // Summary metrics (calculated on completion)
  metrics?: {
    totalQuestions: number;
    correctAnswers: number;
    totalTimeSeconds?: number;
    doctrinesCompleted: number;
    totalDoctrines: number;
  };
}

// Structured sections of a study guide
export interface DoctrineSummary {
  title: string;
  keyPoints: string[];
  userStrengths: string[];
  areasToImprove: string[];
}

export interface ModelPattern {
  name: string;
  description: string;
  example: string;
}

export interface MistakeProfile {
  pattern: string;
  frequency: number;
  correction: string;
  examples: string[];
}

export interface PracticeScenario {
  scenario: string;
  focusArea: string;
  suggestedApproach: string;
}

export interface QuizSnapshot {
  totalQuestions: number;
  correctAnswers: number;
  accuracyPercentage: number;
  strongTopics: string[];
  weakTopics: string[];
}

export interface SynthesisSummary {
  overallTheme: string;
  keyInsights: string[];
  applicationStrength: string;
  nextSteps: string[];
}

// The generated study guide write-up
export interface StudyGuideWriteUp {
  id: string;
  universeId: string;
  universeRunId: string;
  createdAt: number;

  // Main content (markdown)
  content: string;

  // Structured sections (optional, for rich rendering)
  doctrineSummaries?: DoctrineSummary[];
  modelPatterns?: ModelPattern[];
  mistakeProfile?: MistakeProfile[];
  practiceScenarios?: PracticeScenario[];
  quizSnapshot?: QuizSnapshot;
  synthesisSummary?: SynthesisSummary;

  // Metadata
  universeTitle: string;
  completionDate: number;
  totalTimeSpent?: number;
}