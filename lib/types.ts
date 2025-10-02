export interface Node {
  id: string;
  position: [number, number, number];
  content: string;
  parentId: string;
  children: string[];
  videoUrl?: string;
  audioUrl?: string; // Add this
}