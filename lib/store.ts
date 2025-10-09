import { create } from 'zustand';
import { Node } from './types';

interface Nexus {
  id: string;
  position: [number, number, number];
  content: string;
  title: string;
  videoUrl?: string;
  audioUrl?: string;
  type?: 'academic' | 'social';
}

interface CanvasStore {
  nexuses: Nexus[];
  nodes: { [id: string]: Node };
  selectedId: string | null;
  showContentOverlay: boolean;
  isAnimatingCamera: boolean;
  showReplyModal: boolean;
  quotedText: string | null;
  createNexus: (title: string, content: string, videoUrl?: string, audioUrl?: string) => void;
  loadAcademicPaper: () => void;
  addNode: (content: string, parentId: string, quotedText?: string) => void;
  createChatNexus: (userMessage: string, aiResponse: string) => void;
  addUserMessage: (content: string, parentId: string) => string;
  addAIMessage: (content: string, parentId: string) => string;
  selectNode: (id: string | null, showOverlay?: boolean) => void;
  setShowContentOverlay: (show: boolean) => void;
  setIsAnimatingCamera: (isAnimating: boolean) => void;
  setShowReplyModal: (show: boolean) => void;
  setQuotedText: (text: string | null) => void;
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
  quotedText: null,

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
        type: 'social',
      };
      
      console.log(`🟢 Creating Nexus ${nexusCount + 1} at [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`);
      
      return { nexuses: [...state.nexuses, newNexus] };
    });
  },

  loadAcademicPaper: () => {
    fetch('/law-review-seed.json')
      .then(response => response.json())
      .then(data => {
        const nexus: Nexus = {
          id: data.nexus.id,
          position: data.nexus.position,
          title: data.nexus.title,
          content: data.nexus.content,
          type: 'academic'
        };

        const newNodes: { [id: string]: Node } = {};
        
        data.nodes.forEach((jsonNode: any, index: number) => {
          const baseRadius = 6;
          const radiusIncrement = 0.4;
          const radius = baseRadius + (index * radiusIncrement);
          
          const nodesPerRing = 6;
          const ringIndex = Math.floor(index / nodesPerRing);
          const positionInRing = index % nodesPerRing;
          
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
          
          newNodes[jsonNode.id] = {
            id: jsonNode.id,
            position: [x, y, z],
            title: jsonNode.title,
            content: jsonNode.content,
            parentId: nexus.id,
            children: []
          };
        });
        
        set({ 
          nexuses: [nexus],
          nodes: newNodes,
          selectedId: null
        });
        
        console.log(`📚 Loaded academic paper: ${data.nodes.length} sections`);
      })
      .catch(error => {
        console.error('Failed to load academic paper:', error);
      });
  },

  addNode: (content: string, parentId: string, quotedText?: string) => {
    let newNodeId = '';
    
    set((state) => {
      newNodeId = `node-${Date.now()}`;
      
      const siblings = Object.values(state.nodes).filter(n => n.parentId === parentId);
      const siblingIndex = siblings.length;
      
      let position: [number, number, number];
      
      const parentNexus = state.nexuses.find(n => n.id === parentId);
      
      if (parentNexus) {
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
        const parentNode = state.nodes[parentId];
        if (!parentNode) return state;
        
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
        title: `Reply ${new Date().toLocaleTimeString()}`,
        content,
        quotedText,
        parentId,
        children: [],
      };
      
      const updatedNodes = { ...state.nodes, [newNodeId]: newNode };
      
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

  createChatNexus: (title: string, userMessage: string, aiResponse: string) => {
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
      
      const nexusId = `chat-${Date.now()}`;
      const newNexus: Nexus = {
        id: nexusId,
        position,
        title: title,
        content: `You: ${userMessage}\n\nClaude: ${aiResponse}`,
        type: 'social'
      };
      
      console.log(`💬 Creating Chat Nexus "${title}" at [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`);
      
      return { nexuses: [...state.nexuses, newNexus] };
    });
  },

  addUserMessage: (content: string, parentId: string) => {
    let newNodeId = '';
    
    set((state) => {
      newNodeId = `user-${Date.now()}`;
      
      const siblings = Object.values(state.nodes).filter(n => n.parentId === parentId);
      const siblingIndex = siblings.length;
      
      let position: [number, number, number];
      
      const parentNexus = state.nexuses.find(n => n.id === parentId);
      
      if (parentNexus) {
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
      } else {
        const parentNode = state.nodes[parentId];
        if (!parentNode) return state;
        
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
      }
      
      const newNode: Node = {
        id: newNodeId,
        position,
        title: `You ${new Date().toLocaleTimeString()}`,
        content,
        parentId,
        children: [],
        isAI: false,
      };
      
      const updatedNodes = { ...state.nodes, [newNodeId]: newNode };
      
      if (state.nodes[parentId]) {
        updatedNodes[parentId] = {
          ...state.nodes[parentId],
          children: [...state.nodes[parentId].children, newNodeId],
        };
      }
      
      console.log(`💜 User message node created: ${newNodeId}`);
      
      return { nodes: updatedNodes, selectedId: newNodeId };
    });
    
    return newNodeId;
  },

  addAIMessage: (content: string, parentId: string) => {
    let newNodeId = '';
    
    set((state) => {
      newNodeId = `ai-${Date.now()}`;
      
      const siblings = Object.values(state.nodes).filter(n => n.parentId === parentId);
      const siblingIndex = siblings.length;
      
      const parentNode = state.nodes[parentId];
      if (!parentNode) return state;
      
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
      
      const position: [number, number, number] = [x, y, z];
      
      const newNode: Node = {
        id: newNodeId,
        position,
        title: `Claude ${new Date().toLocaleTimeString()}`,
        content,
        parentId,
        children: [],
        isAI: true,
      };
      
      const updatedNodes = { ...state.nodes, [newNodeId]: newNode };
      
      if (state.nodes[parentId]) {
        updatedNodes[parentId] = {
          ...state.nodes[parentId],
          children: [...state.nodes[parentId].children, newNodeId],
        };
      }
      
      console.log(`🟠 AI response node created: ${newNodeId}`);
      
      return { nodes: updatedNodes };
    });
    
    setTimeout(() => {
      get().selectNode(newNodeId, true);
    }, 600);
    
    return newNodeId;
  },

  selectNode: (id: string | null, showOverlay: boolean = true) => {
    console.log(`🎯 Selected: ${id}, showOverlay: ${showOverlay}`);
    set({ 
      selectedId: id, 
      showContentOverlay: showOverlay,
      isAnimatingCamera: showOverlay
    });
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

  setQuotedText: (text: string | null) => {
    set({ quotedText: text });
  },

  getNodeLevel: (nodeId: string) => {
    const state = get();
    const node = state.nodes[nodeId];
    if (!node) return 0;
    
    let level = 1;
    let currentNode = node;
    
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