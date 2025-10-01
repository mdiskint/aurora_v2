export interface Node {
  id: string;
  position: [number, number, number];
  content: string;
  parentId: string | null; // null for L1 nodes (Nexus children)
  children: string[]; // Array of child node IDs
}