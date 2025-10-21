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
  connectionNodes?: [string, string];  // ← ADD THIS: IDs of the two nodes this connection bridges
  isConnectionNode?: boolean;          // ← ADD THIS: Flag to identify connection nodes
}