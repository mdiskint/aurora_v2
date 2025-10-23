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
  previousId: string | null;
  showContentOverlay: boolean;
  isAnimatingCamera: boolean;
  showReplyModal: boolean;
  quotedText: string | null;
  connectionModeNodeA: string | null;
  connectionModeActive: boolean;
  selectedNodesForConnection: string[];
  createNexus: (title: string, content: string, videoUrl?: string, audioUrl?: string) => void;
  loadAcademicPaper: () => void;
  loadAcademicPaperFromData: (data: any) => void;
  updateNodeContent: (nodeId: string, newContent: string) => void;
  updateNexusContent: (nexusId: string, newContent: string) => void;
  exportToWordDoc: () => void;
  addNode: (content: string, parentId: string, quotedText?: string) => void;
  createChatNexus: (title: string, userMessage: string, aiResponse: string) => void;
  addUserMessage: (content: string, parentId: string) => string;
  addAIMessage: (content: string, parentId: string) => string;
  addSynthesisNode: (content: string, parentId: string) => string;
  selectNode: (id: string | null, showOverlay?: boolean) => void;
  setShowContentOverlay: (show: boolean) => void;
  setIsAnimatingCamera: (isAnimating: boolean) => void;
  setShowReplyModal: (show: boolean) => void;
  setQuotedText: (text: string | null) => void;
   startConnectionMode: (nodeId: string) => void;
  clearConnectionMode: () => void;
  createConnection: (nodeAId: string, nodeBId: string) => void;
  addNodeToConnection: (nodeId: string) => void;
  createMultiConnection: (nodeIds: string[]) => void;
  getNodesByParent: (parentId: string | null) => Node[];
  getNodeLevel: (nodeId: string) => number;
  getNexusForNode: (nodeId: string) => Nexus | null;
  addNodeFromWebSocket: (data: any) => void;
  addNexusFromWebSocket: (data: any) => void;
  activatedConversations: string[];
  toggleActivateConversation: (nexusId: string) => void;
  getActivatedConversations: () => Nexus[];
  deleteConversation: (nexusId: string) => void;
  deleteNode: (nodeId: string) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nexuses: [],
  nodes: {},
  selectedId: null,
  previousId: null,
  showContentOverlay: false,
  isAnimatingCamera: false,
  showReplyModal: false,
  quotedText: null,
  activatedConversations: [],
  connectionModeNodeA: null,
  connectionModeActive: false,
  selectedNodesForConnection: [],

  // 💾 SAVE TO LOCALSTORAGE
  saveToLocalStorage: () => {
    const state = get();
    const dataToSave = {
      nexuses: state.nexuses,
      nodes: state.nodes,
      activatedConversations: state.activatedConversations,
    };
    
    try {
      localStorage.setItem('aurora-portal-data', JSON.stringify(dataToSave));
      console.log('💾 Saved to localStorage:', {
        nexusCount: state.nexuses.length,
        nodeCount: Object.keys(state.nodes).length
      });
    } catch (error) {
      console.error('❌ Failed to save to localStorage:', error);
    }
  },

  // 📂 LOAD FROM LOCALSTORAGE
  loadFromLocalStorage: () => {
    try {
      const saved = localStorage.getItem('aurora-portal-data');
      if (saved) {
        const data = JSON.parse(saved);
        set({
          nexuses: data.nexuses || [],
          nodes: data.nodes || {},
          activatedConversations: data.activatedConversations || [],
        });
        console.log('📂 Loaded from localStorage:', {
          nexusCount: data.nexuses?.length || 0,
          nodeCount: Object.keys(data.nodes || {}).length
        });
      } else {
        console.log('📂 No saved data found in localStorage');
      }
    } catch (error) {
      console.error('❌ Failed to load from localStorage:', error);
    }
  },

  createNexus: (title: string, content: string, videoUrl?: string, audioUrl?: string) => {
    let newNexus: Nexus | null = null;
    
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
      
      newNexus = {
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
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
    
    // Broadcast nexus creation to WebSocket
    if (newNexus) {
      console.log('🔍 Checking for socket...', typeof window !== 'undefined' ? (window as any).socket : 'window is undefined');
      const socket = typeof window !== 'undefined' ? (window as any).socket : null;
      if (socket) {
        console.log('✅ Socket found! Broadcasting...');
        socket.emit('create_nexus', {
          portalId: 'default-portal',
          ...newNexus
        });
        console.log('📤 Broadcasting nexus creation:', newNexus.id);
      } else {
        console.error('❌ No socket available for broadcasting!');
      }
    }
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
          selectedId: null,
          previousId: null
        });
        
        // 💾 SAVE TO LOCALSTORAGE
        get().saveToLocalStorage();
        
        console.log(`📚 Loaded academic paper: ${data.nodes.length} sections`);
      })
      .catch(error => {
        console.error('Failed to load academic paper:', error);
      });
  },

  loadAcademicPaperFromData: (data: any) => {
    console.log('📚 Loading academic paper from uploaded data');
    
    set({ 
      nexuses: [], 
      nodes: {},
      selectedId: null,
      previousId: null,
      showContentOverlay: false
    });

    const nexus: Nexus = {
      id: data.nexus.id || 'uploaded-paper-nexus',
      position: data.nexus.position || [0, 0, 0],
      title: data.nexus.title,
      content: data.nexus.content,
      type: 'academic'
    };

    const nexuses = [nexus];
    const nodes: { [id: string]: Node } = {};

    data.sections.forEach((section: any, index: number) => {
      const nodeId = `node-${index}`;
      
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
      
      nodes[nodeId] = {
        id: nodeId,
        position: [x, y, z],
        title: section.title,
        content: section.content,
        parentId: nexus.id,
        children: []
      };
    });

    set({ nexuses, nodes });
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
    
    console.log(`✅ Loaded paper: ${nexus.title} with ${data.sections.length} sections`);
  },

  updateNodeContent: (nodeId: string, newContent: string) => {
    set((state) => {
      const updatedNodes = { ...state.nodes };
      if (updatedNodes[nodeId]) {
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          content: newContent,
        };
      }
      return { nodes: updatedNodes };
    });
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
  },

  updateNexusContent: (nexusId: string, newContent: string) => {
    set((state) => {
      const updatedNexuses = state.nexuses.map((nexus) => {
        if (nexus.id === nexusId) {
          return {
            ...nexus,
            content: newContent,
          };
        }
        return nexus;
      });
      return { nexuses: updatedNexuses };
    });
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
    
    console.log(`✅ Updated nexus content: ${nexusId}`);
  },

  exportToWordDoc: async () => {
    const state = get();
    const { nodes, nexuses } = state;
    
    const nexus = nexuses[0];
    if (!nexus) {
      alert('No paper loaded to export!');
      return;
    }

    const { Document, Paragraph, HeadingLevel, AlignmentType, Packer } = await import('docx');

    const sections = Object.values(nodes)
      .filter((n) => n.type !== 'nexus')
      .sort((a, b) => {
        const aIndex = parseInt(a.id.split('-')[1]) || 0;
        const bIndex = parseInt(b.id.split('-')[1]) || 0;
        return aIndex - bIndex;
      });

    const documentChildren: any[] = [];

    documentChildren.push(
      new Paragraph({
        text: nexus.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    if (nexus.content) {
      documentChildren.push(
        new Paragraph({
          text: 'Abstract',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 200 }
        })
      );
      
      const abstractParagraphs = nexus.content.split('\n\n');
      abstractParagraphs.forEach(para => {
        if (para.trim()) {
          documentChildren.push(
            new Paragraph({
              text: para.trim(),
              spacing: { after: 200 }
            })
          );
        }
      });
    }

    sections.forEach((section) => {
      documentChildren.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );

      const paragraphs = section.content.split('\n\n');
      paragraphs.forEach(para => {
        if (para.trim()) {
          documentChildren.push(
            new Paragraph({
              text: para.trim(),
              spacing: { after: 200 }
            })
          );
        }
      });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: documentChildren
      }]
    });

    try {
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${nexus.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('📄 Paper exported successfully as Word document!');
    } catch (error) {
      console.error('Error exporting document:', error);
      alert('Failed to export document. See console for details.');
    }
  },
  
  addNode: (content: string, parentId: string, quotedText?: string) => {
    let newNodeId = '';
    let isConnectionNodeParent = false;

    set((state) => {
      newNodeId = `node-${Date.now()}`;

      const siblings = Object.values(state.nodes).filter(n => n.parentId === parentId);
      const siblingIndex = siblings.length;

      // Check if parent is a connection node (Socratic mode)
      const parentNode = state.nodes[parentId];
      isConnectionNodeParent = parentNode?.isConnectionNode || false;
      
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
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
    
    // Broadcast node creation to WebSocket
    const socket = (window as any).socket;
    if (socket) {
      const newNode = get().nodes[newNodeId];
      socket.emit('create_node', {
        portalId: 'default-portal',
        id: newNode.id,
        position: newNode.position,
        title: newNode.title,
        content: newNode.content,
        parentId: newNode.parentId,
      });
      console.log('📤 Broadcasting node creation:', newNodeId);
    }

    // CRITICAL: Don't auto-select user answer nodes during Socratic mode
    // The Socratic modal handles selection to keep focus on connection node
    if (!isConnectionNodeParent) {
      setTimeout(() => {
        get().selectNode(newNodeId, false);
      }, 100);
    } else {
      console.log('💭 Socratic mode: Skipping auto-selection of user answer node to preserve connection node focus');
    }
  },

  createChatNexus: (title: string, userMessage: string, aiResponse: string) => {
    let newNexus: Nexus | null = null;
    
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
      
      newNexus = {
        id: `chat-${Date.now()}`,
        position,
        title: title,
        content: `You: ${userMessage}\n\nClaude: ${aiResponse}`,
        type: 'social'
      };
      
      console.log(`💬 Creating Chat Nexus "${title}" at [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`);
      
      return { nexuses: [...state.nexuses, newNexus] };
    });
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
    
    // Broadcast nexus creation to WebSocket
    if (newNexus) {
      console.log('🔍 Checking for socket...', typeof window !== 'undefined' ? (window as any).socket : 'window is undefined');
      const socket = typeof window !== 'undefined' ? (window as any).socket : null;
      if (socket) {
        console.log('✅ Socket found! Broadcasting...');
        socket.emit('create_nexus', {
          portalId: 'default-portal',
          ...newNexus
        });
        console.log('📤 Broadcasting nexus creation:', newNexus.id);
      } else {
        console.error('❌ No socket available for broadcasting!');
      }
    }
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
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
    
    return newNodeId;
  },

  addAIMessage: (content: string, parentId: string) => {
    let newNodeId = '';
    let isConnectionNodeParent = false;

    set((state) => {
      newNodeId = `ai-${Date.now()}`;

      const siblings = Object.values(state.nodes).filter(n => n.parentId === parentId);
      const siblingIndex = siblings.length;

      const parentNode = state.nodes[parentId];
      if (!parentNode) return state;

      // Check if parent is a connection node (Socratic mode)
      isConnectionNodeParent = parentNode.isConnectionNode || false;
      
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
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();

    // CRITICAL: Don't auto-select AI nodes during Socratic mode
    // The Socratic modal handles selection to keep focus on connection node
    if (!isConnectionNodeParent) {
      setTimeout(() => {
        get().selectNode(newNodeId, true);
      }, 600);
    } else {
      console.log('💭 Socratic mode: Skipping auto-selection of AI node to preserve connection node focus');
    }

    return newNodeId;
  },

  addSynthesisNode: (content: string, parentId: string) => {
    let newNodeId = '';

    set((state) => {
      newNodeId = `synthesis-${Date.now()}`;

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
        title: `💎 Synthesis ${new Date().toLocaleTimeString()}`,
        content,
        parentId,
        children: [],
        isSynthesis: true,
      };

      const updatedNodes = { ...state.nodes, [newNodeId]: newNode };

      if (state.nodes[parentId]) {
        updatedNodes[parentId] = {
          ...state.nodes[parentId],
          children: [...state.nodes[parentId].children, newNodeId],
        };
      }

      console.log(`💎 Synthesis node created: ${newNodeId}`);

      return { nodes: updatedNodes };
    });

    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();

    // Select the synthesis node to show it
    setTimeout(() => {
      get().selectNode(newNodeId, true);
    }, 600);

    return newNodeId;
  },

  selectNode: (id: string | null, showOverlay: boolean = true) => {
    const state = get();

    const newPreviousId = (id !== state.selectedId) ? state.selectedId : state.previousId;

    const timestamp = Date.now();
    console.log(`🎯 ${timestamp} STORE: selectNode(${id}, showOverlay=${showOverlay})`);
    console.log(`   Previous: ${newPreviousId}, Current modal state:`, {
      showReplyModal: state.showReplyModal,
      showContentOverlay: state.showContentOverlay
    });
    console.trace('Stack trace:');

    set({
      selectedId: id,
      previousId: newPreviousId,
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
    const timestamp = Date.now();
    console.log(`🕐 ${timestamp} STORE: setShowReplyModal(${show})`);
    console.trace('Stack trace:');
    set({ showReplyModal: show });
  },

  setShowContentOverlay: (show: boolean) => {
    set({ showContentOverlay: show });
  },

  setQuotedText: (text: string | null) => {
    set({ quotedText: text });
  },

  startConnectionMode: (nodeId: string) => {
    console.log('🔗 Connection mode started with node:', nodeId);
    set({ 
      connectionModeActive: true,
      connectionModeNodeA: nodeId 
    });
  },

  clearConnectionMode: () => {
    console.log('❌ Connection mode cancelled');
    set({
      connectionModeActive: false,
      connectionModeNodeA: null,
      selectedNodesForConnection: []
    });
  },

  addNodeToConnection: (nodeId: string) => {
    set((state) => {
      const alreadySelected = state.selectedNodesForConnection.includes(nodeId);
      if (alreadySelected) {
        // Deselect if already selected
        console.log('🔗 Deselected node:', nodeId);
        return {
          selectedNodesForConnection: state.selectedNodesForConnection.filter(id => id !== nodeId)
        };
      } else {
        // Add to selection
        console.log('🔗 Selected node:', nodeId, '(Total:', state.selectedNodesForConnection.length + 1, ')');
        return {
          selectedNodesForConnection: [...state.selectedNodesForConnection, nodeId]
        };
      }
    });
  },

createConnection: (nodeAId: string, nodeBId: string) => {
  console.log('🔗 Creating connection node between', nodeAId, 'and', nodeBId);
  
  let newConnectionNodeId = '';
  
  set((state) => {
    const nodeA = state.nodes[nodeAId];
    const nodeB = state.nodes[nodeBId];
    
    if (!nodeA || !nodeB) {
      console.error('❌ One or both nodes not found:', nodeAId, nodeBId);
      return state;
    }
    
    // Generate new node ID
    newConnectionNodeId = `connection-${Date.now()}`;
    
    // Calculate position: midpoint between A and B, raised up
    const midX = (nodeA.position[0] + nodeB.position[0]) / 2;
    const midY = (nodeA.position[1] + nodeB.position[1]) / 2;
    const midZ = (nodeA.position[2] + nodeB.position[2]) / 2;
    
    // Add upward curve to avoid other nodes
    const upwardOffset = 4; // Height above midpoint
    const position: [number, number, number] = [midX, midY + upwardOffset, midZ];
    
    console.log(`✨ Connection node position: [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`);
    
    // Create the new connection node
    const newNode: Node = {
      id: newConnectionNodeId,
      position,
      title: `Connection ${new Date().toLocaleTimeString()}`,
      content: '', // Empty - user will fill it in
      parentId: nodeA.parentId, // Use Node A's parent
      children: [],
      isConnectionNode: true,
      connectionNodes: [nodeAId, nodeBId], // Store both inspiration nodes
    };
    
    const updatedNodes = { ...state.nodes, [newConnectionNodeId]: newNode };
    
    console.log('✅ Connection node created:', newConnectionNodeId);
    
    return { 
      nodes: updatedNodes,
      selectedId: newConnectionNodeId, // Select the new node
    };
  });
  
  // Save to localStorage
  get().saveToLocalStorage();
  
  // Open the reply modal for the user to write about the connection
  setTimeout(() => {
    get().setShowReplyModal(true);
  }, 100);
  
  // Emit to backend via WebSocket
  const socket = (window as any).socket;
  if (socket) {
    const newNode = get().nodes[newConnectionNodeId];
    socket.emit('create_node', {
      portalId: 'default-portal',
      id: newNode.id,
      position: newNode.position,
      title: newNode.title,
      content: newNode.content,
      parentId: newNode.parentId,
      isConnectionNode: true,
      connectionNodes: [nodeAId, nodeBId],
    });
    console.log('📤 Broadcasting connection node to backend');
  }
},

  createMultiConnection: (nodeIds: string[]) => {
    console.log('🔗 Creating multi-connection node for', nodeIds.length, 'nodes');

    // Validate minimum 2 nodes
    if (nodeIds.length < 2) {
      console.error('❌ Need at least 2 nodes to create a connection');
      return;
    }

    let newConnectionNodeId = '';

    set((state) => {
      // Get all nodes
      const nodes = nodeIds.map(id => state.nodes[id]).filter(Boolean);

      if (nodes.length < 2) {
        console.error('❌ Not enough valid nodes found');
        return state;
      }

      // Generate new node ID
      newConnectionNodeId = `connection-${Date.now()}`;

      // Calculate centroid position (average of all positions)
      const sumX = nodes.reduce((sum, node) => sum + node.position[0], 0);
      const sumY = nodes.reduce((sum, node) => sum + node.position[1], 0);
      const sumZ = nodes.reduce((sum, node) => sum + node.position[2], 0);

      const centroidX = sumX / nodes.length;
      const centroidY = sumY / nodes.length;
      const centroidZ = sumZ / nodes.length;

      // Find the nexus (parent) position
      const parentId = nodes[0].parentId;
      const parentNexus = state.nexuses.find(n => n.id === parentId);
      const nexusPos = parentNexus ? parentNexus.position : [0, 0, 0];

      // Calculate direction from nexus to centroid
      const dirX = centroidX - nexusPos[0];
      const dirY = centroidY - nexusPos[1];
      const dirZ = centroidZ - nexusPos[2];

      // Normalize direction vector
      const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
      const normX = length > 0 ? dirX / length : 0;
      const normY = length > 0 ? dirY / length : 0;
      const normZ = length > 0 ? dirZ / length : 0;

      // Calculate distance from nexus to centroid, then add extra distance
      const extraDistance = 3;
      const totalDistance = length + extraDistance;

      // Position star radially outward from nexus
      const position: [number, number, number] = [
        nexusPos[0] + normX * totalDistance,
        nexusPos[1] + normY * totalDistance,
        nexusPos[2] + normZ * totalDistance
      ];

      console.log(`✨ Multi-connection node position: [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`);
      console.log(`   Nexus: [${nexusPos[0]}, ${nexusPos[1]}, ${nexusPos[2]}], Distance: ${totalDistance.toFixed(2)}`);

      // Create the new connection node
      const newNode: Node = {
        id: newConnectionNodeId,
        position,
        title: `Connection ${new Date().toLocaleTimeString()}`,
        content: '', // Empty - user will fill it in
        parentId: nodes[0].parentId, // Use first node's parent
        children: [],
        isConnectionNode: true,
        connectionNodes: nodeIds, // Store all connected node IDs
      };

      const updatedNodes = { ...state.nodes, [newConnectionNodeId]: newNode };

      console.log('✅ Multi-connection node created:', newConnectionNodeId, 'connecting', nodeIds.length, 'nodes');

      return {
        nodes: updatedNodes,
        selectedId: newConnectionNodeId, // Select the new node
        selectedNodesForConnection: [], // Clear selection
        connectionModeActive: false, // Exit connection mode
        showContentOverlay: false, // Ensure modal takes precedence
      };
    });

    // Save to localStorage
    get().saveToLocalStorage();

    // Open the reply modal for the user to write about the connection
    setTimeout(() => {
      get().setShowReplyModal(true);
    }, 100);

    // Emit to backend via WebSocket
    const socket = (window as any).socket;
    if (socket) {
      const newNode = get().nodes[newConnectionNodeId];
      socket.emit('create_node', {
        portalId: 'default-portal',
        id: newNode.id,
        position: newNode.position,
        title: newNode.title,
        content: newNode.content,
        parentId: newNode.parentId,
        isConnectionNode: true,
        connectionNodes: nodeIds,
      });
      console.log('📤 Broadcasting multi-connection node to backend');
    }
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

  addNodeFromWebSocket: (data: any) => {
    const state = get();
    
    if (state.nodes[data.id]) {
      console.log('⏭️ Node already exists, skipping:', data.id);
      return;
    }

    console.log('➕ Adding node from WebSocket:', data.id);
    
    const newNode: Node = {
      id: data.id,
      position: data.position,
      title: data.title || 'Untitled',
      content: data.content,
      parentId: data.parentId,
      children: [],
    };

    set((state) => ({
      nodes: { ...state.nodes, [newNode.id]: newNode }
    }));
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
    
    console.log('✅ Node added from WebSocket');
  },

  addNexusFromWebSocket: (data: any) => {
    const state = get();
    
    if (state.nexuses.find(n => n.id === data.id)) {
      console.log('⏭️ Nexus already exists, skipping:', data.id);
      return;
    }

    console.log('➕ Adding nexus from WebSocket:', data.id);
    
    const newNexus: Nexus = {
      id: data.id,
      position: data.position,
      title: data.title,
      content: data.content,
      videoUrl: data.videoUrl,
      audioUrl: data.audioUrl,
      type: data.type || 'social',
    };

    set((state) => ({
      nexuses: [...state.nexuses, newNexus]
    }));
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
    
    console.log('✅ Nexus added from WebSocket');
  },

  toggleActivateConversation: (nexusId: string) => {
    set((state) => {
      const isActivated = state.activatedConversations.includes(nexusId);
      
      if (isActivated) {
        return {
          activatedConversations: state.activatedConversations.filter(id => id !== nexusId)
        };
      } else {
        return {
          activatedConversations: [...state.activatedConversations, nexusId]
        };
      }
    });
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
  },
  
  getActivatedConversations: () => {
    const state = get();
    return state.nexuses.filter(n => state.activatedConversations.includes(n.id));
  },

  deleteConversation: (nexusId: string) => {
    set((state) => {
      console.log(`🗑️ Deleting conversation: ${nexusId}`);

      // Helper function to recursively get all descendant node IDs
      const getAllDescendants = (parentId: string, nodes: { [id: string]: Node }): string[] => {
        const descendants: string[] = [];
        Object.keys(nodes).forEach(nodeId => {
          if (nodes[nodeId].parentId === parentId) {
            descendants.push(nodeId);
            // Recursively get children of this node
            descendants.push(...getAllDescendants(nodeId, nodes));
          }
        });
        return descendants;
      };

      // Remove the nexus
      const updatedNexuses = state.nexuses.filter(n => n.id !== nexusId);

      // Get all descendant nodes recursively
      const descendantIds = getAllDescendants(nexusId, state.nodes);
      console.log(`🗑️ Found ${descendantIds.length} descendant nodes to delete`);

      // Remove all descendant nodes
      const updatedNodes = { ...state.nodes };
      descendantIds.forEach(nodeId => {
        delete updatedNodes[nodeId];
      });

      // Also remove any connection nodes that reference deleted nodes
      Object.keys(updatedNodes).forEach(nodeId => {
        const node = updatedNodes[nodeId];
        if (node.isConnectionNode && node.connectionNodes) {
          // Check if any connected nodes were deleted
          const hasDeletedConnection = node.connectionNodes.some(connId =>
            connId === nexusId || descendantIds.includes(connId)
          );
          if (hasDeletedConnection) {
            delete updatedNodes[nodeId];
          }
        }
      });

      // Remove from activated conversations
      const updatedActivated = state.activatedConversations.filter(id => id !== nexusId);

      // Clear selection if we're deleting the selected nexus or any of its descendants
      const isSelectedDeleted = state.selectedId === nexusId ||
                                (state.selectedId && descendantIds.includes(state.selectedId));
      const updatedSelectedId = isSelectedDeleted ? null : state.selectedId;

      console.log(`✅ Deleted conversation ${nexusId} and ${descendantIds.length} nodes`);

      return {
        nexuses: updatedNexuses,
        nodes: updatedNodes,
        activatedConversations: updatedActivated,
        selectedId: updatedSelectedId,
        showContentOverlay: updatedSelectedId === null ? false : state.showContentOverlay
      };
    });
    
    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
  },

  deleteNode: (nodeId: string) => {
    set((state) => {
      console.log(`🗑️ Deleting node: ${nodeId}`);

      const nodeToDelete = state.nodes[nodeId];
      if (!nodeToDelete) {
        console.warn(`⚠️ Node ${nodeId} not found`);
        return state;
      }

      // Helper function to recursively get all descendant node IDs
      const getAllDescendants = (parentId: string, nodes: { [id: string]: Node }): string[] => {
        const descendants: string[] = [];
        Object.keys(nodes).forEach(nId => {
          if (nodes[nId].parentId === parentId) {
            descendants.push(nId);
            // Recursively get children of this node
            descendants.push(...getAllDescendants(nId, nodes));
          }
        });
        return descendants;
      };

      // Get all descendant nodes recursively
      const descendantIds = getAllDescendants(nodeId, state.nodes);
      console.log(`🗑️ Found ${descendantIds.length} descendant nodes to delete`);

      // Remove the node and all its descendants
      const updatedNodes = { ...state.nodes };
      delete updatedNodes[nodeId];
      descendantIds.forEach(id => {
        delete updatedNodes[id];
      });

      // Remove node from parent's children array
      const parentId = nodeToDelete.parentId;
      if (parentId && updatedNodes[parentId]) {
        updatedNodes[parentId] = {
          ...updatedNodes[parentId],
          children: updatedNodes[parentId].children.filter(id => id !== nodeId)
        };
      }

      // Also remove any connection nodes that reference this deleted node
      const allDeletedIds = [nodeId, ...descendantIds];
      Object.keys(updatedNodes).forEach(nId => {
        const node = updatedNodes[nId];
        if (node.isConnectionNode && node.connectionNodes) {
          // Check if any connected nodes were deleted
          const hasDeletedConnection = node.connectionNodes.some(connId =>
            allDeletedIds.includes(connId)
          );
          if (hasDeletedConnection) {
            delete updatedNodes[nId];
          }
        }
      });

      // Clear selection if we're deleting the selected node or any of its descendants
      const isSelectedDeleted = state.selectedId === nodeId ||
                                (state.selectedId && descendantIds.includes(state.selectedId));
      const updatedSelectedId = isSelectedDeleted ? null : state.selectedId;

      console.log(`✅ Deleted node ${nodeId} and ${descendantIds.length} descendants`);

      return {
        nodes: updatedNodes,
        selectedId: updatedSelectedId,
        showContentOverlay: updatedSelectedId === null ? false : state.showContentOverlay,
        showReplyModal: updatedSelectedId === null ? false : state.showReplyModal
      };
    });

    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
  },
}));