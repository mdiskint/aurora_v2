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
  isConnectionNode?: boolean;          // ← ADD THIS: Flag to identify connection nodes
}