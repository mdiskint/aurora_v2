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
}