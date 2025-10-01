import { create } from 'zustand';
import { Node } from './types';

interface CanvasStore {
  nexus: { id: string; position: [number, number, number]; content: string } | null;
  nodes: { [id: string]: Node };
  selectedId: string | null;
  showContentOverlay: boolean;
  createNexus: (content: string) => void;
  addNode: (content: string, parentId: string) => void;
  selectNode: (id: string | null) => void;
  setShowContentOverlay: (show: boolean) => void;
  getNodesByParent: (parentId: string | null) => Node[];
  getNodeLevel: (nodeId: string) => number;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nexus: null,
  nodes: {},
  selectedId: null,
  showContentOverlay: false,
  
  createNexus: (content: string) => {
    set(() => {
      const newNexus = {
        id: `nexus-${Date.now()}`,
        position: [0, 0, 0] as [number, number, number],
        content,
      };
      
      console.log('🟢 Creating Nexus at [0, 0, 0]');
      
      return { nexus: newNexus };
    });
  },
  
  addNode: (content: string, parentId: string) => {
    set((state) => {
      const newNodeId = `node-${Date.now()}`;
      
      const siblings = Object.values(state.nodes).filter(n => n.parentId === parentId);
      const siblingIndex = siblings.length;
      
      let position: [number, number, number];
      
      if (parentId === state.nexus?.id) {
        // L1 nodes: Ring system around Nexus
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
        
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        
        position = [x, y, z];
        console.log(`➕ L1 Node: Ring ${ringIndex}, Position ${positionInRing}, [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);
      } else {
        // L2+ nodes: 3D helix spiral from parent, moving AWAY from Nexus
        const parentNode = state.nodes[parentId];
        if (!parentNode) return state;
        
        const nexusPos = state.nexus!.position;
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
      if (parentId !== state.nexus?.id && state.nodes[parentId]) {
        updatedNodes[parentId] = {
          ...state.nodes[parentId],
          children: [...state.nodes[parentId].children, newNodeId],
        };
      }
      
      return { nodes: updatedNodes };
    });
  },
  
  selectNode: (id: string | null) => {
    console.log(`🎯 Selected: ${id}`);
   set({ selectedId: id, showContentOverlay: id !== null });
  },
  
  getNodesByParent: (parentId: string | null) => {
    return Object.values(get().nodes).filter(n => n.parentId === parentId);
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
    
    while (currentNode.parentId && currentNode.parentId !== state.nexus?.id) {
      level++;
      currentNode = state.nodes[currentNode.parentId];
      if (!currentNode) break;
    }
    
    return level;
  },
}));