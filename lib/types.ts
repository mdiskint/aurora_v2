export interface Node {
  id: string;
  position: [number, number, number];
  title: string;  // ADD THIS LINE
  content: string;
  quotedText?: string;
  parentId: string;
  children: string[];
  videoUrl?: string;
  audioUrl?: string;
}