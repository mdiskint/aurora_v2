import { create } from 'zustand';
import { Node } from './types';

interface Nexus {
  id: string;
  position: [number, number, number];
  content: string;
  title: string; // Add this
  videoUrl?: string;
  audioUrl?: string;
}

interface CanvasStore {
  nexuses: Nexus[];
  nodes: { [id: string]: Node };
  selectedId: string | null;
  showContentOverlay: boolean;
  isAnimatingCamera: boolean;
  showReplyModal: boolean;
  createNexus: (title: string, content: string, videoUrl?: string, audioUrl?: string) => void;
  addNode: (content: string, parentId: string) => void;
  selectNode: (id: string | null, showOverlay?: boolean) => void;
  setShowContentOverlay: (show: boolean) => void;
  setIsAnimatingCamera: (isAnimating: boolean) => void;
  setShowReplyModal: (show: boolean) => void;
  getNodesByParent: (parentId: string | null) => Node[];
  getNodeLevel: (nodeId: string) => number;
  getNexusForNode: (nodeId: string) => Nexus | null;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nexuses: [],
  nodes: {},
  selectedId: null,
  showContentOverlay: false,
  isAnimatingCamera: false,
  showReplyModal: false,
  
createNexus: (title: string, content: string, videoUrl?: string, audioUrl?: string) => {
  set((state) => {
    const nexusCount = state.nexuses.length;
    
    let position: [number, number, number];
    
    if (nexusCount === 0) {
      position = [0, 0, 0];
    } else {
      const radius = 50;
      const angle = (nexusCount * 2 * Math.PI) / 3;
      position = [
        radius * Math.cos(angle),
        0,
        radius * Math.sin(angle)
      ];
    }
    
    const newNexus: Nexus = {
      id: `nexus-${Date.now()}`,
      position,
      title,
      content,
      videoUrl,
      audioUrl,
    };
    
    console.log(`🟢 Creating Nexus ${nexusCount + 1} at [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`);
    
    return { nexuses: [...state.nexuses, newNexus] };
  });
},
  
  addNode: (content: string, parentId: string) => {
    let newNodeId = '';
    
    set((state) => {
      newNodeId = `node-${Date.now()}`;
      
      const siblings = Object.values(state.nodes).filter(n => n.parentId === parentId);
      const siblingIndex = siblings.length;
      
      let position: [number, number, number];
      
      // Find which Nexus this node belongs to
      const parentNexus = state.nexuses.find(n => n.id === parentId);
      
      if (parentNexus) {
        // L1 nodes: Ring system around parent Nexus
        const nexusPos = parentNexus.position;
        const baseRadius = 6;
        const radiusIncrement = 0.4;
        const radius = baseRadius + (siblingIndex * radiusIncrement);
        
        const nodesPerRing = 6;
        const ringIndex = Math.floor(siblingIndex / nodesPerRing);
        const positionInRing = siblingIndex % nodesPerRing;
        
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const ringRotationOffset = ringIndex * goldenAngle;
        const angle = (positionInRing * 2 * Math.PI) / nodesPerRing + ringRotationOffset;
        
        let y = 0;
        if (ringIndex > 0) {
          const step = Math.ceil(ringIndex / 2);
          const direction = ringIndex % 2 === 1 ? 1 : -1;
          y = step * 2.5 * direction;
        }
        
        const x = nexusPos[0] + radius * Math.cos(angle);
        const z = nexusPos[2] + radius * Math.sin(angle);
        
        position = [x, y, z];
        console.log(`➕ L1 Node: Ring ${ringIndex}, Position ${positionInRing}, [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);
      } else {
        // L2+ nodes: 3D helix spiral from parent, moving AWAY from parent's Nexus
        const parentNode = state.nodes[parentId];
        if (!parentNode) return state;
        
        // Find the Nexus this node tree belongs to
        const nexus = get().getNexusForNode(parentId);
        if (!nexus) return state;
        
        const nexusPos = nexus.position;
        const directionX = parentNode.position[0] - nexusPos[0];
        const directionY = parentNode.position[1] - nexusPos[1];
        const directionZ = parentNode.position[2] - nexusPos[2];
        
        const dirLength = Math.sqrt(directionX * directionX + directionY * directionY + directionZ * directionZ);
        const normDirX = directionX / dirLength;
        const normDirY = directionY / dirLength;
        const normDirZ = directionZ / dirLength;
        
        const baseDistance = 3;
        const distanceIncrement = 0.8;
        const distance = baseDistance + (siblingIndex * distanceIncrement);
        
        const turnsPerNode = 0.3;
        const helixRadius = 1.5;
        const angle = siblingIndex * turnsPerNode * 2 * Math.PI;
        
        const upX = 0, upY = 1, upZ = 0;
        
        let rightX = normDirY * upZ - normDirZ * upY;
        let rightY = normDirZ * upX - normDirX * upZ;
        let rightZ = normDirX * upY - normDirY * upX;
        const rightLength = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ);
        rightX /= rightLength;
        rightY /= rightLength;
        rightZ /= rightLength;
        
        const upPerpX = normDirY * rightZ - normDirZ * rightY;
        const upPerpY = normDirZ * rightX - normDirX * rightZ;
        const upPerpZ = normDirX * rightY - normDirY * rightX;
        
        const helixOffsetX = helixRadius * (Math.cos(angle) * rightX + Math.sin(angle) * upPerpX);
        const helixOffsetY = helixRadius * (Math.cos(angle) * rightY + Math.sin(angle) * upPerpY);
        const helixOffsetZ = helixRadius * (Math.cos(angle) * rightZ + Math.sin(angle) * upPerpZ);
        
        const x = parentNode.position[0] + (normDirX * distance) + helixOffsetX;
        const y = parentNode.position[1] + (normDirY * distance) + helixOffsetY;
        const z = parentNode.position[2] + (normDirZ * distance) + helixOffsetZ;
        
        position = [x, y, z];
        console.log(`➕ L${get().getNodeLevel(parentId) + 1} Node: Child ${siblingIndex}, Distance ${distance.toFixed(2)}, [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);
      }
      
      const newNode: Node = {
        id: newNodeId,
        position,
        content,
        parentId,
        children: [],
      };
      
      const updatedNodes = { ...state.nodes, [newNodeId]: newNode };
      
      // Update parent node's children array if parent is a node (not Nexus)
      if (state.nodes[parentId]) {
        updatedNodes[parentId] = {
          ...state.nodes[parentId],
          children: [...state.nodes[parentId].children, newNodeId],
        };
      }
      
      return { nodes: updatedNodes };
    });
    
    setTimeout(() => {
      get().selectNode(newNodeId, false);
    }, 100);
  },

  selectNode: (id: string | null, showOverlay: boolean = true) => {
    console.log(`🎯 Selected: ${id}, showOverlay: ${showOverlay}`);
    set({ selectedId: id, showContentOverlay: false });
    
    if (!showOverlay) {
      set({ isAnimatingCamera: true });
    }
  },

  getNodesByParent: (parentId: string | null) => {
    return Object.values(get().nodes).filter(n => n.parentId === parentId);
  },

  setIsAnimatingCamera: (isAnimating: boolean) => {
    set({ isAnimatingCamera: isAnimating });
  },

  setShowReplyModal: (show: boolean) => {
    set({ showReplyModal: show });
  },

  setShowContentOverlay: (show: boolean) => {
    set({ showContentOverlay: show });
  },

  getNodeLevel: (nodeId: string) => {
    const state = get();
    const node = state.nodes[nodeId];
    if (!node) return 0;
    
    let level = 1;
    let currentNode = node;
    
    // Walk up the tree until we hit a Nexus
    while (currentNode.parentId) {
      const isNexus = state.nexuses.some(n => n.id === currentNode.parentId);
      if (isNexus) break;
      
      level++;
      currentNode = state.nodes[currentNode.parentId];
      if (!currentNode) break;
    }
    
    return level;
  },
  
  getNexusForNode: (nodeId: string) => {
    const state = get();
    const node = state.nodes[nodeId];
    if (!node) return null;
    
    // Walk up the tree to find the Nexus
    let currentNode = node;
    while (currentNode.parentId) {
      const nexus = state.nexuses.find(n => n.id === currentNode.parentId);
      if (nexus) return nexus;
      
      currentNode = state.nodes[currentNode.parentId];
      if (!currentNode) break;
    }
    
    return null;
  },
}));