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
  isAI?: boolean;  // NEW: flag to identify AI response nodes
}