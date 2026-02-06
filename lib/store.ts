import { create } from 'zustand';
import { Node, NodeType, ApplicationEssay, UniverseRun, StudyGuideWriteUp } from './types';
import { generateSemanticTitle, generateSemanticTitles } from './titleGenerator';
import { db, saveUniverse, loadAllUniverses, deleteUniverseFromDB, createBackup, saveToCloud, loadFromCloud } from './db';
import { transformConversation, transformHighlightImport, HighlightImportData } from './conversationTransformer';

// 🐛 DEBUG HELPERS - Accessible in browser console via window.auroraDebug
if (typeof window !== 'undefined') {
  (window as any).auroraDebug = {
    showLibrary: () => {
      const data = localStorage.getItem('aurora-portal-data');
      if (!data) {
        console.log('📚 No aurora-portal-data found in localStorage');
        return;
      }
      const parsed = JSON.parse(data);
      const library = parsed.universeLibrary || {};
      console.log('📚 ==========================================');
      console.log('📚 AURORA LIBRARY');
      console.log('📚   Total universes:', Object.keys(library).length);
      console.table(Object.entries(library).map(([id, data]: any) => ({
        id: id.substring(0, 20) + '...',
        title: data.title,
        nexuses: data.nexuses?.length || 0,
        nodes: Object.keys(data.nodes || {}).length,
        modified: new Date(data.lastModified).toLocaleString()
      })));
      console.log('📚 ==========================================');
      return library;
    },
    showFolders: () => {
      console.log('📁 ==========================================');
      console.log('📁 FOLDER DIAGNOSTICS');

      // Check localStorage
      const data = localStorage.getItem('aurora-portal-data');
      if (!data) {
        console.log('📁 ❌ No aurora-portal-data found in localStorage');
        return;
      }
      const parsed = JSON.parse(data);
      const foldersInStorage = parsed.folders || {};
      console.log('📁 Folders in localStorage:', Object.keys(foldersInStorage).length);
      Object.entries(foldersInStorage).forEach(([id, folder]: any) => {
        console.log(`📁   - ${folder.name} (${folder.color}) [${id}]`);
      });

      // Check current Zustand state
      const store = (window as any).auroraStore;
      if (store) {
        const currentFolders = store.getState().folders;
        console.log('📁 Folders in current state:', Object.keys(currentFolders).length);
        Object.entries(currentFolders).forEach(([id, folder]: any) => {
          console.log(`📁   - ${folder.name} (${folder.color}) [${id}]`);
        });
      }

      console.log('📁 ==========================================');
      return { storage: foldersInStorage, state: store?.getState().folders };
    },
    clearLibrary: () => {
      localStorage.removeItem('aurora-portal-data');
      console.log('🗑️ Library cleared from localStorage');
    },
    recoverLibrary: () => {
      console.log('🛡️ Attempting to recover library from backup...');
      const store = (window as any).auroraStore;
      if (store) {
        return store.getState().recoverFromBackup();
      } else {
        console.error('❌ Store not available yet');
        return false;
      }
    },
    cleanupOrphaned: () => {
      console.log('🧹 Cleaning up orphaned universes...');
      const store = (window as any).auroraStore;
      if (store) {
        const result = store.getState().cleanupOrphanedUniverses();
        console.log(`✅ Deleted ${result.deleted} orphaned universes`);
        return result;
      } else {
        console.error('❌ Store not available yet');
        return { deleted: 0, migrated: 0 };
      }
    },
    fixOrphaned: () => {
      console.log('🔧 Fixing orphaned universes...');
      const store = (window as any).auroraStore;
      if (store) {
        const count = store.getState().fixOrphanedUniverses();
        console.log(`✅ Fixed ${count} orphaned universes`);
        return count;
      } else {
        console.error('❌ Store not available yet');
        return 0;
      }
    },
    showActive: () => {
      // Note: This function needs to be called after the store is created
      // It will be updated after store creation to have proper access
      console.log('⚠️ Store access not yet available - will be enabled after store creation');
      console.log('   Try refreshing the page or check back in a moment');
    },
    dumpRaw: () => {
      const data = localStorage.getItem('aurora-portal-data');
      if (!data) {
        console.log('No data found');
        return null;
      }
      const parsed = JSON.parse(data);
      console.log('Raw aurora-portal-data:', parsed);
      return parsed;
    },
    checkNow: () => {
      console.log('🔍 ==========================================');
      console.log('🔍 DIAGNOSTIC CHECK:', new Date().toLocaleTimeString());
      const data = localStorage.getItem('aurora-portal-data');
      if (!data || data === 'null') {
        console.log('🔍 ❌ NO DATA IN LOCALSTORAGE!');
        console.log('🔍 ==========================================');
        return null;
      }
      const parsed = JSON.parse(data);
      const universeCount = Object.keys(parsed.universeLibrary || {}).length;
      console.log('🔍 ✅ Data exists:', universeCount, 'universes');
      console.log('🔍 Data size:', (data.length / 1024).toFixed(2), 'KB');
      console.log('🔍 Timestamp:', parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : 'none');
      console.log('🔍 ==========================================');
      return parsed;
    },
    watchChanges: () => {
      console.log('👁️ STARTING LOCALSTORAGE WATCH MODE');
      console.log('👁️ Will log all changes to aurora-portal-data');
      let lastValue = localStorage.getItem('aurora-portal-data');
      const interval = setInterval(() => {
        const currentValue = localStorage.getItem('aurora-portal-data');
        if (currentValue !== lastValue) {
          console.log('🚨 ==========================================');
          console.log('🚨 LOCALSTORAGE CHANGED!', new Date().toLocaleTimeString());
          console.log('🚨 Previous:', lastValue ? `${(lastValue.length / 1024).toFixed(2)}KB` : 'null');
          console.log('🚨 Current:', currentValue ? `${(currentValue.length / 1024).toFixed(2)}KB` : 'null');
          if (!currentValue || currentValue === 'null') {
            console.log('🚨 ❌❌❌ DATA WAS CLEARED OR SET TO NULL! ❌❌❌');
            console.trace('Call stack at time of detection:');
          }
          console.log('🚨 ==========================================');
          lastValue = currentValue;
        }
      }, 1000);
      console.log('👁️ Watching every 1 second. Call clearInterval(' + interval + ') to stop');
      return interval;
    },
    checkQuota: () => {
      console.log('💾 ==========================================');
      console.log('💾 LOCALSTORAGE QUOTA CHECK');
      console.log('💾 ==========================================');

      try {
        // Calculate total localStorage size
        let totalSize = 0;
        let auroraSize = 0;

        for (const key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            const itemSize = localStorage.getItem(key)?.length || 0;
            totalSize += itemSize + key.length;

            if (key === 'aurora-portal-data') {
              auroraSize = itemSize;
            }
          }
        }

        // Convert to human-readable format
        const formatBytes = (bytes: number) => {
          if (bytes < 1024) return bytes + ' B';
          if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
          return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        };

        // Typical localStorage limit is 5-10 MB (varies by browser)
        // We'll use 5MB as conservative estimate
        const estimatedLimit = 5 * 1024 * 1024; // 5MB in bytes
        const percentUsed = (totalSize / estimatedLimit * 100).toFixed(2);
        const auroraPercent = (auroraSize / estimatedLimit * 100).toFixed(2);

        console.log('💾 Total localStorage usage:');
        console.log('💾   Size:', formatBytes(totalSize));
        console.log('💾   Estimated % of 5MB limit:', percentUsed + '%');
        console.log('💾');
        console.log('💾 Aurora Portal data:');
        console.log('💾   Size:', formatBytes(auroraSize));
        console.log('💾   % of total storage:', (auroraSize / totalSize * 100).toFixed(2) + '%');
        console.log('💾   % of 5MB limit:', auroraPercent + '%');

        // Get universe details
        const auroraData = localStorage.getItem('aurora-portal-data');
        if (auroraData) {
          const parsed = JSON.parse(auroraData);
          const universeCount = Object.keys(parsed.universeLibrary || {}).length;
          const avgPerUniverse = universeCount > 0 ? auroraSize / universeCount : 0;

          console.log('💾');
          console.log('💾 Universe breakdown:');
          console.log('💾   Total universes:', universeCount);
          console.log('💾   Average per universe:', formatBytes(avgPerUniverse));

          // Show largest universes
          const universes = Object.entries(parsed.universeLibrary || {}).map(([id, data]: any) => {
            const universeStr = JSON.stringify(data);
            return {
              id: id.substring(0, 30),
              title: data.title,
              size: universeStr.length,
              sizeFormatted: formatBytes(universeStr.length),
              nodes: Object.keys(data.nodes || {}).length
            };
          }).sort((a, b) => b.size - a.size);

          if (universes.length > 0) {
            console.log('💾');
            console.log('💾 Largest universes:');
            console.table(universes.slice(0, 5));
          }
        }

        console.log('💾');
        console.log('💾 Storage health:');

        if (parseFloat(percentUsed) < 50) {
          console.log('💾   ✅ HEALTHY - Plenty of space available');
        } else if (parseFloat(percentUsed) < 80) {
          console.log('💾   ⚠️ WARNING - Approaching capacity');
          console.log('💾   Consider deleting old universes');
        } else {
          console.log('💾   🔴 CRITICAL - Storage nearly full!');
          console.log('💾   Delete universes ASAP or you may lose data');
        }

        console.log('💾');
        console.log('💾 Note: Actual localStorage limit varies by browser');
        console.log('💾   Chrome/Edge: ~10MB per domain');
        console.log('💾   Firefox: ~10MB per domain');
        console.log('💾   Safari: ~5MB per domain (more restrictive)');
        console.log('💾 ==========================================');

        return {
          totalSize,
          auroraSize,
          percentUsed: parseFloat(percentUsed),
          auroraPercent: parseFloat(auroraPercent),
          formatted: {
            total: formatBytes(totalSize),
            aurora: formatBytes(auroraSize)
          }
        };

      } catch (error) {
        console.error('💾 ❌ Error checking quota:', error);
        console.log('💾 ==========================================');
        return null;
      }
    }
  };

  // 🚨 LOCALSTORAGE INTERCEPTORS - Track all operations with call stacks
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  const originalClear = localStorage.clear.bind(localStorage);

  localStorage.setItem = function (key: string, value: string) {
    if (key === 'aurora-portal-data') {
      const stack = new Error().stack || '';
      const caller = stack.split('\n')[2]?.trim() || 'unknown';
      console.log('📝 ==========================================');
      console.log('📝 LOCALSTORAGE.SETITEM:', new Date().toLocaleTimeString());
      console.log('📝   Key:', key);
      console.log('📝   Size:', (value.length / 1024).toFixed(2), 'KB');
      console.log('📝   Called from:', caller);
      console.log('📝 Full call stack:', stack);
      console.log('📝 ==========================================');
    }
    return originalSetItem(key, value);
  };

  localStorage.removeItem = function (key: string) {
    if (key === 'aurora-portal-data') {
      const stack = new Error().stack || '';
      const caller = stack.split('\n')[2]?.trim() || 'unknown';
      console.log('🗑️ ==========================================');
      console.log('🗑️ LOCALSTORAGE.REMOVEITEM:', new Date().toLocaleTimeString());
      console.log('🗑️   Key:', key);
      console.log('🗑️   ⚠️ AURORA DATA BEING REMOVED!');
      console.log('🗑️   Called from:', caller);
      console.log('🗑️ Full call stack:', stack);
      console.log('🗑️ ==========================================');
    }
    return originalRemoveItem(key);
  };

  localStorage.clear = function () {
    const stack = new Error().stack || '';
    const caller = stack.split('\n')[2]?.trim() || 'unknown';
    console.log('🔥 ==========================================');
    console.log('🔥 LOCALSTORAGE.CLEAR:', new Date().toLocaleTimeString());
    console.log('🔥   ⚠️⚠️⚠️ ALL DATA BEING CLEARED! ⚠️⚠️⚠️');
    console.log('🔥   Called from:', caller);
    console.log('🔥 Full call stack:', stack);
    console.log('🔥 ==========================================');
    return originalClear();
  };

  console.log('🚨 localStorage interceptors installed! All aurora-portal-data operations will be logged.');

  // Log helper availability
  console.log('🐛 Aurora Debug helpers loaded! Try:');
  console.log('   auroraDebug.showLibrary()  - View all saved universes');
  console.log('   auroraDebug.showActive()   - View current canvas state');
  console.log('   auroraDebug.checkNow()     - Check localStorage right now');
  console.log('   auroraDebug.watchChanges() - Watch for changes every 1 second');
  console.log('   auroraDebug.checkQuota()   - Check localStorage usage & quota');
  console.log('   auroraDebug.clearLibrary() - Clear all saved data');
  console.log('   auroraDebug.dumpRaw()      - Dump raw localStorage data');
}

type NexusEvolutionState = 'seed' | 'growing' | 'application-lab';

interface ApplicationLabConfig {
  doctrineSummary: string;
  scenarios: {
    id: string;
    prompt: string;
    guidance?: string;
  }[];
  finalEssayPrompt: string;
  rubric?: string;
}

interface Nexus {
  id: string;
  position: [number, number, number];
  content: string;
  title: string;
  videoUrl?: string;
  audioUrl?: string;
  type?: 'academic' | 'social';
  applicationEssay?: ApplicationEssay;  // For course mode: application essay question and rubric

  // 🌱 EVOLVING NEXUS → APPLICATION LAB - Tracks learning progression
  evolutionState?: NexusEvolutionState;
  originalContent?: string | null;     // Preserves original professor/AI framing
  applicationLabConfig?: ApplicationLabConfig | null;  // Generated Application Lab content
  needsApplicationLab?: boolean;       // Flag to trigger Application Lab generation
}

interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

interface UniverseData {
  nexuses: Nexus[];
  nodes: { [id: string]: Node };
  cameraPosition: [number, number, number];
  title: string;
  createdAt: number;
  lastModified: number;
  folderId?: string;
  courseMode?: boolean; // Flag to identify course universes
  courseSettings?: {
    memoryActivation: boolean;
    mcqCount: number;
    shortAnswerCount: number;
  };

  // 🎓 UNIVERSE RUNS & STUDY GUIDES
  runs?: UniverseRun[];                    // All practice runs for this universe
  currentRunId?: string;                    // Active run ID (if in progress)
  writeUps?: StudyGuideWriteUp[];          // Generated study guides from completed runs
}

interface UniverseSnapshot {
  nexuses: Nexus[];
  nodes: { [id: string]: Node };
  createdAt: number;
}

interface CanvasStore {
  // 🌌 UNIVERSE LIBRARY - Each universe stored separately
  activeUniverseId: string | null; // Deprecated: use activeUniverseIds for multi-universe
  activeUniverseIds: string[]; // NEW: Array of currently active universe IDs
  universeLibrary: { [id: string]: UniverseData };

  // 📸 ORIGINAL SNAPSHOTS - Store initial state of universes for true revert
  originalSnapshots: { [universeId: string]: UniverseSnapshot };

  // 📁 FOLDER SYSTEM
  folders: { [id: string]: Folder };

  // Current canvas state (what's visible)
  nexuses: Nexus[];
  nodes: { [id: string]: Node };
  selectedId: string | null;
  showContentOverlay: boolean;
  isAnimatingCamera: boolean;
  showReplyModal: boolean;
  quotedText: string | null;
  hoveredNodeId: string | null;
  connectionModeNodeA: string | null;
  connectionModeActive: boolean;


  selectedNodesForConnection: string[];
  createNexus: (title: string, content: string, videoUrl?: string, audioUrl?: string) => void;
  loadAcademicPaper: () => void;
  loadAcademicPaperFromData: (data: any) => void;
  loadConversationFromData: (data: any) => string | null;
  addHighlightToUniverse: (data: HighlightImportData) => string | null;
  updateNodeContent: (nodeId: string, newContent: string) => void;
  updateNexusContent: (nexusId: string, newContent: string) => void;
  updateNodeSemanticTitle: (nodeId: string, semanticTitle: string) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  exportToWordDoc: () => void;
  addNode: (content: string, parentId: string, quotedText?: string, nodeType?: NodeType, explicitSiblingIndex?: number) => string;
  addNodes: (nodes: { content: string; parentId: string; quotedText?: string; nodeType?: NodeType }[]) => string[];
  createChatNexus: (title: string, userMessage: string, aiResponse: string) => void;
  addUserMessage: (content: string, parentId: string) => string;
  addAIMessage: (content: string, parentId: string) => string;
  addSynthesisNode: (content: string, parentId: string) => string;
  selectNode: (id: string | null, showOverlay?: boolean) => void;
  setShowContentOverlay: (show: boolean) => void;
  setIsAnimatingCamera: (isAnimating: boolean) => void;
  setShowReplyModal: (show: boolean) => void;
  setQuotedText: (text: string | null) => void;
  setHoveredNode: (id: string | null) => void;
  startConnectionMode: (nodeId: string) => void;
  clearConnectionMode: () => void;

  createConnection: (nodeAId: string, nodeBId: string) => void;
  addNodeToConnection: (nodeId: string) => void;
  createMultiConnection: (nodeIds: string[]) => void;
  createMetaInspirationNode: (nexusId: string) => string;
  getNodesByParent: (parentId: string | null) => Node[];
  getNodeLevel: (nodeId: string) => number;
  getNexusForNode: (nodeId: string) => Nexus | null;

  // 🌱 EVOLVING NEXUS → APPLICATION LAB - Completion heuristics
  getNodesForNexus: (nexusId: string) => Node[];
  isNexusCompleted: (nexusId: string) => boolean;
  setNexusApplicationLab: (nexusId: string, config: ApplicationLabConfig) => void;
  addNodeFromWebSocket: (data: any) => void;
  addNexusFromWebSocket: (data: any) => void;
  activatedConversations: string[];
  toggleActivateConversation: (nexusId: string) => void;
  getActivatedConversations: () => Nexus[];
  deleteConversation: (nexusId: string) => void;
  deleteUniverseById: (universeId: string) => void;
  getNodeChildrenCount: (nodeId: string) => number;
  deleteNode: (nodeId: string) => void;
  reparentNode: (nodeId: string, newParentId: string, newPosition: [number, number, number]) => void;

  // 🎯 QUIZ COMPLETION & UNLOCK SYSTEM
  markNodeCompleted: (nodeId: string) => boolean; // Mark node as completed and unlock next
  unlockNextNode: (currentNodeId: string) => string | null; // Unlock next L1 sibling, return unlocked node ID or null

  // 🎓 UNIVERSE RUNS & STUDY GUIDES
  startUniverseRun: (universeId?: string) => string; // Start a new practice run, returns run ID
  getCurrentRun: (universeId?: string) => UniverseRun | null; // Get current in-progress run
  addIntuitionResponse: (runId: string, response: import('./types').IntuitionResponse) => void;
  addImitationAttempt: (runId: string, attempt: import('./types').ImitationAttempt) => void;
  addQuizResult: (runId: string, result: import('./types').QuizResult) => void;
  addSynthesisAnalysis: (runId: string, analysis: import('./types').SynthesisAnalysis) => void;
  completeUniverseRun: (runId: string) => void; // Mark run as completed and calculate metrics
  saveStudyGuideWriteUp: (writeUp: StudyGuideWriteUp) => void; // Save generated write-up
  getUniverseWriteUps: (universeId?: string) => StudyGuideWriteUp[]; // Get all write-ups for a universe
  resetUniverseForPractice: (universeId?: string) => string | undefined; // Clear progress for a fresh run, returns new run ID

  // 📸 SNAPSHOT SYSTEM
  createSnapshot: (universeId: string) => void;
  revertToOriginal: (universeId: string) => void;

  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;

  // 🛡️ BACKUP & RECOVERY
  backupLibrary: () => void;
  recoverFromBackup: () => boolean;

  // ⚓ ANCHOR SYSTEM
  toggleAnchor: (nodeId: string) => void;
  getAnchoredNodes: () => Node[];

  // 🌌 UNIVERSE MANAGEMENT
  saveCurrentUniverse: (cameraPosition?: [number, number, number]) => void;
  clearCanvas: () => void;
  loadUniverse: (universeId: string) => void;
  normalizeUniverseCoordinates: (universeData: UniverseData) => UniverseData;
  renameUniverse: (universeId: string, newTitle: string) => boolean;

  // 🌌 MULTI-UNIVERSE MANAGEMENT
  toggleUniverseActive: (universeId: string) => void;
  loadMultipleUniverses: (universeIds: string[]) => void;
  calculateUniversePosition: (index: number, total: number) => [number, number, number];

  // 📁 FOLDER MANAGEMENT
  createFolder: (name: string, color: string) => string;
  renameFolder: (folderId: string, newName: string) => void;
  deleteFolder: (folderId: string) => void;
  moveUniverseToFolder: (universeId: string, folderId: string) => void;
  cleanupOrphanedUniverses: () => { deleted: number; migrated: number };
  fixOrphanedUniverses: () => number;

  // 🔬 ATOMIZE UNIVERSE
  atomizeUniverse: (
    universeId: string,
    onProgress?: (current: number, total: number, status: string, errors: string[]) => void
  ) => Promise<{ success: boolean; newUniverseIds: string[]; error?: string; errors: string[] }>;

  // 🧠 UNIVERSE ACTIVATION (for GAP Mode cross-universe analysis)
  activatedUniverseIds: string[];
  maxActivatedUniverses: number;
  activateUniverse: (universeId: string) => boolean; // Returns false if limit reached
  deactivateUniverse: (universeId: string) => void;
  clearActivatedUniverses: () => void;
  isUniverseActivated: (universeId: string) => boolean;
  getL1Nodes: (universeId: string) => Node[];

  // 🏛️ MEMORY PALACE MODE
  isMemoryPalaceMode: boolean;
  memoryPalaceCurrentIndex: number;
  isTransitioning: boolean;
  toggleMemoryPalaceMode: () => void;
  navigateToNextNode: () => void;
  navigateToPreviousNode: () => void;
  setMemoryPalaceIndex: (index: number) => void;
  setIsTransitioning: (isTransitioning: boolean) => void;

  // 🔬 APPLICATION LAB MODE
  isApplicationLabMode: boolean;
  toggleApplicationLabMode: () => void;
  enableApplicationLabMode: () => void;
  disableApplicationLabMode: () => void;
  applicationLabAnalysis: {
    topics: Array<{ id: string; name: string; description: string; nodeIds: string[] }>;
    cases: Array<{ id: string; name: string; summary: string; nodeIds: string[] }>;
    doctrines: Array<{ id: string; name: string; explanation: string; nodeIds: string[] }>;
    analyzedAt: number | null;
  } | null;
  isAnalyzingUniverse: boolean;
  analyzeUniverseContent: () => Promise<void>;

  // 🛡️ INITIALIZATION TRACKING
  isStoreInitialized: boolean;

  buildGraphStructure: () => { currentGraph: any; activatedGraphs: any[]; hasMultipleUniverses: boolean } | null;
  buildConversationContext: () => string;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // 🌌 UNIVERSE LIBRARY - Start with blank canvas
  activeUniverseId: null,
  activeUniverseIds: [], // NEW: Start with no active universes
  universeLibrary: {},

  // 📸 ORIGINAL SNAPSHOTS - Start with no snapshots
  originalSnapshots: {},

  // 🧠 UNIVERSE ACTIVATION - For GAP Mode cross-universe analysis
  activatedUniverseIds: [],
  maxActivatedUniverses: 5,

  // 🏛️ MEMORY PALACE MODE
  isMemoryPalaceMode: false,
  memoryPalaceCurrentIndex: 0,
  isTransitioning: false,

  // 🔬 APPLICATION LAB MODE
  isApplicationLabMode: false,
  applicationLabAnalysis: null,
  isAnalyzingUniverse: false,

  // 🛡️ INITIALIZATION TRACKING - Prevent saves before load completes
  isStoreInitialized: false,

  // 📁 FOLDER SYSTEM - Start with default folder
  folders: {
    'default': {
      id: 'default',
      name: 'Uncategorized',
      color: '#6B7280',
      createdAt: Date.now()
    }
  },

  // Current canvas state (empty on startup)
  nexuses: [],
  nodes: {},
  selectedId: null,
  showContentOverlay: false,
  isAnimatingCamera: false,
  showReplyModal: false,
  quotedText: null,
  hoveredNodeId: null,
  activatedConversations: [],
  connectionModeNodeA: null,
  connectionModeActive: false,
  selectedNodesForConnection: [],



  // 💾 SAVE TO LOCALSTORAGE + INDEXEDDB
  saveToLocalStorage: async () => {
    const state = get();

    // 🔍 DIAGNOSTIC: Capture call stack to see who triggered this save
    const saveStack = new Error().stack || '';
    const saveCaller = saveStack.split('\n')[2]?.trim() || 'unknown';

    // 🛡️ CRITICAL: Don't save if store hasn't been initialized yet (prevents race conditions)
    if (!state.isStoreInitialized) {
      console.warn('⏸️ SKIPPING SAVE: Store not yet initialized (race condition protection)');
      console.warn('⏸️ Save was called from:', saveCaller);
      return;
    }

    // 🛡️ CRITICAL: Backup existing library before any save operation
    get().backupLibrary();

    // 🛡️ CRITICAL: Verify we have data to save
    if (!state.universeLibrary || typeof state.universeLibrary !== 'object') {
      console.error('❌ REFUSING TO SAVE: universeLibrary is invalid!');
      console.error('❌ Save was called from:', saveCaller);
      return;
    }

    // 🛡️ CRITICAL: Never save empty library if one already exists
    const existingData = localStorage.getItem('aurora-portal-data');
    if (existingData && existingData !== 'null') {
      try {
        const existing = JSON.parse(existingData);
        const existingCount = Object.keys(existing.universeLibrary || {}).length;
        const newCount = Object.keys(state.universeLibrary).length;

        if (existingCount > 0 && newCount === 0) {
          console.error('❌ REFUSING TO SAVE: Would overwrite', existingCount, 'universes with empty library!');
          console.error('❌ If you want to clear the library, use window.auroraDebug.clearLibrary()');
          return;
        }
      } catch (e) {
        console.warn('⚠️ Could not parse existing data, proceeding with save');
      }
    }

    const dataToSave = {
      universeLibrary: state.universeLibrary,
      originalSnapshots: state.originalSnapshots,
      folders: state.folders,
      activatedConversations: state.activatedConversations,
      timestamp: Date.now(),
    };

    try {
      const serialized = JSON.stringify(dataToSave);

      // 🛡️ CRITICAL: Verify serialization didn't produce 'null' or empty
      if (serialized === 'null' || serialized === '{}' || serialized === '{"universeLibrary":{},"activatedConversations":[]}') {
        console.error('❌ REFUSING TO SAVE: Serialized data is empty or null!');
        return;
      }

      // 💾 Save to localStorage (backwards compatibility)
      localStorage.setItem('aurora-portal-data', serialized);

      // 💾 Save each universe to IndexedDB
      const universeCount = Object.keys(state.universeLibrary).length;
      for (const [id, universeData] of Object.entries(state.universeLibrary)) {
        await saveUniverse(id, universeData);
        // ☁️ Sync to Cloud (NeonDB)
        await saveToCloud(id, universeData, universeData.nexuses[0]?.videoUrl);
      }

      // 💾 Create backup snapshot every 5 saves
      const saveCounter = (window as any)._auroraSaveCount || 0;
      (window as any)._auroraSaveCount = saveCounter + 1;
      if ((window as any)._auroraSaveCount % 5 === 0) {
        await createBackup(dataToSave, 'auto');
      }

      // Comprehensive logging
      const foldersCount = Object.keys(state.folders).length;
      console.log('💾 ==========================================');
      console.log('💾 SAVE TO STORAGE:', new Date().toLocaleTimeString());
      console.log('💾 🔍 Called from:', saveCaller);
      console.log('💾 Universes in library:', universeCount);
      if (universeCount > 0) {
        Object.entries(state.universeLibrary).forEach(([id, data]) => {
          console.log(`💾   - ${data.title} (${data.nexuses.length} nexuses, ${Object.keys(data.nodes).length} nodes)`);
        });
      }
      console.log('💾 Folders:', foldersCount);
      if (foldersCount > 0) {
        Object.values(state.folders).forEach((folder: any) => {
          console.log(`💾   - ${folder.name} (${folder.color})`);
        });
      }
      console.log('💾 Data size:', (serialized.length / 1024).toFixed(2), 'KB');
      console.log('💾 Storage: localStorage + IndexedDB');
      console.log('💾 ==========================================');

      // 🔍 DIAGNOSTIC: Verify save worked by reading back
      const verification = localStorage.getItem('aurora-portal-data');
      if (!verification) {
        throw new Error('Save verification failed - data not in localStorage!');
      }
      const verifiedData = JSON.parse(verification);
      const verifiedCount = Object.keys(verifiedData.universeLibrary || {}).length;
      const verifiedFoldersCount = Object.keys(verifiedData.folders || {}).length;
      console.log('💾 ✅ VERIFICATION: Data confirmed in both storages');
      console.log('💾    - Universes:', verifiedCount);
      console.log('💾    - Folders:', verifiedFoldersCount);

      if (verifiedCount !== universeCount) {
        console.error('💾 🚨 VERIFICATION MISMATCH! Saved', universeCount, 'universes but found', verifiedCount);
      }
      if (verifiedFoldersCount !== foldersCount) {
        console.error('💾 🚨 VERIFICATION MISMATCH! Saved', foldersCount, 'folders but found', verifiedFoldersCount);
      }
    } catch (error) {
      console.error('❌ ==========================================');
      console.error('❌ CRITICAL: Failed to save to storage:', error);
      console.error('❌ ==========================================');

      // Alert user of data loss risk
      if (typeof window !== 'undefined') {
        alert('⚠️ WARNING: Failed to save your universe!\n\nYour changes may be lost. Please:\n1. Take a screenshot\n2. Copy your content\n3. Refresh the page\n\nError: ' + (error as Error).message);
      }
    }
  },

  // 📂 LOAD FROM INDEXEDDB + LOCALSTORAGE (with migration)
  loadFromLocalStorage: async () => {
    // Skip if running on server-side
    if (typeof window === 'undefined') {
      console.log('📂 Skipping load on server-side');
      return;
    }

    try {
      // 🔍 DIAGNOSTIC: Capture call stack
      const loadStack = new Error().stack || '';
      const loadCaller = loadStack.split('\n')[2]?.trim() || 'unknown';

      console.log('📂 ==========================================');
      console.log('📂 LOAD FROM STORAGE:', new Date().toLocaleTimeString());
      console.log('📂 🔍 Called from:', loadCaller);

      // Try IndexedDB first
      let universeLibrary = await loadAllUniverses();
      let folders: any = {};
      let activatedConversations: string[] = [];
      let originalSnapshots: { [id: string]: UniverseSnapshot } = {};

      // ☁️ Try loading from Cloud (NeonDB)
      try {
        const cloudUniverses = await loadFromCloud();
        if (cloudUniverses) {
          console.log('☁️ Merging cloud universes with local data...');
          // Merge cloud universes into local library
          // Cloud data takes precedence if timestamps are newer (TODO: Implement proper conflict resolution)
          // For now, we'll just add missing universes or update existing ones
          universeLibrary = { ...universeLibrary, ...cloudUniverses };
        }
      } catch (cloudError) {
        console.warn('☁️ Failed to load from cloud (user might be offline or not logged in):', cloudError);
      }

      // If IndexedDB is empty, try localStorage as fallback and migrate
      if (Object.keys(universeLibrary).length === 0) {
        console.log('📂 IndexedDB empty, checking localStorage for migration...');

        const saved = localStorage.getItem('aurora-portal-data');

        console.log('📂 Raw data status:', saved === null ? 'NULL' : saved === 'null' ? '"null" STRING' : 'EXISTS');
        if (saved) {
          console.log('📂 Raw data size:', (saved.length / 1024).toFixed(2), 'KB');
        }

        // 🛡️ CRITICAL: Check for corrupted data (null string)
        if (saved === 'null' || saved === null) {
          console.error('🚨 LIBRARY IS NULL OR CORRUPTED! Attempting recovery...');
          console.error('🚨 Load was called from:', loadCaller);

          // Try to recover from backup
          const recovered = get().recoverFromBackup();

          if (recovered) {
            console.log('✅ Recovered from backup! Reloading...');
            // Recursively call loadFromLocalStorage after recovery
            await get().loadFromLocalStorage();
            return;
          } else {
            console.error('❌ No backup available - starting with empty library');
            console.log('📂 Starting with blank canvas and empty library');
            console.log('📂 ==========================================');
            set({ isStoreInitialized: true });
            return;
          }
        }

        if (!saved) {
          console.log('📂 No saved data found in any storage');
          console.log('📂 Starting with blank canvas and empty library');
          console.log('📂 ==========================================');

          // Initialize with default folder
          set({
            universeLibrary: {},
            folders: {
              'default': {
                id: 'default',
                name: 'Uncategorized',
                color: '#6B7280',
                createdAt: Date.now()
              }
            },
            activatedConversations: [],
            nexuses: [],
            nodes: {},
            activeUniverseId: null,
            isStoreInitialized: true,
          });
          return;
        }

        const data = JSON.parse(saved);

        // 🛡️ CRITICAL: Verify data structure
        if (!data || typeof data !== 'object') {
          console.error('🚨 DATA IS CORRUPTED! Attempting recovery...');
          const recovered = get().recoverFromBackup();
          if (recovered) {
            await get().loadFromLocalStorage();
            return;
          }
          throw new Error('Data is corrupted and no backup available');
        }

        // 🛡️ CRITICAL: Verify universeLibrary exists
        if (!data.universeLibrary || typeof data.universeLibrary !== 'object') {
          console.error('🚨 UNIVERSE LIBRARY IS MISSING OR CORRUPTED! Attempting recovery...');
          const recovered = get().recoverFromBackup();
          if (recovered) {
            await get().loadFromLocalStorage();
            return;
          }
          console.warn('⚠️ No backup - initializing empty library');
          data.universeLibrary = {};
        }

        // Migrate from localStorage to IndexedDB
        universeLibrary = data.universeLibrary || {};
        folders = data.folders || {};
        activatedConversations = data.activatedConversations || [];
        originalSnapshots = data.originalSnapshots || {};

        console.log('📂 🔍 MIGRATION: Folders from localStorage:', Object.keys(folders).length);
        if (Object.keys(folders).length > 0) {
          Object.entries(folders).forEach(([id, folder]: [string, any]) => {
            console.log(`📂 🔍 MIGRATION:   - ${folder.name} [${id}]`);
          });
        }

        const universeCount = Object.keys(universeLibrary).length;
        if (universeCount > 0) {
          console.log('⚙️ MIGRATING', universeCount, 'universes from localStorage to IndexedDB...');

          for (const [id, universeData] of Object.entries(universeLibrary)) {
            await saveUniverse(id, universeData);
          }

          console.log('✅ Migration complete!');
        }
      } else {
        // Load folders, snapshots and activated conversations from localStorage (could move to IndexedDB later)
        console.log('📂 IndexedDB has universes, loading folders from localStorage...');
        const localData = localStorage.getItem('aurora-portal-data');
        if (localData) {
          const data = JSON.parse(localData);
          console.log('📂 🔍 Raw localStorage data.folders:', data.folders);
          console.log('📂 🔍 Folders in localStorage:', Object.keys(data.folders || {}).length);
          if (data.folders) {
            Object.entries(data.folders).forEach(([id, folder]: [string, any]) => {
              console.log(`📂 🔍   - Found: ${folder.name} [${id}]`);
            });
          }
          folders = data.folders || {};
          activatedConversations = data.activatedConversations || [];
          originalSnapshots = data.originalSnapshots || {};
        } else {
          console.warn('📂 ⚠️ No localStorage data found despite IndexedDB having universes!');
        }
      }

      const universeCount = Object.keys(universeLibrary).length;

      console.log('📂 ==========================================');
      console.log('📂 LOADED DATA SUMMARY:');
      console.log('📂 Universes in library:', universeCount);

      if (universeCount > 0) {
        Object.entries(universeLibrary).forEach(([id, uData]: [string, any]) => {
          console.log(`📂   - ${uData.title} (${uData.nexuses.length} nexuses, ${Object.keys(uData.nodes).length} nodes, folder: ${uData.folderId || 'NONE'})`);
        });
      }

      // 🔍 DIAGNOSTIC: Show what folders were loaded
      const loadedFoldersCount = Object.keys(folders).length;
      console.log('📂 Folders loaded:', loadedFoldersCount);
      if (loadedFoldersCount > 0) {
        Object.entries(folders).forEach(([id, folder]: [string, any]) => {
          console.log(`📂   - ${folder.name} (${folder.color}) [${id}]`);
        });
      } else {
        console.warn('📂 ⚠️ NO FOLDERS LOADED! This will cause folders to reset to default only.');
      }
      console.log('📂 ==========================================');

      // Ensure default folder exists
      if (!folders['default']) {
        folders = {
          ...folders,
          'default': {
            id: 'default',
            name: 'Uncategorized',
            color: '#6B7280',
            createdAt: Date.now()
          }
        };
      }

      // 🔧 MIGRATION: Ensure all universes have a folderId
      let migrationCount = 0;
      Object.keys(universeLibrary).forEach(id => {
        if (!universeLibrary[id].folderId) {
          console.log('🔧 Migrating universe without folderId:', universeLibrary[id].title);
          universeLibrary[id].folderId = 'default';
          migrationCount++;
        }
      });
      if (migrationCount > 0) {
        console.log(`✅ Migrated ${migrationCount} universes to Uncategorized folder`);
      }

      // 🔧 FIX ORPHANED: Move universes with invalid folderId to default
      const folderIds = Object.keys(folders);
      let orphanedFixed = 0;
      Object.keys(universeLibrary).forEach(id => {
        const folderId = universeLibrary[id].folderId || 'default';
        if (!folderIds.includes(folderId)) {
          console.log(`🔧 Fixing orphaned universe: "${universeLibrary[id].title}" (${folderId} → default)`);
          universeLibrary[id].folderId = 'default';
          orphanedFixed++;
        }
      });
      if (orphanedFixed > 0) {
        console.log(`✅ Auto-fixed ${orphanedFixed} orphaned universes during load`);
      }

      // 🔧 FIX CORRUPTED NEXUSES: Ensure nexuses is always an array, not an object
      let nexusesFixed = 0;
      Object.keys(universeLibrary).forEach(id => {
        const universe = universeLibrary[id];
        if (!Array.isArray(universe.nexuses)) {
          console.log(`🔧 Fixing corrupted nexuses in universe: "${universe.title}" (object → array)`);
          // Convert object to array by extracting values and filtering out undefined/null
          universe.nexuses = Object.values(universe.nexuses as any).filter((n: any) => n && n.id);
          nexusesFixed++;
        }
      });
      if (nexusesFixed > 0) {
        console.log(`✅ Auto-fixed ${nexusesFixed} universes with corrupted nexuses data`);
      }

      // 🔍 DIAGNOSTIC: Log what's about to be set in state
      console.log('📂 🔍 SETTING STATE WITH:');
      console.log('📂 🔍   - Universes:', Object.keys(universeLibrary).length);
      console.log('📂 🔍   - Folders:', Object.keys(folders).length);
      Object.entries(folders).forEach(([id, folder]: [string, any]) => {
        console.log(`📂 🔍     • ${folder.name} [${id}]`);
      });

      set({
        universeLibrary,
        originalSnapshots,
        folders,
        activatedConversations: activatedConversations || [],
        // Canvas stays blank - user loads universes from Memories
        nexuses: [],
        nodes: {},
        activeUniverseId: null,
      });

      console.log('✅ Successfully loaded universe library from IndexedDB + localStorage!');
      console.log('📂 🔍 State has been set with', universeCount, 'universes');
      console.log('📂 Canvas remains blank - load universes from Memories page');

      // 🔍 DIAGNOSTIC: Double-check the state was actually set
      setTimeout(() => {
        const currentState = get();
        const currentLibraryCount = Object.keys(currentState.universeLibrary).length;
        console.log('📂 🔍 POST-LOAD VERIFICATION:', currentLibraryCount, 'universes in state');
        if (currentLibraryCount !== universeCount) {
          console.error('📂 🚨 STATE MISMATCH! Loaded', universeCount, 'but state has', currentLibraryCount);
        }
      }, 100);

      console.log('📂 ==========================================');

      // 🛡️ Mark store as initialized - allows saves to proceed
      set({ isStoreInitialized: true });
      console.log('✅ Store initialized - saves are now enabled');

    } catch (error) {
      console.error('❌ ==========================================');
      console.error('❌ CRITICAL: Failed to load from storage:', error);
      console.error('❌ ==========================================');

      // Mark as initialized even on error to prevent blocking all future saves
      set({ isStoreInitialized: true });

      // Alert user of load failure
      if (typeof window !== 'undefined') {
        alert('⚠️ WARNING: Failed to load your saved universes!\n\nError: ' + (error as Error).message + '\n\nPlease check the browser console for details.');
      }
    }
  },

  createNexus: (title: string, content: string, videoUrl?: string, audioUrl?: string) => {
    console.log('🆕 ==========================================');
    console.log('🆕 CREATING NEW UNIVERSE:', new Date().toLocaleTimeString());
    console.log('🆕   Title:', title);
    console.log('🆕   Previous Universe ID:', get().activeUniverseId || 'none');
    console.log('🆕   Previous nexuses:', get().nexuses.length);
    console.log('🆕   Previous nodes:', Object.keys(get().nodes).length);

    // 🌌 STEP 1: Save current universe before starting a new one
    const currentState = get();
    if (currentState.nexuses.length > 0) {
      console.log('🆕   💾 Saving previous universe before creating new one...');
      get().saveCurrentUniverse();
    } else {
      console.log('🆕   ℹ️ No previous universe to save (canvas was blank)');
    }

    // 🌌 STEP 2: Clear canvas for new universe
    console.log('🆕   🧹 Clearing canvas for new universe...');
    get().clearCanvas();

    // 🌌 STEP 3: Create the new nexus
    let newNexus: Nexus | null = null;
    let newUniverseId = '';

    set((state) => {
      const position: [number, number, number] = [0, 0, 0]; // First nexus always at origin

      newUniverseId = `nexus-${Date.now()}`;
      newNexus = {
        id: newUniverseId,
        position,
        title,
        content,
        videoUrl,
        audioUrl,
        type: 'social',
        // 🌱 Initialize evolution state
        evolutionState: 'seed',
        originalContent: content, // Preserve original framing
        applicationLabConfig: null,
        needsApplicationLab: false,
      };

      console.log('🆕   🟢 Created NEW nexus with ID:', newUniverseId);

      return {
        nexuses: [newNexus], // Start fresh with just this nexus
        activeUniverseId: newUniverseId // Set as active universe
      };
    });

    // 🌌 STEP 4: Auto-save the new universe to library
    console.log('🆕   💾 Auto-saving new universe to library...');
    console.log('🆕   Active universe ID:', get().activeUniverseId);
    get().saveCurrentUniverse();
    console.log('🆕   ✅ New universe created and set as active');
    console.log('🆕 ==========================================');

    // Broadcast nexus creation to WebSocket
    if (newNexus) {
      const socket = typeof window !== 'undefined' ? (window as any).socket : null;
      if (socket) {
        socket.emit('create_nexus', {
          portalId: 'default-portal',
          ...newNexus
        });
        console.log('📤 Broadcasting nexus creation:', newNexus.id);
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
          type: 'academic',
          // 🌱 Initialize evolution state
          evolutionState: 'seed',
          originalContent: data.nexus.content,
          applicationLabConfig: null,
          needsApplicationLab: false,
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

          const x = -radius * Math.cos(angle); // Flipped: first node on left
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

    // 🌌 STEP 1: Save current universe before loading paper
    const currentState = get();
    if (currentState.nexuses.length > 0) {
      console.log('🌌 Saving current universe before loading paper...');
      get().saveCurrentUniverse();
    }

    // 🌌 STEP 2: Clear canvas for new paper
    console.log('🌌 Clearing canvas for new paper...');
    get().clearCanvas();

    const nexus: Nexus = {
      id: data.nexus.id || 'uploaded-paper-nexus',
      position: data.nexus.position || [0, 0, 0],
      title: data.nexus.title,
      content: data.nexus.content,
      type: 'academic',
      // 🌱 Initialize evolution state
      evolutionState: 'seed',
      originalContent: data.nexus.content,
      applicationLabConfig: null,
      needsApplicationLab: false,
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

      const x = -radius * Math.cos(angle); // Flipped: first node on left
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

    // 🌌 Auto-save the new paper universe to library
    console.log('🌌 Auto-saving paper universe to library...');
    get().saveCurrentUniverse();

    console.log(`✅ Loaded paper: ${nexus.title} with ${data.sections.length} sections`);

    // 📝 BATCH GENERATE SEMANTIC TITLES (async, non-blocking)
    // Generate titles for all nodes in parallel without blocking the UI
    const nodeIds = Object.keys(nodes);
    const nodeContents = nodeIds.map(id => nodes[id].content);

    console.log(`📝 Generating semantic titles for ${nodeIds.length} nodes in batch...`);

    generateSemanticTitles(nodeContents)
      .then((semanticTitles) => {
        // Update each node with its generated title
        const state = get();
        const updatedNodes = { ...state.nodes };

        nodeIds.forEach((nodeId, index) => {
          if (updatedNodes[nodeId]) {
            updatedNodes[nodeId] = {
              ...updatedNodes[nodeId],
              semanticTitle: semanticTitles[index],
            };
          }
        });

        set({ nodes: updatedNodes });
        get().saveToLocalStorage();

        console.log(`✅ Generated ${semanticTitles.length} semantic titles for paper nodes`);
      })
      .catch((error) => {
        console.error('❌ Failed to generate batch semantic titles:', error);
        // Fallback is already handled in generateSemanticTitles function
      });
  },

  loadConversationFromData: (data: any) => {
    console.log('💬 Loading conversation from imported data');

    // Save current universe before loading conversation
    const currentState = get();
    if (currentState.nexuses.length > 0) {
      console.log('🌌 Saving current universe before loading conversation...');
      get().saveCurrentUniverse();
    }

    // Clear canvas for new conversation
    console.log('🌌 Clearing canvas for conversation...');
    get().clearCanvas();

    const { nexuses, nodes, highlightNodeId } = transformConversation(data);

    set({ nexuses, nodes });

    // Auto-save the new conversation universe to library
    console.log('🌌 Auto-saving conversation universe to library...');
    get().saveCurrentUniverse();

    console.log(`✅ Loaded conversation: ${data.title} with ${data.messages.length} messages`);

    return highlightNodeId || null;
  },

  addHighlightToUniverse: (data: HighlightImportData) => {
    console.log('🔦 Adding highlight to universe:', data.title);

    const state = get();

    // Check if a nexus already exists for this conversation title
    const existingNexus = state.nexuses.find(
      (n) => n.title === data.title
    );

    if (existingNexus) {
      // Count existing L1 nodes (direct children of this nexus)
      const existingL1Count = Object.values(state.nodes).filter(
        (node) => node.parentId === existingNexus.id
      ).length;

      const { l1Node } = transformHighlightImport(data, existingL1Count);

      // Override parentId to point to the existing nexus
      l1Node.parentId = existingNexus.id;

      // Add only the new L1 node
      set((s) => ({
        nodes: { ...s.nodes, [l1Node.id]: l1Node },
      }));

      console.log(`✅ Added highlight L1 node to existing nexus "${existingNexus.title}" (L1 #${existingL1Count})`);

      get().saveCurrentUniverse();
      get().selectNode(l1Node.id, true);

      return l1Node.id;
    }

    // No existing nexus — create both nexus and L1
    const { nexus, l1Node } = transformHighlightImport(data, 0);

    set((s) => ({
      nexuses: [...s.nexuses, nexus],
      nodes: { ...s.nodes, [l1Node.id]: l1Node },
    }));

    console.log(`✅ Created new nexus "${nexus.title}" with highlight L1 node`);

    get().saveCurrentUniverse();
    get().selectNode(l1Node.id, true);

    return l1Node.id;
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

  updateNodeSemanticTitle: (nodeId: string, semanticTitle: string) => {
    set((state) => {
      const updatedNodes = { ...state.nodes };
      if (updatedNodes[nodeId]) {
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          semanticTitle,
        };
      }
      return { nodes: updatedNodes };
    });

    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();

    console.log(`✅ Updated semantic title for node ${nodeId}: "${semanticTitle}"`);
  },

  updateNode: (nodeId: string, updates: Partial<Node>) => {
    set((state) => {
      const updatedNodes = { ...state.nodes };
      if (updatedNodes[nodeId]) {
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          ...updates,
        };
      }
      return { nodes: updatedNodes };
    });

    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();

    console.log(`✅ Updated node ${nodeId}:`, updates);
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

  addNode: (content: string, parentId: string, quotedText?: string, nodeType?: NodeType, explicitSiblingIndex?: number) => {
    let newNodeId = '';
    let isConnectionNodeParent = false;

    set((state) => {
      newNodeId = `node-${Date.now()}`;

      const siblings = Object.values(state.nodes).filter(n => n.parentId === parentId);
      const siblingIndex = explicitSiblingIndex !== undefined ? explicitSiblingIndex : siblings.length;

      // Check if parent is a connection node (Socratic mode)
      const parentNode = state.nodes[parentId];
      isConnectionNodeParent = parentNode?.isConnectionNode || false;

      let position: [number, number, number];

      // SPECIAL CASE: Meta-inspiration node (vertical spiral positioning)
      if (parentNode && parentNode.id.startsWith('meta-inspiration')) {
        console.log('🌌 Adding node to meta-inspiration node - using vertical spiral');

        const metaPos = parentNode.position;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 137.5 degrees

        // Base parameters for vertical spiral
        const baseRadius = 2.0;
        const radiusIncrement = 0.3;
        const radius = baseRadius + (siblingIndex * radiusIncrement);

        // Vertical spacing
        const yIncrement = 1.5;
        const y = metaPos[1] + (siblingIndex * yIncrement);

        // Spiral angle
        const angle = siblingIndex * goldenAngle;

        // Position in horizontal plane around the meta-star
        const x = metaPos[0] - Math.cos(angle) * radius; // Flipped: first node on left
        const z = metaPos[2] + Math.sin(angle) * radius;

        position = [x, y, z];
        console.log(`🌌 Meta-gyre child ${siblingIndex}: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}], radius: ${radius.toFixed(2)}`);
      } else {
        // Normal positioning logic
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

          const x = nexusPos[0] - radius * Math.cos(angle); // Flipped: first node on left
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

          // Guard against zero-length direction vector
          if (dirLength < 0.001) {
            console.warn('⚠️ addNode: Parent at same position as nexus, using simple offset');
            position = [
              parentNode.position[0] + 2,
              parentNode.position[1] + 1,
              parentNode.position[2] + 2
            ];
          } else {
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

            // Guard against zero-length right vector (happens with vertical directions)
            if (rightLength < 0.001) {
              console.warn('⚠️ addNode: Right vector is zero-length, using alternative axis');
              rightX = 1;
              rightY = 0;
              rightZ = 0;
            } else {
              rightX /= rightLength;
              rightY /= rightLength;
              rightZ /= rightLength;
            }

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
        }
      }

      // CRITICAL: Validate position for NaN values before creating node
      if (isNaN(position[0]) || isNaN(position[1]) || isNaN(position[2])) {
        console.error('❌ CRITICAL: Position contains NaN values!', {
          position,
          parentId,
          siblingIndex,
          parentNode: state.nodes[parentId]
        });

        // Use fallback position near parent or at origin
        const parentNode = state.nodes[parentId];
        if (parentNode && !isNaN(parentNode.position[0])) {
          position = [
            parentNode.position[0] + 2,
            parentNode.position[1] + 1,
            parentNode.position[2] + 2
          ];
          console.log('🔧 Using fallback position near parent:', position);
        } else {
          position = [0, 1, 0];
          console.log('🔧 Using absolute fallback position:', position);
        }
      }

      const newNode: Node = {
        id: newNodeId,
        position,
        title: `Reply ${new Date().toLocaleTimeString()}`,
        content,
        quotedText,
        parentId,
        children: [],
        nodeType: nodeType || (isConnectionNodeParent ? 'socratic-answer' : 'user-reply'), // Default based on context
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

    // 💾 NOTE: saveToLocalStorage() removed - now only called by saveCurrentUniverse()
    // This prevents premature saves when universe isn't in library yet

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

    // 📝 GENERATE SEMANTIC TITLE (async, non-blocking)
    // Generate title in background without blocking node creation
    generateSemanticTitle(content)
      .then((semanticTitle) => {
        // Update the node with the generated title
        get().updateNodeSemanticTitle(newNodeId, semanticTitle);
        console.log(`📝 Generated semantic title for ${newNodeId}: "${semanticTitle}"`);
      })
      .catch((error) => {
        console.error(`❌ Failed to generate semantic title for ${newNodeId}:`, error);
        // Fallback is already handled in generateSemanticTitle function
      });

    return newNodeId;
  },

  addNodes: (batchNodes: { content: string; parentId: string; quotedText?: string; nodeType?: NodeType }[]) => {
    if (batchNodes.length === 0) return [];

    const timestamp = Date.now();
    const newNodeIds: string[] = [];

    set((state) => {
      const updatedNodes = { ...state.nodes };

      // Track how many siblings we've added per parent within this batch
      const batchSiblingCounts: Record<string, number> = {};

      for (let i = 0; i < batchNodes.length; i++) {
        const { content, parentId, quotedText, nodeType } = batchNodes[i];
        const newNodeId = `node-${timestamp}-${i}`;
        newNodeIds.push(newNodeId);

        // Count existing siblings + siblings already added in this batch
        const existingSiblings = Object.values(state.nodes).filter(n => n.parentId === parentId).length;
        const batchAdded = batchSiblingCounts[parentId] || 0;
        const siblingIndex = existingSiblings + batchAdded;
        batchSiblingCounts[parentId] = batchAdded + 1;

        const parentNode = updatedNodes[parentId] || state.nodes[parentId];
        const isConnectionNodeParent = parentNode?.isConnectionNode || false;

        let position: [number, number, number];

        // SPECIAL CASE: Meta-inspiration node (vertical spiral positioning)
        if (parentNode && parentNode.id.startsWith('meta-inspiration')) {
          const metaPos = parentNode.position;
          const goldenAngle = Math.PI * (3 - Math.sqrt(5));
          const baseRadius = 2.0;
          const radiusIncrement = 0.3;
          const radius = baseRadius + (siblingIndex * radiusIncrement);
          const yIncrement = 1.5;
          const y = metaPos[1] + (siblingIndex * yIncrement);
          const angle = siblingIndex * goldenAngle;
          const x = metaPos[0] - Math.cos(angle) * radius;
          const z = metaPos[2] + Math.sin(angle) * radius;
          position = [x, y, z];
        } else {
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
            const x = nexusPos[0] - radius * Math.cos(angle);
            const z = nexusPos[2] + radius * Math.sin(angle);
            position = [x, y, z];
          } else {
            const pNode = updatedNodes[parentId] || state.nodes[parentId];
            if (!pNode) continue;

            const nexus = get().getNexusForNode(parentId);
            if (!nexus) continue;

            const nexusPos = nexus.position;
            const directionX = pNode.position[0] - nexusPos[0];
            const directionY = pNode.position[1] - nexusPos[1];
            const directionZ = pNode.position[2] - nexusPos[2];
            const dirLength = Math.sqrt(directionX * directionX + directionY * directionY + directionZ * directionZ);

            if (dirLength < 0.001) {
              position = [
                pNode.position[0] + 2,
                pNode.position[1] + 1,
                pNode.position[2] + 2
              ];
            } else {
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

              if (rightLength < 0.001) {
                rightX = 1; rightY = 0; rightZ = 0;
              } else {
                rightX /= rightLength; rightY /= rightLength; rightZ /= rightLength;
              }

              const upPerpX = normDirY * rightZ - normDirZ * rightY;
              const upPerpY = normDirZ * rightX - normDirX * rightZ;
              const upPerpZ = normDirX * rightY - normDirY * rightX;
              const helixOffsetX = helixRadius * (Math.cos(angle) * rightX + Math.sin(angle) * upPerpX);
              const helixOffsetY = helixRadius * (Math.cos(angle) * rightY + Math.sin(angle) * upPerpY);
              const helixOffsetZ = helixRadius * (Math.cos(angle) * rightZ + Math.sin(angle) * upPerpZ);
              const x = pNode.position[0] + (normDirX * distance) + helixOffsetX;
              const y = pNode.position[1] + (normDirY * distance) + helixOffsetY;
              const z = pNode.position[2] + (normDirZ * distance) + helixOffsetZ;
              position = [x, y, z];
            }
          }
        }

        // Validate position for NaN values
        if (isNaN(position[0]) || isNaN(position[1]) || isNaN(position[2])) {
          const pNode = updatedNodes[parentId] || state.nodes[parentId];
          if (pNode && !isNaN(pNode.position[0])) {
            position = [pNode.position[0] + 2, pNode.position[1] + 1, pNode.position[2] + 2];
          } else {
            position = [0, 1, 0];
          }
        }

        const newNode: Node = {
          id: newNodeId,
          position,
          title: `Reply ${new Date().toLocaleTimeString()}`,
          content,
          quotedText,
          parentId,
          children: [],
          nodeType: nodeType || (isConnectionNodeParent ? 'socratic-answer' : 'user-reply'),
        };

        updatedNodes[newNodeId] = newNode;

        // Update parent's children array
        if (updatedNodes[parentId]) {
          updatedNodes[parentId] = {
            ...updatedNodes[parentId],
            children: [...updatedNodes[parentId].children, newNodeId],
          };
        }
      }

      return { nodes: updatedNodes };
    });

    // Broadcast all node creations to WebSocket
    const socket = (window as any).socket;
    if (socket) {
      for (const nodeId of newNodeIds) {
        const newNode = get().nodes[nodeId];
        if (newNode) {
          socket.emit('create_node', {
            portalId: 'default-portal',
            id: newNode.id,
            position: newNode.position,
            title: newNode.title,
            content: newNode.content,
            parentId: newNode.parentId,
          });
        }
      }
    }

    // Generate semantic titles in batch (async, non-blocking)
    const nodeContents = newNodeIds.map(id => get().nodes[id]?.content).filter(Boolean) as string[];
    if (nodeContents.length > 0) {
      generateSemanticTitles(nodeContents)
        .then((semanticTitles) => {
          const state = get();
          const updatedNodes = { ...state.nodes };
          newNodeIds.forEach((nodeId, index) => {
            if (updatedNodes[nodeId] && semanticTitles[index]) {
              updatedNodes[nodeId] = {
                ...updatedNodes[nodeId],
                semanticTitle: semanticTitles[index],
              };
            }
          });
          set({ nodes: updatedNodes });
        })
        .catch((error) => {
          console.error('❌ Failed to generate batch semantic titles for addNodes:', error);
        });
    }

    return newNodeIds;
  },

  createChatNexus: (title: string, userMessage: string, aiResponse: string) => {
    console.log('═══════════════════════════════════');
    console.log('🆕 CREATE NEW CHAT UNIVERSE STARTED');
    console.log('═══════════════════════════════════');

    const state = get();

    console.log('Current active universe:', state.activeUniverseId);
    console.log('Current nexuses count:', state.nexuses.length);
    console.log('Current library size:', Object.keys(state.universeLibrary).length);

    // Step 1: Save old universe if exists
    if (state.activeUniverseId && state.nexuses.length > 0) {
      console.log('💾 Step 1: Saving old universe before creating new...');
      get().saveCurrentUniverse();

      // Verify it saved
      const updatedLib = get().universeLibrary;
      console.log('✅ Old universe saved. Library now has:', Object.keys(updatedLib).length);
    } else {
      console.log('ℹ️ Step 1: No previous universe to save');
    }

    // Step 2: Clear canvas
    console.log('🧹 Step 2: Clearing canvas...');
    get().clearCanvas();
    console.log('✅ Canvas cleared');
    console.log('Nexuses after clear:', get().nexuses.length);

    // Step 3: Generate new universe ID
    const newUniverseId = `chat-${Date.now()}`;
    console.log('🆔 Step 3: New universe ID generated:', newUniverseId);

    // Step 4: Create nexus
    console.log('📝 Step 4: Creating nexus...');

    const initialContent = `You: ${userMessage}\n\nClaude: ${aiResponse}`;
    const newNexus: Nexus = {
      id: newUniverseId,
      position: [0, 0, 0],
      title: title,
      content: initialContent,
      type: 'social',
      // 🌱 Initialize evolution state
      evolutionState: 'seed',
      originalContent: initialContent,
      applicationLabConfig: null,
      needsApplicationLab: false,
    };

    console.log(`💬 Created Chat Nexus "${title}" with ID:`, newUniverseId);

    // Step 5: Update state with NEW universe (replacing, not adding)
    console.log('💾 Step 5: Setting state with new universe...');
    set({
      nexuses: [newNexus],  // Replace with single new nexus
      nodes: {},  // Clear nodes
      activeUniverseId: newUniverseId  // Set as active universe
    });

    console.log('✅ State updated');
    console.log('Active universe is now:', get().activeUniverseId);
    console.log('Nexuses count:', get().nexuses.length);

    // 🔥 REMOVED: Saving now happens in ChatInterface AFTER nodes are created
    // This prevents saving incomplete universes (nexus without nodes)
    console.log('ℹ️ Universe will be saved by ChatInterface after nodes are added');
    console.log('═══════════════════════════════════');

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

        const x = nexusPos[0] - radius * Math.cos(angle); // Flipped: first node on left
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
        nodeType: 'ai-response',
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
      if (!parentNode) {
        console.error('❌ addSynthesisNode: Parent node not found:', parentId);
        return state;
      }

      const nexus = get().getNexusForNode(parentId);
      if (!nexus) {
        console.error('❌ addSynthesisNode: Nexus not found for parent:', parentId);
        return state;
      }

      const nexusPos = nexus.position;
      const directionX = parentNode.position[0] - nexusPos[0];
      const directionY = parentNode.position[1] - nexusPos[1];
      const directionZ = parentNode.position[2] - nexusPos[2];

      const dirLength = Math.sqrt(directionX * directionX + directionY * directionY + directionZ * directionZ);

      // CRITICAL: Check for zero-length direction vector (parent at same position as nexus)
      if (dirLength < 0.001) {
        console.warn('⚠️ Parent node is at same position as nexus, using fallback positioning');
        // Use simple offset from parent for synthesis node
        const fallbackX = parentNode.position[0] + 2;
        const fallbackY = parentNode.position[1] + 1;
        const fallbackZ = parentNode.position[2] + 2;

        const position: [number, number, number] = [fallbackX, fallbackY, fallbackZ];
        console.log(`💎 Synthesis node FALLBACK position: [${fallbackX.toFixed(2)}, ${fallbackY.toFixed(2)}, ${fallbackZ.toFixed(2)}]`);

        const newNode: Node = {
          id: newNodeId,
          position,
          title: `💎 Synthesis ${new Date().toLocaleTimeString()}`,
          content,
          parentId,
          children: [],
          isSynthesis: true,
          nodeType: 'synthesis',
        };

        const updatedNodes = { ...state.nodes, [newNodeId]: newNode };

        if (state.nodes[parentId]) {
          updatedNodes[parentId] = {
            ...state.nodes[parentId],
            children: [...state.nodes[parentId].children, newNodeId],
          };
        }

        return { nodes: updatedNodes };
      }

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

      // CRITICAL: Check for zero-length right vector
      if (rightLength < 0.001) {
        console.warn('⚠️ Right vector is zero-length, using alternative axis');
        // Use alternative axis if right vector is degenerate
        const altX = 1, altY = 0, altZ = 0;
        rightX = altX;
        rightY = altY;
        rightZ = altZ;
      } else {
        rightX /= rightLength;
        rightY /= rightLength;
        rightZ /= rightLength;
      }

      const upPerpX = normDirY * rightZ - normDirZ * rightY;
      const upPerpY = normDirZ * rightX - normDirX * rightZ;
      const upPerpZ = normDirX * rightY - normDirY * rightX;

      const helixOffsetX = helixRadius * (Math.cos(angle) * rightX + Math.sin(angle) * upPerpX);
      const helixOffsetY = helixRadius * (Math.cos(angle) * rightY + Math.sin(angle) * upPerpY);
      const helixOffsetZ = helixRadius * (Math.cos(angle) * rightZ + Math.sin(angle) * upPerpZ);

      let x = parentNode.position[0] + (normDirX * distance) + helixOffsetX;
      let y = parentNode.position[1] + (normDirY * distance) + helixOffsetY;
      let z = parentNode.position[2] + (normDirZ * distance) + helixOffsetZ;

      // CRITICAL: Validate final position for NaN
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        console.error('❌ Calculated position contains NaN, using fallback');
        x = parentNode.position[0] + 2;
        y = parentNode.position[1] + 1;
        z = parentNode.position[2] + 2;
      }

      const position: [number, number, number] = [x, y, z];
      console.log(`💎 Synthesis node position: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);

      const newNode: Node = {
        id: newNodeId,
        position,
        title: `💎 Synthesis ${new Date().toLocaleTimeString()}`,
        content,
        parentId,
        children: [],
        isSynthesis: true,
        nodeType: 'synthesis',
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

    const timestamp = Date.now();
    console.log(`🎯 ${timestamp} STORE: selectNode(${id}, showOverlay=${showOverlay})`);
    console.log(`   Current modal state:`, {
      showReplyModal: state.showReplyModal,
      showContentOverlay: state.showContentOverlay
    });
    console.trace('Stack trace:');

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

  setHoveredNode: (id: string | null) => {
    set({ hoveredNodeId: id });
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
        nodeType: 'socratic-question', // Connection nodes are Socratic questions (golden stars)
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

    // Open the unified modal for the user to interact with the connection
    setTimeout(() => {
      get().setShowContentOverlay(true);
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
        nodeType: 'socratic-question', // Multi-connection nodes are also Socratic questions (golden stars)
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

    // Open the unified modal for the user to interact with the connection
    setTimeout(() => {
      get().setShowContentOverlay(true);
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

  createMetaInspirationNode: (nexusId: string) => {
    console.log('🌌 Creating meta-inspiration node for nexus:', nexusId);

    let newMetaNodeId = '';

    set((state) => {
      // Find the nexus
      const nexus = state.nexuses.find(n => n.id === nexusId);
      if (!nexus) {
        console.error('❌ Nexus not found:', nexusId);
        return state;
      }

      // Get ALL nodes in this universe (all nodes with this nexus as parent or grandparent)
      const allUniverseNodes = Object.values(state.nodes).filter(node => {
        // Check if direct child of nexus
        if (node.parentId === nexusId) return true;

        // Check if grandchild (child of a node that's a child of nexus)
        const parent = state.nodes[node.parentId];
        if (parent && parent.parentId === nexusId) return true;

        // Check if great-grandchild, etc. (walk up the tree)
        let current = node;
        let depth = 0;
        const maxDepth = 10; // Prevent infinite loops
        while (current.parentId && depth < maxDepth) {
          if (current.parentId === nexusId) return true;
          current = state.nodes[current.parentId];
          if (!current) break;
          depth++;
        }

        return false;
      });

      const nodeIds = allUniverseNodes.map(n => n.id);
      console.log(`✨ Found ${nodeIds.length} nodes in universe`);

      if (nodeIds.length === 0) {
        console.log('⚠️ No nodes in universe, creating empty meta-node');
      }

      // Generate new node ID
      newMetaNodeId = `meta-inspiration-${Date.now()}`;

      // Position: Directly ABOVE nexus (same X/Z, Y + 6)
      const position: [number, number, number] = [
        nexus.position[0],
        nexus.position[1] + 6,
        nexus.position[2]
      ];

      console.log(`✨ Meta-inspiration node position: [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`);
      console.log(`   Nexus: [${nexus.position[0]}, ${nexus.position[1]}, ${nexus.position[2]}]`);

      // Create the new meta-inspiration node
      const newNode: Node = {
        id: newMetaNodeId,
        position,
        title: `Meta: ${nexus.title}`,
        content: '', // Empty - will be filled by AI or user
        parentId: nexusId, // Parent is the nexus
        children: [],
        isConnectionNode: true, // Reuse connection node logic
        connectionNodes: [nexusId, ...nodeIds], // Include nexus ID + all node IDs
        nodeType: 'inspiration', // Meta-inspiration nodes are golden stars
      };

      const updatedNodes = { ...state.nodes, [newMetaNodeId]: newNode };

      console.log('✅ Meta-inspiration node created:', newMetaNodeId, 'covering', nodeIds.length + 1, 'items');

      return {
        nodes: updatedNodes,
      };
    });

    // Save to localStorage
    get().saveToLocalStorage();

    // Emit to backend via WebSocket
    const socket = (window as any).socket;
    if (socket) {
      const newNode = get().nodes[newMetaNodeId];
      socket.emit('create_node', {
        portalId: 'default-portal',
        id: newNode.id,
        position: newNode.position,
        title: newNode.title,
        content: newNode.content,
        parentId: newNode.parentId,
        isConnectionNode: true,
        connectionNodes: newNode.connectionNodes,
      });
      console.log('📤 Broadcasting meta-inspiration node to backend');
    }

    return newMetaNodeId;
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

  // 🌱 EVOLVING NEXUS - Get all nodes belonging to a nexus
  getNodesForNexus: (nexusId: string) => {
    const state = get();
    const allNodes = Object.values(state.nodes);

    // Find all nodes that belong to this nexus (directly or indirectly)
    const nodesForNexus: Node[] = [];

    for (const node of allNodes) {
      // Check if this node's root nexus is the target nexus
      const rootNexus = get().getNexusForNode(node.id);
      if (rootNexus && rootNexus.id === nexusId) {
        nodesForNexus.push(node);
      }
    }

    return nodesForNexus;
  },

  // 🌱 EVOLVING NEXUS - Check if a nexus is completed based on node completion
  isNexusCompleted: (nexusId: string) => {
    const CORE_NODE_TYPES: NodeType[] = [
      'socratic-question',
      'socratic-answer',
      'user-reply',
      'ai-response',
      'synthesis',
    ];

    const COMPLETION_THRESHOLD = 0.8; // 80% of core nodes must be completed

    const allNodes = get().getNodesForNexus(nexusId);
    if (allNodes.length === 0) return false;

    // Filter for core learning nodes
    const coreNodes = allNodes.filter(node =>
      node.nodeType && CORE_NODE_TYPES.includes(node.nodeType)
    );

    // If no core nodes exist, consider all nodes
    const nodesToCheck = coreNodes.length > 0 ? coreNodes : allNodes;
    if (nodesToCheck.length === 0) return false;

    // Count completed nodes
    const completedNodes = nodesToCheck.filter(node => node.isCompleted === true);
    const completionRate = completedNodes.length / nodesToCheck.length;

    console.log(`🌱 [Nexus ${nexusId}] Completion check:`, {
      totalNodes: allNodes.length,
      coreNodes: coreNodes.length,
      completedNodes: completedNodes.length,
      completionRate: `${(completionRate * 100).toFixed(1)}%`,
      threshold: `${(COMPLETION_THRESHOLD * 100)}%`,
      isCompleted: completionRate >= COMPLETION_THRESHOLD
    });

    return completionRate >= COMPLETION_THRESHOLD;
  },

  // 🌱 EVOLVING NEXUS → APPLICATION LAB - Set Application Lab config and evolve nexus
  setNexusApplicationLab: (nexusId: string, config: ApplicationLabConfig) => {
    console.log(`🌱 [Nexus ${nexusId}] Setting Application Lab config`);

    set((state) => {
      const nexuses = state.nexuses.map(nexus => {
        if (nexus.id === nexusId) {
          console.log(`✨ [Nexus ${nexusId}] Evolved to 'application-lab' state`);
          return {
            ...nexus,
            evolutionState: 'application-lab' as NexusEvolutionState,
            applicationLabConfig: config,
            content: config.doctrineSummary, // Update display content to show doctrine summary
            needsApplicationLab: false, // Clear the flag
          };
        }
        return nexus;
      });

      // Also update in universe library
      const updatedLibrary = { ...state.universeLibrary };
      if (updatedLibrary[nexusId]) {
        updatedLibrary[nexusId] = {
          ...updatedLibrary[nexusId],
          nexuses: updatedLibrary[nexusId].nexuses.map((n: Nexus) =>
            n.id === nexusId
              ? {
                ...n,
                evolutionState: 'application-lab' as NexusEvolutionState,
                applicationLabConfig: config,
                content: config.doctrineSummary,
                needsApplicationLab: false
              }
              : n
          )
        };
      }

      return { nexuses, universeLibrary: updatedLibrary };
    });

    // Save to localStorage
    get().saveToLocalStorage();
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
    console.log('🗑️ ==========================================');
    console.log('🗑️ DELETE CONVERSATION:', new Date().toLocaleTimeString());
    console.log('🗑️   Universe ID to delete:', nexusId);

    try {
      const state = get();

      // Check if universe exists in library
      if (state.universeLibrary[nexusId]) {
        console.log('🗑️   Found in universe library');
        console.log('🗑️   Title:', state.universeLibrary[nexusId].title);
        console.log('🗑️   Nexuses:', state.universeLibrary[nexusId].nexuses.length);
        console.log('🗑️   Nodes:', Object.keys(state.universeLibrary[nexusId].nodes).length);
      } else {
        console.log('🗑️   ⚠️ Not found in universe library');
      }

      console.log('🗑️   Library count before:', Object.keys(state.universeLibrary).length);
      console.log('🗑️   Universe IDs before:', Object.keys(state.universeLibrary));

      set((state) => {
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

        // Remove the nexus from canvas
        const updatedNexuses = state.nexuses.filter(n => n.id !== nexusId);

        // Get all descendant nodes recursively
        const descendantIds = getAllDescendants(nexusId, state.nodes);
        console.log(`🗑️   Found ${descendantIds.length} descendant nodes on canvas to delete`);

        // Remove all descendant nodes from canvas
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

        // 🔥 CRITICAL FIX: Remove from universe library
        const updatedLibrary = { ...state.universeLibrary };
        if (updatedLibrary[nexusId]) {
          delete updatedLibrary[nexusId];
          console.log('🗑️   ✅ Removed from universe library');
        } else {
          console.log('🗑️   ⚠️ Universe not in library (might already be deleted)');
        }

        // Remove from activated conversations
        const updatedActivated = state.activatedConversations.filter(id => id !== nexusId);

        // Clear selection if we're deleting the selected nexus or any of its descendants
        const isSelectedDeleted = state.selectedId === nexusId ||
          (state.selectedId && descendantIds.includes(state.selectedId));
        const updatedSelectedId = isSelectedDeleted ? null : state.selectedId;

        // Clear activeUniverseId if we're deleting the active universe
        const updatedActiveUniverseId = state.activeUniverseId === nexusId ? null : state.activeUniverseId;

        console.log('🗑️   Preserving folders during delete:', Object.keys(state.folders).length);

        return {
          ...state,  // 🔥 CRITICAL: Preserve ALL state including folders
          nexuses: updatedNexuses,
          nodes: updatedNodes,
          universeLibrary: updatedLibrary,
          activatedConversations: updatedActivated,
          selectedId: updatedSelectedId,
          activeUniverseId: updatedActiveUniverseId,
          showContentOverlay: updatedSelectedId === null ? false : state.showContentOverlay
        };
      });

      // Verify deletion
      const updatedState = get();
      const libraryCountAfter = Object.keys(updatedState.universeLibrary).length;
      const foldersCountAfter = Object.keys(updatedState.folders).length;
      console.log('🗑️   Library count after:', libraryCountAfter);
      console.log('🗑️   Universe IDs after:', Object.keys(updatedState.universeLibrary));
      console.log('🗑️   ✅ Folders preserved:', foldersCountAfter, 'folders still exist');
      console.log('🗑️   Folder names:', Object.values(updatedState.folders).map((f: any) => f.name));

      if (updatedState.universeLibrary[nexusId]) {
        console.error('🗑️   ❌ ERROR: Universe still in library after deletion!');
      } else {
        console.log('🗑️   ✅ Verified: Universe removed from library');
      }

      // Save to storage (localStorage + IndexedDB)
      console.log('🗑️   💾 Persisting deletion to storage...');

      // Delete from IndexedDB
      deleteUniverseFromDB(nexusId).then(() => {
        console.log('🗑️   ✅ Deleted from IndexedDB');
      });

      get().saveToLocalStorage();

      // Final verification: Check localStorage
      const lsData = localStorage.getItem('aurora-portal-data');
      if (lsData) {
        const parsed = JSON.parse(lsData);
        if (parsed.universeLibrary && parsed.universeLibrary[nexusId]) {
          console.error('🗑️   ❌ ERROR: Universe still in localStorage!');
        } else {
          console.log('🗑️   ✅ Verified: Universe removed from localStorage');
        }
        console.log('🗑️   localStorage now has', Object.keys(parsed.universeLibrary || {}).length, 'universes');
      }

      console.log('🗑️   ✅ DELETE COMPLETE');
      console.log('🗑️ ==========================================');

    } catch (error) {
      console.error('❌ ==========================================');
      console.error('❌ CRITICAL ERROR in deleteConversation:', error);
      console.error('❌   Error message:', (error as Error).message);
      console.error('❌   Universe ID:', nexusId);
      console.error('❌ ==========================================');

      // Alert user
      if (typeof window !== 'undefined') {
        alert('⚠️ ERROR: Failed to delete universe!\n\n' + (error as Error).message + '\n\nCheck console for details.');
      }
    }
  },

  deleteUniverseById: (universeId: string) => {
    console.log('🗑️ ==========================================');
    console.log('🗑️ DELETE UNIVERSE BY ID:', universeId);
    console.log('🗑️ ==========================================');

    try {
      const state = get();

      // Check if universe exists
      if (!state.universeLibrary[universeId]) {
        console.error('🗑️   ❌ Universe not found:', universeId);
        alert('⚠️ Universe not found!');
        return;
      }

      const universeTitle = state.universeLibrary[universeId].title;
      console.log('🗑️   Deleting universe:', universeTitle);

      set((state) => {
        // Remove from library
        const updatedLibrary = { ...state.universeLibrary };
        delete updatedLibrary[universeId];

        // Remove from active universes if present
        const updatedActiveIds = state.activeUniverseIds.filter(id => id !== universeId);

        // Clear canvas if this was the only active universe
        const clearedNexuses = updatedActiveIds.length === 0 ? [] : state.nexuses;
        const clearedNodes = updatedActiveIds.length === 0 ? {} : state.nodes;

        console.log('🗑️   Removed from library');
        console.log('🗑️   Active universes before:', state.activeUniverseIds.length);
        console.log('🗑️   Active universes after:', updatedActiveIds.length);

        return {
          universeLibrary: updatedLibrary,
          activeUniverseIds: updatedActiveIds,
          activeUniverseId: updatedActiveIds.length > 0 ? updatedActiveIds[0] : null,
          nexuses: clearedNexuses,
          nodes: clearedNodes,
          selectedId: null,
          showContentOverlay: false
        };
      });

      // Delete from IndexedDB
      deleteUniverseFromDB(universeId).then(() => {
        console.log('🗑️   ✅ Deleted from IndexedDB');
      });

      // Delete from cloud
      fetch('/api/universes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universeId }),
      }).then(res => {
        if (res.ok) console.log('🗑️   ✅ Deleted from cloud');
        else console.warn('🗑️   ⚠️ Cloud delete returned:', res.status);
      }).catch(e => {
        console.error('🗑️   ❌ Failed to delete from cloud:', e);
      });

      // Save to localStorage
      get().saveToLocalStorage();

      console.log('🗑️   ✅ DELETE COMPLETE');
      console.log('🗑️ ==========================================');

    } catch (error) {
      console.error('❌ Error deleting universe:', error);
      alert('⚠️ Failed to delete universe: ' + (error as Error).message);
    }
  },

  getNodeChildrenCount: (nodeId: string): number => {
    const state = get();
    const node = state.nodes[nodeId];

    if (!node) return 0;

    // Helper function to recursively count all descendants
    const countAllDescendants = (parentId: string, nodes: { [id: string]: Node }): number => {
      let count = 0;
      Object.keys(nodes).forEach(nId => {
        if (nodes[nId].parentId === parentId) {
          count += 1;
          // Recursively count children of this node
          count += countAllDescendants(nId, nodes);
        }
      });
      return count;
    };

    return countAllDescendants(nodeId, state.nodes);
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

  reparentNode: (nodeId: string, newParentId: string, newPosition: [number, number, number]) => {
    console.log('🔀 ==========================================');
    console.log('🔀 REPARENTING NODE');
    console.log('🔀   Node:', nodeId);
    console.log('🔀   New Parent:', newParentId);
    console.log('🔀   New Position:', newPosition);
    console.log('🔀 ==========================================');

    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) {
        console.error('❌ Node not found:', nodeId);
        return state;
      }

      const oldParentId = node.parentId;

      // Check if new parent is a nexus
      const isNexusParent = state.nexuses.some(n => n.id === newParentId);
      const newParentNode = state.nodes[newParentId];

      // Determine new node type based on parent level
      const newNodeType = node.nodeType;
      if (isNexusParent) {
        // Attached to nexus → becomes L1 (keep original type but reset level)
        // User replies stay user-reply, AI stays ai-response, etc.
        console.log('🔀 Attaching to nexus - node remains', newNodeType);
      } else if (newParentNode) {
        // Keep the semantic type (user-reply, ai-response, etc.)
        console.log('🔀 Attaching to node - keeping type', newNodeType);
      }

      const updatedNodes = { ...state.nodes };

      // Remove from old parent's children array
      if (oldParentId && updatedNodes[oldParentId]) {
        updatedNodes[oldParentId] = {
          ...updatedNodes[oldParentId],
          children: updatedNodes[oldParentId].children.filter(id => id !== nodeId)
        };
      }

      // Add to new parent's children array
      if (updatedNodes[newParentId]) {
        updatedNodes[newParentId] = {
          ...updatedNodes[newParentId],
          children: [...updatedNodes[newParentId].children, nodeId]
        };
      }

      // Update the node itself
      updatedNodes[nodeId] = {
        ...node,
        parentId: newParentId,
        position: newPosition,
        nodeType: newNodeType
      };

      console.log('✅ Node reparented successfully');

      return {
        nodes: updatedNodes
      };
    });

    // 💾 SAVE TO LOCALSTORAGE
    get().saveToLocalStorage();
  },

  // 🎯 MARK NODE AS COMPLETED AND UNLOCK NEXT
  markNodeCompleted: (nodeId: string) => {
    console.log('🎯 ==========================================');
    console.log('🎯 MARKING NODE AS COMPLETED');
    console.log('🎯   Node:', nodeId);
    console.log('🎯 ==========================================');

    const state = get();
    const node = state.nodes[nodeId];

    if (!node) {
      console.error('❌ Node not found:', nodeId);
      return false;
    }

    // 🎓 CHECK IF THIS IS A COURSE UNIVERSE
    const universeId = node.parentId;
    const universe = state.universeLibrary[universeId];

    const isCourseUniverse = universe && universe.courseMode;

    if (isCourseUniverse) {
      console.log('✅ Course universe confirmed - proceeding with completion');
    } else {
      console.log('ℹ️ Non-course universe - allowing completion for evolution tracking');
    }

    // Check if already completed
    if (node.isCompleted) {
      console.log('ℹ️ Node already marked as completed');
      return false;
    }

    // Mark node as completed
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...state.nodes[nodeId],
          isCompleted: true
        }
      }
    }));

    console.log('✅ Node marked as completed:', nodeId);

    // Unlock next node (only for course universes)
    let unlockedNodeId = null;
    if (isCourseUniverse) {
      unlockedNodeId = get().unlockNextNode(nodeId);
    }

    // 🌱 EVOLVING NEXUS → APPLICATION LAB - Check if this completion triggers Application Lab generation
    const rootNexus = get().getNexusForNode(nodeId);
    if (rootNexus && rootNexus.evolutionState !== 'application-lab') {
      console.log(`🌱 Checking if nexus ${rootNexus.id} is now complete...`);
      const isComplete = get().isNexusCompleted(rootNexus.id);
      if (isComplete) {
        console.log(`✨ Nexus ${rootNexus.id} is complete! Marking for Application Lab generation.`);
        // Set needsApplicationLab flag to trigger Application Lab generation hook
        set((state) => ({
          nexuses: state.nexuses.map(n =>
            n.id === rootNexus.id
              ? { ...n, needsApplicationLab: true }
              : n
          )
        }));
      }
    }

    // Save to localStorage
    get().saveToLocalStorage();

    return unlockedNodeId !== null;
  },

  // 🔓 UNLOCK NEXT L1 SIBLING NODE
  unlockNextNode: (currentNodeId: string) => {
    console.log('🔓 ==========================================');
    console.log('🔓 UNLOCKING NEXT NODE');
    console.log('🔓   Current Node:', currentNodeId);

    const state = get();
    const currentNode = state.nodes[currentNodeId];

    if (!currentNode) {
      console.error('❌ Current node not found:', currentNodeId);
      return null;
    }

    // Find the nexus (parent of current L1 node)
    const nexusId = currentNode.parentId;
    console.log('🔓   Nexus ID:', nexusId);

    // Get all L1 nodes (direct children of nexus)
    const l1Nodes = Object.values(state.nodes)
      .filter(n => n.parentId === nexusId)
      .sort((a, b) => a.id.localeCompare(b.id)); // Sort by creation time (ID is timestamp-based)

    console.log('🔓   Total L1 nodes:', l1Nodes.length);

    // Find current node's index
    const currentIndex = l1Nodes.findIndex(n => n.id === currentNodeId);

    if (currentIndex === -1) {
      console.error('❌ Current node not found in L1 nodes');
      return null;
    }

    console.log('🔓   Current node index:', currentIndex);

    // Check if there's a next node
    if (currentIndex >= l1Nodes.length - 1) {
      console.log('ℹ️ No more nodes to unlock - this is the last L1 node');
      return null;
    }

    // Get next L1 node
    const nextNode = l1Nodes[currentIndex + 1];
    console.log('🔓   Next node ID:', nextNode.id);
    console.log('🔓   Next node locked status:', nextNode.isLocked);

    // Unlock it
    if (nextNode.isLocked) {
      set((state) => ({
        nodes: {
          ...state.nodes,
          [nextNode.id]: {
            ...state.nodes[nextNode.id],
            isLocked: false
          }
        }
      }));

      console.log('✅ Next node unlocked:', nextNode.id);
      console.log('🔓 ==========================================');

      // Save to localStorage
      get().saveToLocalStorage();

      return nextNode.id;
    } else {
      console.log('ℹ️ Next node was already unlocked');
      console.log('🔓 ==========================================');
      return null;
    }
  },

  // 🎓 START A NEW UNIVERSE RUN
  startUniverseRun: (universeId?: string) => {
    const state = get();
    const targetUniverseId = universeId || state.activeUniverseIds[0];

    if (!targetUniverseId || !state.universeLibrary[targetUniverseId]) {
      console.error('❌ Cannot start run: Universe not found');
      return '';
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newRun: UniverseRun = {
      id: runId,
      universeId: targetUniverseId,
      startedAt: Date.now(),
      status: 'in_progress',
      intuitionResponses: [],
      imitationAttempts: [],
      quizResults: [],
      synthesisAnalyses: [],
    };

    set((state) => ({
      universeLibrary: {
        ...state.universeLibrary,
        [targetUniverseId]: {
          ...state.universeLibrary[targetUniverseId],
          runs: [...(state.universeLibrary[targetUniverseId].runs || []), newRun],
          currentRunId: runId,
        },
      },
    }));

    get().saveToLocalStorage();
    console.log('🎓 Started new universe run:', runId);
    return runId;
  },

  // 🎓 GET CURRENT IN-PROGRESS RUN
  getCurrentRun: (universeId?: string) => {
    const state = get();
    const targetUniverseId = universeId || state.activeUniverseIds[0];

    if (!targetUniverseId || !state.universeLibrary[targetUniverseId]) {
      return null;
    }

    const universe = state.universeLibrary[targetUniverseId];
    if (!universe.currentRunId || !universe.runs) {
      return null;
    }

    return universe.runs.find(r => r.id === universe.currentRunId && r.status === 'in_progress') || null;
  },

  // 🎓 ADD INTUITION RESPONSE TO RUN
  addIntuitionResponse: (runId: string, response: import('./types').IntuitionResponse) => {
    const state = get();

    // Find which universe contains this run
    for (const [universeId, universe] of Object.entries(state.universeLibrary)) {
      const runIndex = universe.runs?.findIndex(r => r.id === runId);
      if (runIndex !== undefined && runIndex !== -1 && universe.runs) {
        const updatedRuns = [...universe.runs];
        updatedRuns[runIndex] = {
          ...updatedRuns[runIndex],
          intuitionResponses: [...updatedRuns[runIndex].intuitionResponses, response],
        };

        set((state) => ({
          universeLibrary: {
            ...state.universeLibrary,
            [universeId]: {
              ...state.universeLibrary[universeId],
              runs: updatedRuns,
            },
          },
        }));

        get().saveToLocalStorage();
        console.log('🎓 Added intuition response to run:', runId);
        return;
      }
    }
  },

  // 🎓 ADD IMITATION ATTEMPT TO RUN
  addImitationAttempt: (runId: string, attempt: import('./types').ImitationAttempt) => {
    const state = get();

    for (const [universeId, universe] of Object.entries(state.universeLibrary)) {
      const runIndex = universe.runs?.findIndex(r => r.id === runId);
      if (runIndex !== undefined && runIndex !== -1 && universe.runs) {
        const updatedRuns = [...universe.runs];
        updatedRuns[runIndex] = {
          ...updatedRuns[runIndex],
          imitationAttempts: [...updatedRuns[runIndex].imitationAttempts, attempt],
        };

        set((state) => ({
          universeLibrary: {
            ...state.universeLibrary,
            [universeId]: {
              ...state.universeLibrary[universeId],
              runs: updatedRuns,
            },
          },
        }));

        get().saveToLocalStorage();
        console.log('🎓 Added imitation attempt to run:', runId);
        return;
      }
    }
  },

  // 🎓 ADD QUIZ RESULT TO RUN
  addQuizResult: (runId: string, result: import('./types').QuizResult) => {
    const state = get();

    for (const [universeId, universe] of Object.entries(state.universeLibrary)) {
      const runIndex = universe.runs?.findIndex(r => r.id === runId);
      if (runIndex !== undefined && runIndex !== -1 && universe.runs) {
        const updatedRuns = [...universe.runs];
        updatedRuns[runIndex] = {
          ...updatedRuns[runIndex],
          quizResults: [...updatedRuns[runIndex].quizResults, result],
        };

        set((state) => ({
          universeLibrary: {
            ...state.universeLibrary,
            [universeId]: {
              ...state.universeLibrary[universeId],
              runs: updatedRuns,
            },
          },
        }));

        get().saveToLocalStorage();
        console.log('🎓 Added quiz result to run:', runId);
        return;
      }
    }
  },

  // 🎓 ADD SYNTHESIS ANALYSIS TO RUN
  addSynthesisAnalysis: (runId: string, analysis: import('./types').SynthesisAnalysis) => {
    const state = get();

    for (const [universeId, universe] of Object.entries(state.universeLibrary)) {
      const runIndex = universe.runs?.findIndex(r => r.id === runId);
      if (runIndex !== undefined && runIndex !== -1 && universe.runs) {
        const updatedRuns = [...universe.runs];
        updatedRuns[runIndex] = {
          ...updatedRuns[runIndex],
          synthesisAnalyses: [...updatedRuns[runIndex].synthesisAnalyses, analysis],
        };

        set((state) => ({
          universeLibrary: {
            ...state.universeLibrary,
            [universeId]: {
              ...state.universeLibrary[universeId],
              runs: updatedRuns,
            },
          },
        }));

        get().saveToLocalStorage();
        console.log('🎓 Added synthesis analysis to run:', runId);
        return;
      }
    }
  },

  // 🎓 COMPLETE UNIVERSE RUN
  completeUniverseRun: (runId: string) => {
    const state = get();

    for (const [universeId, universe] of Object.entries(state.universeLibrary)) {
      const runIndex = universe.runs?.findIndex(r => r.id === runId);
      if (runIndex !== undefined && runIndex !== -1 && universe.runs) {
        const run = universe.runs[runIndex];

        // Calculate metrics
        const totalQuestions = run.quizResults.length;
        const correctAnswers = run.quizResults.filter(r => r.wasCorrect).length;

        // Count unique doctrines completed
        const doctrineIds = new Set([
          ...run.intuitionResponses.map(r => r.nodeId),
          ...run.quizResults.map(r => r.nodeId),
        ]);

        const updatedRuns = [...universe.runs];
        updatedRuns[runIndex] = {
          ...run,
          status: 'completed',
          completedAt: Date.now(),
          metrics: {
            totalQuestions,
            correctAnswers,
            totalTimeSeconds: run.startedAt ? Math.round((Date.now() - run.startedAt) / 1000) : undefined,
            doctrinesCompleted: doctrineIds.size,
            totalDoctrines: Object.values(state.nodes).filter(n => n.parentId === universe.nexuses[0]?.id).length,
          },
        };

        set((state) => ({
          universeLibrary: {
            ...state.universeLibrary,
            [universeId]: {
              ...state.universeLibrary[universeId],
              runs: updatedRuns,
              currentRunId: undefined, // Clear current run
            },
          },
        }));

        get().saveToLocalStorage();
        console.log('🎓 Completed universe run:', runId);
        return;
      }
    }
  },

  // 🎓 SAVE STUDY GUIDE WRITE-UP
  saveStudyGuideWriteUp: (writeUp: StudyGuideWriteUp) => {
    const state = get();
    const universeId = writeUp.universeId;

    if (!state.universeLibrary[universeId]) {
      console.error('❌ Cannot save write-up: Universe not found');
      return;
    }

    set((state) => ({
      universeLibrary: {
        ...state.universeLibrary,
        [universeId]: {
          ...state.universeLibrary[universeId],
          writeUps: [...(state.universeLibrary[universeId].writeUps || []), writeUp],
        },
      },
    }));

    get().saveToLocalStorage();
    console.log('🎓 Saved study guide write-up:', writeUp.id);
  },

  // 🎓 GET ALL WRITE-UPS FOR A UNIVERSE
  getUniverseWriteUps: (universeId?: string) => {
    const state = get();
    const targetUniverseId = universeId || state.activeUniverseIds[0];

    if (!targetUniverseId || !state.universeLibrary[targetUniverseId]) {
      return [];
    }

    return state.universeLibrary[targetUniverseId].writeUps || [];
  },

  // 🎓 RESET UNIVERSE FOR FRESH PRACTICE RUN
  resetUniverseForPractice: (universeId?: string) => {
    const state = get();
    const targetUniverseId = universeId || state.activeUniverseIds[0];

    if (!targetUniverseId || !state.universeLibrary[targetUniverseId]) {
      console.error('❌ Cannot reset: Universe not found');
      return;
    }

    console.log('🎓 Resetting universe for practice:', targetUniverseId);

    // Get all nodes for this universe
    const universe = state.universeLibrary[targetUniverseId];
    const nexusIds = new Set(universe.nexuses.map(n => n.id));

    // Find nodes to keep (doctrine nodes) vs nodes to remove (user responses)
    const nodesToRemove: string[] = [];
    const updatedNodes: { [id: string]: Node } = {};

    for (const [nodeId, node] of Object.entries(universe.nodes)) {
      // Remove practice child nodes (user responses)
      const practiceNodeTypes = ['intuition-example', 'imitate', 'synthesis', 'user-reply', 'ai-response'];
      if (node.nodeType && practiceNodeTypes.includes(node.nodeType) && !nexusIds.has(node.parentId)) {
        nodesToRemove.push(nodeId);
        continue;
      }

      // Reset progress on remaining nodes
      updatedNodes[nodeId] = {
        ...node,
        isCompleted: false,
        quizProgress: undefined,
        // Keep first node unlocked, lock the rest
        isLocked: !nexusIds.has(node.parentId) ? undefined : node.isLocked,
      };
    }

    // Update children arrays to remove deleted nodes
    for (const nodeId of Object.keys(updatedNodes)) {
      updatedNodes[nodeId] = {
        ...updatedNodes[nodeId],
        children: updatedNodes[nodeId].children.filter(id => !nodesToRemove.includes(id)),
      };
    }

    // Lock all L1 nodes except the first one
    const l1Nodes = Object.values(updatedNodes)
      .filter(n => nexusIds.has(n.parentId))
      .sort((a, b) => a.id.localeCompare(b.id));

    l1Nodes.forEach((node, index) => {
      updatedNodes[node.id] = {
        ...updatedNodes[node.id],
        isLocked: index > 0, // First node unlocked, rest locked
        isCompleted: false,
      };
    });

    set((state) => ({
      universeLibrary: {
        ...state.universeLibrary,
        [targetUniverseId]: {
          ...state.universeLibrary[targetUniverseId],
          nodes: updatedNodes,
          currentRunId: undefined,
        },
      },
      // Also update current canvas if this universe is active
      ...(state.activeUniverseIds.includes(targetUniverseId) ? { nodes: updatedNodes } : {}),
    }));

    get().saveToLocalStorage();
    console.log('🎓 Universe reset complete. Removed', nodesToRemove.length, 'practice nodes');

    // Start a new practice run
    const newRunId = get().startUniverseRun(targetUniverseId);
    console.log('🎓 Started new practice run:', newRunId);

    return newRunId;
  },

  // 📸 CREATE SNAPSHOT - Store original state for true revert
  createSnapshot: (universeId: string) => {
    console.log('📸 ==========================================');
    console.log('📸 CREATE SNAPSHOT:', new Date().toLocaleTimeString());
    console.log('📸   Universe ID:', universeId);

    try {
      const state = get();

      // Check if universe exists in library
      if (!state.universeLibrary[universeId]) {
        console.error('📸   ❌ Universe not found in library');
        console.error('📸   Looking for ID:', universeId);
        console.error('📸   Available IDs:', Object.keys(state.universeLibrary));
        return;
      }

      // Check if snapshot already exists
      if (state.originalSnapshots[universeId]) {
        console.log('📸   ℹ️ Snapshot already exists for this universe - skipping');
        console.log('📸   Original snapshot created:', new Date(state.originalSnapshots[universeId].createdAt).toLocaleString());
        return;
      }

      const universe = state.universeLibrary[universeId];
      console.log('📸   Universe title:', universe.title);
      console.log('📸   Capturing:', universe.nexuses.length, 'nexuses and', Object.keys(universe.nodes).length, 'nodes');

      // Create deep copy of nexuses and nodes (only L1 nodes)
      const l1Nodes: { [id: string]: Node } = {};
      Object.entries(universe.nodes).forEach(([nodeId, node]) => {
        if (node.parentId === universeId) {
          // Deep copy the L1 node
          l1Nodes[nodeId] = { ...node };
        }
      });

      const snapshot: UniverseSnapshot = {
        nexuses: universe.nexuses.map(n => ({ ...n })), // Deep copy
        nodes: l1Nodes,
        createdAt: Date.now()
      };

      console.log('📸   Snapshot contains:', snapshot.nexuses.length, 'nexuses and', Object.keys(snapshot.nodes).length, 'L1 nodes');

      // Store snapshot
      set((state) => ({
        originalSnapshots: {
          ...state.originalSnapshots,
          [universeId]: snapshot
        }
      }));

      console.log('📸   ✅ Snapshot created successfully');
      console.log('📸 ==========================================');

      // Save to localStorage
      get().saveToLocalStorage();

    } catch (error) {
      console.error('❌ ==========================================');
      console.error('❌ CRITICAL ERROR in createSnapshot:', error);
      console.error('❌   Error message:', (error as Error).message);
      console.error('❌   Universe ID:', universeId);
      console.error('❌ ==========================================');
    }
  },

  // 🔄 REVERT TO ORIGINAL - Keep only nexus + L1 nodes
  revertToOriginal: (universeId: string) => {
    console.log('🔄 ==========================================');
    console.log('🔄 REVERT TO ORIGINAL:', new Date().toLocaleTimeString());
    console.log('🔄   Universe ID:', universeId);

    try {
      const state = get();

      // 🛡️ VALIDATION: Check ID format
      if (!universeId?.startsWith('universe-')) {
        console.error('🔄   ❌ INVALID ID FORMAT');
        console.error('🔄   Received:', universeId);
        console.error('🔄   Expected format: universe-XXXXXXXXXX');
        console.error('🔄   This may be a nexus ID instead of universe ID!');

        if (typeof window !== 'undefined') {
          alert(`⚠️ Cannot revert: Invalid universe ID!\n\nReceived: ${universeId}\n\nExpected format: universe-XXXXXXXXXX\n\nThis is likely a bug - please report it.`);
        }
        return;
      }

      // Check if universe exists in library
      if (!state.universeLibrary[universeId]) {
        console.error('🔄   ❌ Universe not found in library');
        console.error('🔄   Looking for ID:', universeId);
        console.error('🔄   Available IDs:', Object.keys(state.universeLibrary));

        if (typeof window !== 'undefined') {
          alert(`⚠️ Cannot revert: Universe not found in library!\n\nLooking for: ${universeId}\n\nThis may happen if the universe wasn't saved before export.`);
        }
        return;
      }

      const universe = state.universeLibrary[universeId];
      console.log('🔄   Universe title:', universe.title);
      console.log('🔄   Total nodes before:', Object.keys(universe.nodes).length);

      // Get nexus ID from the universe
      const universeNexusId = universe.nexuses[0]?.id;
      if (!universeNexusId) {
        console.error('🔄   ❌ No nexus found in universe');
        return;
      }

      // Check if snapshot exists
      const snapshot = state.originalSnapshots[universeId];

      let restoredNodes: { [id: string]: Node };
      let restoredNexuses: Nexus[];

      if (snapshot) {
        // TRUE REVERT: Restore from snapshot (includes deleted L1 nodes)
        console.log('🔄   📸 Snapshot found! Restoring from snapshot created:', new Date(snapshot.createdAt).toLocaleString());
        console.log('🔄   📸 Snapshot contains:', snapshot.nexuses.length, 'nexuses and', Object.keys(snapshot.nodes).length, 'L1 nodes');

        // Deep copy from snapshot
        restoredNodes = {};
        Object.entries(snapshot.nodes).forEach(([id, node]) => {
          restoredNodes[id] = { ...node };
        });
        restoredNexuses = snapshot.nexuses.map(n => ({ ...n }));

        const removedCount = Object.keys(universe.nodes).length - Object.keys(restoredNodes).length;
        console.log('🔄   📸 L1 nodes restored:', Object.keys(restoredNodes).length);
        console.log('🔄   📸 Exploration nodes removed:', removedCount);

      } else {
        // FALLBACK: Filter L1 nodes (cannot restore deleted nodes)
        console.log('🔄   ⚠️ No snapshot found - falling back to filter method');
        console.log('🔄   ⚠️ Note: Deleted L1 nodes cannot be restored without a snapshot');

        restoredNodes = {};
        Object.entries(universe.nodes).forEach(([nodeId, node]) => {
          if (node.parentId === universeNexusId) {
            restoredNodes[nodeId] = node;
          }
        });
        restoredNexuses = universe.nexuses;

        const l1NodeCount = Object.keys(restoredNodes).length;
        const removedCount = Object.keys(universe.nodes).length - l1NodeCount;

        console.log('🔄   L1 nodes kept:', l1NodeCount);
        console.log('🔄   Exploration nodes removed:', removedCount);
      }

      // Update universe in library
      set((state) => {
        const updatedLibrary = {
          ...state.universeLibrary,
          [universeId]: {
            ...universe,
            nexuses: restoredNexuses,
            nodes: restoredNodes,
            lastModified: Date.now()
          }
        };

        // If this is the active universe, update canvas state
        if (state.activeUniverseId === universeId) {
          console.log('🔄   Updating active canvas state');
          return {
            universeLibrary: updatedLibrary,
            nexuses: restoredNexuses,
            nodes: restoredNodes
          };
        }

        return {
          universeLibrary: updatedLibrary
        };
      });

      console.log('🔄   ✅ Universe reverted to original state');
      console.log('🔄   💾 Saving to localStorage...');

      // Save to localStorage
      get().saveToLocalStorage();

      console.log('🔄   ✅ REVERT COMPLETE');
      console.log('🔄 ==========================================');

    } catch (error) {
      console.error('❌ ==========================================');
      console.error('❌ CRITICAL ERROR in revertToOriginal:', error);
      console.error('❌   Error message:', (error as Error).message);
      console.error('❌   Universe ID:', universeId);
      console.error('❌ ==========================================');

      if (typeof window !== 'undefined') {
        alert('⚠️ ERROR: Failed to revert universe!\n\n' + (error as Error).message + '\n\nCheck console for details.');
      }
    }
  },

  // ⚓ ANCHOR SYSTEM FUNCTIONS

  toggleAnchor: (nodeId: string) => {
    console.log('⚓ ==========================================');
    console.log('⚓ TOGGLE ANCHOR:', new Date().toLocaleTimeString());
    console.log('⚓   Node ID:', nodeId);

    const state = get();
    const node = state.nodes[nodeId];

    if (!node) {
      console.error('⚓   ❌ Node not found:', nodeId);
      return;
    }

    const wasAnchored = node.isAnchored || false;
    const newAnchoredState = !wasAnchored;

    console.log('⚓   Previous state:', wasAnchored ? 'anchored' : 'not anchored');
    console.log('⚓   New state:', newAnchoredState ? 'anchored' : 'not anchored');

    // Update the node
    const updatedNode: Node = {
      ...node,
      isAnchored: newAnchoredState,
      anchoredAt: newAnchoredState ? Date.now() : undefined
    };

    set({
      nodes: {
        ...state.nodes,
        [nodeId]: updatedNode
      }
    });

    console.log('⚓   ✅ Node', newAnchoredState ? 'anchored' : 'unanchored');
    console.log('⚓   Title:', node.semanticTitle || node.content.slice(0, 50) + '...');
    console.log('⚓ ==========================================');

    // Save to localStorage
    get().saveToLocalStorage();
  },

  getAnchoredNodes: () => {
    const nodes = get().nodes;
    const anchoredNodes = Object.values(nodes)
      .filter(node => node.isAnchored)
      .sort((a, b) => (b.anchoredAt || 0) - (a.anchoredAt || 0)); // Most recent first

    console.log('⚓ Getting anchored nodes:', anchoredNodes.length, 'found');
    return anchoredNodes;
  },

  
  buildConversationContext: () => {
    const state = get();
    const context: string[] = [];
    const activatedConvos = state.getActivatedConversations();

    if (activatedConvos.length > 0) {
      context.push("=== ACTIVATED MEMORIES ===\n");
      activatedConvos.forEach(conv => {
        context.push(`**${conv.title}**`);
        context.push(conv.content);
        context.push("---\n");
      });
    }

    const selectedNexus = state.selectedId ? state.nexuses.find(n => n.id === state.selectedId) : null;
    const currentNexus = selectedNexus || state.nexuses.find(n => n.id.startsWith('chat-')) || state.nexuses[0];

    if (currentNexus) {
      context.push("=== CURRENT CONVERSATION ===\n");
      context.push(`**Topic: ${currentNexus.title}**`);
      context.push(currentNexus.content);
      context.push("\n**Full Thread:**\n");

      const conversationNodes = Object.values(state.nodes)
        .filter(node => node.parentId === currentNexus.id)
        .sort((a, b) => {
          const aTime = parseInt(a.id.split('-')[1]) || 0;
          const bTime = parseInt(b.id.split('-')[1]) || 0;
          return aTime - bTime;
        });

      conversationNodes.forEach(node => {
        if (node.isAI) {
          context.push(`\n[AI]: ${node.content}`);
        } else {
          context.push(`\n[User]: ${node.content}`);
        }
      });
    }

    return context.join('\n');
  },

  buildGraphStructure: () => {
    const state = get();
    const { nexuses, nodes, activatedUniverseIds, universeLibrary, selectedId } = state;
    if (nexuses.length === 0 && activatedUniverseIds.length === 0) {
      return null;
    }

    if (nexuses.length === 0 && activatedUniverseIds.length > 0) {
      // Synthesis mode
    }

    const buildUniverseGraph = (universeId: string) => {
      const universe = universeLibrary[universeId];
      if (!universe) {
        return null;
      }

      const nexus = universe.nexuses[0];
      if (!nexus) return null;

      const universeNodes = Object.values(universe.nodes);

      const fullNodes = universeNodes.map(node => ({
        id: node.id,
        type: node.nodeType || 'user-reply',
        content: node.content,
        parentId: node.parentId,
        position: node.position,
        semanticTitle: node.semanticTitle
      }));

      const connections = universeNodes.map(node => ({
        from: node.parentId,
        to: node.id
      }));

      return {
        universeId,
        nexus: {
          id: nexus.id,
          content: nexus.content,
          title: nexus.title,
          position: nexus.position
        },
        nodes: fullNodes,
        connections
      };
    };

    let currentGraph = null;
    if (nexuses.length > 0) {
      const currentNexus = selectedId
        ? nexuses.find(n => n.id === selectedId) || nexuses[0]
        : nexuses[0];

      if (currentNexus) {
        const universeNodes = Object.values(nodes);
        const fullNodes = universeNodes.map(node => ({
          id: node.id,
          type: node.nodeType || 'user-reply',
          content: node.content,
          parentId: node.parentId,
          position: node.position,
          semanticTitle: node.semanticTitle
        }));

        const connections = universeNodes.map(node => ({
          from: node.parentId,
          to: node.id
        }));

        currentGraph = {
          nexus: {
            id: currentNexus.id,
            content: currentNexus.content,
            title: currentNexus.title,
            position: currentNexus.position
          },
          nodes: fullNodes,
          connections
        };
      }
    }

    const activatedGraphs = activatedUniverseIds
      .map(universeId => buildUniverseGraph(universeId))
      .filter(graph => graph !== null);

    return {
      currentGraph,
      activatedGraphs,
      hasMultipleUniverses: activatedGraphs.length > 0
    };
  },
  // 🌌 UNIVERSE MANAGEMENT FUNCTIONS

  saveCurrentUniverse: (cameraPosition?: [number, number, number]) => {
    console.log('───────────────────────────────────');
    console.log('💾 SAVE CURRENT UNIVERSE CALLED');
    console.log('───────────────────────────────────');

    try {
      const state = get();

      // 🛡️ Mark store as initialized when saving (we have valid data)
      if (!state.isStoreInitialized) {
        console.log('🔓 Marking store as initialized (saveCurrentUniverse called)');
        set({ isStoreInitialized: true });
      }

      console.log('Active Universe ID:', state.activeUniverseId);
      console.log('Nexuses:', state.nexuses);
      console.log('Nexuses count:', state.nexuses.length);
      console.log('Nodes count:', Object.keys(state.nodes).length);
      console.log('Current library size:', Object.keys(state.universeLibrary).length);
      console.log('Current universe IDs in library:', Object.keys(state.universeLibrary));

      // Check 1: Do we have an ID? (Gracefully skip if missing during transitions)
      if (!state.activeUniverseId) {
        console.log('⏭️ No active universe ID (normal during transitions) - skipping save');
        console.log('───────────────────────────────────');
        return;
      }
      console.log('✅ Check 1: Has active ID:', state.activeUniverseId);

      // Check 2: Do we have nexuses?
      if (!state.nexuses || state.nexuses.length === 0) {
        console.error('❌ SAVE FAILED: No nexuses');
        console.log('───────────────────────────────────');
        return;
      }
      console.log('✅ Check 2: Has', state.nexuses.length, 'nexuses');

      // VALIDATION: Check for required data
      if (!state.nexuses[0]) {
        throw new Error('First nexus is undefined!');
      }
      if (!state.nexuses[0].id) {
        throw new Error('First nexus has no ID!');
      }
      if (!state.nexuses[0].title) {
        console.warn('⚠️ First nexus has no title, using default');
      }

      // Use existing activeUniverseId
      const universeId = state.activeUniverseId;
      const libraryBeforeSave = { ...state.universeLibrary };
      const libraryCountBefore = Object.keys(libraryBeforeSave).length;

      console.log('📊 Library state before save:');
      console.log('   - Library count:', libraryCountBefore);
      console.log('   - Universe IDs:', Object.keys(libraryBeforeSave));

      // Get title from first nexus
      const title = state.nexuses[0]?.title || 'Untitled Universe';

      // Get existing universe data to preserve folderId
      const existingUniverse = state.universeLibrary[universeId];
      const folderId = existingUniverse?.folderId || 'default';

      console.log('📂 Preserving folderId:', folderId);

      // Create universe data object
      const universeData: UniverseData = {
        nexuses: state.nexuses,
        nodes: state.nodes,
        cameraPosition: cameraPosition || [0, 20, 30],
        title,
        createdAt: existingUniverse?.createdAt || Date.now(), // Preserve creation time or set new
        lastModified: Date.now(),
        folderId: folderId,  // 🔥 CRITICAL: Preserve folderId
      };

      console.log('📦 Universe data to save:');
      console.log('   - ID:', universeId);
      console.log('   - Title:', title);
      console.log('   - Nexuses:', universeData.nexuses.length);
      console.log('   - Nodes:', Object.keys(universeData.nodes).length);

      // Update the store - ADD to library
      console.log('💾 Adding universe to library...');
      set((state) => ({
        activeUniverseId: universeId,
        universeLibrary: {
          ...state.universeLibrary,
          [universeId!]: universeData,
        },
      }));

      // VERIFICATION: Check that the update worked
      const updatedState = get();
      const libraryCountAfter = Object.keys(updatedState.universeLibrary).length;

      console.log('✅ State updated! Verifying...');
      console.log('   - Active Universe ID:', updatedState.activeUniverseId);
      console.log('   - Library count before:', libraryCountBefore);
      console.log('   - Library count after:', libraryCountAfter);
      console.log('   - Universe IDs in library:', Object.keys(updatedState.universeLibrary));

      // Verify the universe is actually in the library
      if (!updatedState.universeLibrary[universeId!]) {
        throw new Error(`Universe ${universeId} was not added to library!`);
      }
      console.log('✅ Universe confirmed in library');

      // Verify the data matches what we tried to save
      const savedUniverse = updatedState.universeLibrary[universeId!];
      if (savedUniverse.nexuses.length !== state.nexuses.length) {
        throw new Error(`Nexus count mismatch! Expected ${state.nexuses.length}, got ${savedUniverse.nexuses.length}`);
      }
      if (Object.keys(savedUniverse.nodes).length !== Object.keys(state.nodes).length) {
        throw new Error(`Node count mismatch! Expected ${Object.keys(state.nodes).length}, got ${Object.keys(savedUniverse.nodes).length}`);
      }
      console.log('✅ Data integrity verified');

      // Save library to localStorage
      console.log('💾 Persisting to localStorage...');
      get().saveToLocalStorage();

      // FINAL VERIFICATION: Check localStorage
      const lsData = localStorage.getItem('aurora-portal-data');
      if (!lsData) {
        throw new Error('localStorage is empty after save!');
      }

      const parsedLS = JSON.parse(lsData);
      if (!parsedLS.universeLibrary) {
        throw new Error('universeLibrary missing from localStorage!');
      }
      if (!parsedLS.universeLibrary[universeId!]) {
        throw new Error(`Universe ${universeId} not found in localStorage!`);
      }

      const lsCount = Object.keys(parsedLS.universeLibrary).length;
      console.log('✅ localStorage verification passed!');
      console.log('   - Universes in localStorage:', lsCount);
      console.log('   - Universe IDs:', Object.keys(parsedLS.universeLibrary));

      if (lsCount !== libraryCountAfter) {
        console.error('❌ COUNT MISMATCH: Store has', libraryCountAfter, 'but localStorage has', lsCount);
      } else {
        console.log('✅ Count matches between store and localStorage');
      }

      console.log('✅ SAVE COMPLETE - All verifications passed!');
      console.log('───────────────────────────────────');

    } catch (error) {
      console.error('❌ ==========================================');
      console.error('❌ CRITICAL ERROR in saveCurrentUniverse:', error);
      console.error('❌   Error message:', (error as Error).message);
      console.error('❌   Error stack:', (error as Error).stack);

      // Get current state for debugging
      const debugState = get();
      console.error('❌   Debug info:');
      console.error('❌      - Active Universe ID:', debugState.activeUniverseId);
      console.error('❌      - Nexuses on canvas:', debugState.nexuses.length);
      console.error('❌      - Nodes on canvas:', Object.keys(debugState.nodes).length);
      console.error('❌      - Library size:', Object.keys(debugState.universeLibrary).length);
      console.error('❌ ==========================================');

      // Alert user
      if (typeof window !== 'undefined') {
        alert('⚠️ CRITICAL ERROR: Failed to save universe!\n\n' + (error as Error).message + '\n\nCheck console for details.');
      }
    }
  },

  clearCanvas: () => {
    console.log('🌌 Clearing canvas - all nexuses and nodes removed');
    set({
      nexuses: [],
      nodes: {},
      selectedId: null,
      activeUniverseId: null,
      showContentOverlay: false,
      showReplyModal: false,
      quotedText: null,
      hoveredNodeId: null,
      connectionModeNodeA: null,
      connectionModeActive: false,
      selectedNodesForConnection: [],
    });
    console.log('✅ Canvas cleared - ready for new universe');
  },

  loadUniverse: (universeId: string) => {
    const state = get();
    const universeData = state.universeLibrary[universeId];

    if (!universeData) {
      console.error('❌ Universe not found:', universeId);
      return;
    }

    console.log('🌌 ==========================================');
    console.log('🌌 LOADING UNIVERSE:', universeId);
    console.log('🌌 Title:', universeData.title);
    console.log('🌌 Nexuses:', universeData.nexuses.length);
    console.log('🌌 Nodes:', Object.keys(universeData.nodes).length);
    console.log('🌌 Last modified:', new Date(universeData.lastModified).toLocaleString());
    console.log('🌌 ==========================================');

    // Normalize coordinates before loading
    const normalized = get().normalizeUniverseCoordinates(universeData);

    // 🎓 COURSE MODE: For course universes, preserve existing lock states
    // Regular universes don't use the lock system
    if (universeData.courseMode) {
      console.log('🎓 Course mode detected - preserving lock states from saved data');
      console.log('   - Course settings:', universeData.courseSettings);

      // Log lock states for debugging
      Object.values(normalized.nodes).forEach(node => {
        if (node.isLocked !== undefined) {
          console.log(`   - ${node.id.substring(0, 20)}... ${node.isLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'} ${node.isCompleted ? '✅ COMPLETED' : ''}`);
        }
      });

      // Load universe with preserved lock states
      set({
        activeUniverseId: universeId,
        nexuses: normalized.nexuses,
        nodes: normalized.nodes, // Keep lock states as-is from saved data
        selectedId: null,
        showContentOverlay: false,
        showReplyModal: false,
      });
    } else {
      // Regular universe - no lock system
      console.log('📚 Regular universe - no lock system');
      set({
        activeUniverseId: universeId,
        nexuses: normalized.nexuses,
        nodes: normalized.nodes,
        selectedId: null,
        showContentOverlay: false,
        showReplyModal: false,
      });
    }

    console.log('✅ Universe loaded successfully');

    // Camera will be reset by CameraManager in CanvasScene
  },

  normalizeUniverseCoordinates: (universeData: UniverseData): UniverseData => {
    console.log('📐 Normalizing universe coordinates...');

    // If no nexuses, return as-is
    if (universeData.nexuses.length === 0) {
      console.log('  No nexuses to normalize');
      return universeData;
    }

    // Get first nexus position
    const nexus = universeData.nexuses[0];
    const [offsetX, offsetY, offsetZ] = nexus.position;

    // If already at origin, return as-is
    if (offsetX === 0 && offsetY === 0 && offsetZ === 0) {
      console.log('  Already normalized at origin');
      return universeData;
    }

    console.log('  Nexus offset:', [offsetX, offsetY, offsetZ]);

    // Create normalized copies
    const normalizedNexuses = universeData.nexuses.map(n => ({
      ...n,
      position: [
        n.position[0] - offsetX,
        n.position[1] - offsetY,
        n.position[2] - offsetZ
      ] as [number, number, number]
    }));

    const normalizedNodes: { [id: string]: Node } = {};
    Object.entries(universeData.nodes).forEach(([id, node]) => {
      normalizedNodes[id] = {
        ...node,
        position: [
          node.position[0] - offsetX,
          node.position[1] - offsetY,
          node.position[2] - offsetZ
        ] as [number, number, number]
      };
    });

    console.log('✅ Universe normalized to origin');

    return {
      ...universeData,
      nexuses: normalizedNexuses,
      nodes: normalizedNodes
    };
  },

  renameUniverse: (universeId: string, newTitle: string): boolean => {
    console.log('✏️ Renaming universe:', universeId);

    // Validate title
    const trimmedTitle = newTitle.trim();

    if (!trimmedTitle) {
      console.error('❌ Cannot rename to empty title');
      return false;
    }

    if (trimmedTitle.length > 80) {
      console.error('❌ Title too long (max 80 characters)');
      return false;
    }

    const state = get();
    const universe = state.universeLibrary[universeId];

    if (!universe) {
      console.error('❌ Universe not found');
      return false;
    }

    console.log('  Old title:', universe.title);
    console.log('  New title:', trimmedTitle);

    // Update the universe library
    set({
      universeLibrary: {
        ...state.universeLibrary,
        [universeId]: {
          ...universe,
          title: trimmedTitle,
          lastModified: Date.now()
        }
      }
    });

    // CRITICAL: If this universe is currently active, also update the loaded nexus title
    if (state.activeUniverseId === universeId && state.nexuses.length > 0) {
      const updatedNexuses = state.nexuses.map(nexus =>
        nexus.id === universe.nexuses[0]?.id
          ? { ...nexus, title: trimmedTitle }
          : nexus
      );

      set({ nexuses: updatedNexuses });
      console.log('✅ Also updated currently loaded nexus title');
    }

    // Save to localStorage
    get().saveToLocalStorage();
    console.log('✅ Universe renamed and saved');

    return true;
  },

  // 🌌 MULTI-UNIVERSE MANAGEMENT FUNCTIONS

  calculateUniversePosition: (index: number, total: number): [number, number, number] => {
    // Position universes in a circle around the origin
    // Radius increases with more universes to prevent overlap
    const baseRadius = 50; // Base distance from center
    const radius = baseRadius + (Math.floor(total / 6) * 30); // Expand radius for many universes

    if (total === 1) {
      // Single universe at origin
      return [0, 0, 0];
    }

    // Calculate angle for this universe (evenly distributed around circle)
    const angle = (index / total) * Math.PI * 2;

    const x = -Math.cos(angle) * radius; // Flipped: first universe on left
    const z = Math.sin(angle) * radius;
    const y = 0; // Keep all on same horizontal plane

    return [x, y, z];
  },

  toggleUniverseActive: (universeId: string) => {
    const state = get();

    console.log('🔄 Toggle universe active:', universeId);

    if (state.activeUniverseIds.includes(universeId)) {
      // Remove from active list
      console.log('  → Deactivating universe');
      const newActiveIds = state.activeUniverseIds.filter(id => id !== universeId);

      set({ activeUniverseIds: newActiveIds });

      // Reload the remaining active universes
      if (newActiveIds.length > 0) {
        get().loadMultipleUniverses(newActiveIds);
      } else {
        // No universes active, clear canvas
        get().clearCanvas();
      }
    } else {
      // Add to active list
      console.log('  → Activating universe');
      const newActiveIds = [...state.activeUniverseIds, universeId];

      set({ activeUniverseIds: newActiveIds });

      // Reload all active universes with new positioning
      get().loadMultipleUniverses(newActiveIds);
    }

    console.log('✅ Active universes:', get().activeUniverseIds.length);
  },

  loadMultipleUniverses: (universeIds: string[]) => {
    console.log('🌌 ==========================================');
    console.log('🌌 LOADING MULTIPLE UNIVERSES:', universeIds.length);
    console.log('🌌 IDs:', universeIds);
    console.log('🌌 ==========================================');

    const state = get();
    const allNexuses: Nexus[] = [];
    const allNodes: { [id: string]: Node } = {};

    universeIds.forEach((universeId, index) => {
      const universeData = state.universeLibrary[universeId];

      if (!universeData) {
        console.error('❌ Universe not found:', universeId);
        return;
      }

      console.log(`📐 Processing universe ${index + 1}/${universeIds.length}: ${universeData.title}`);

      // Normalize coordinates first
      const normalized = get().normalizeUniverseCoordinates(universeData);

      // Calculate this universe's position in the multi-universe layout
      const [offsetX, offsetY, offsetZ] = get().calculateUniversePosition(index, universeIds.length);

      console.log(`  Position offset: [${offsetX}, ${offsetY}, ${offsetZ}]`);

      // Add nexuses with offset
      normalized.nexuses.forEach(nexus => {
        allNexuses.push({
          ...nexus,
          position: [
            nexus.position[0] + offsetX,
            nexus.position[1] + offsetY,
            nexus.position[2] + offsetZ
          ] as [number, number, number]
        });
      });

      // Add nodes with offset
      Object.entries(normalized.nodes).forEach(([nodeId, node]) => {
        allNodes[nodeId] = {
          ...node,
          position: [
            node.position[0] + offsetX,
            node.position[1] + offsetY,
            node.position[2] + offsetZ
          ] as [number, number, number]
        };
      });
    });

    console.log('✅ Loaded:', allNexuses.length, 'nexuses,', Object.keys(allNodes).length, 'nodes');

    // Update canvas with all universes
    set({
      nexuses: allNexuses,
      nodes: allNodes,
      selectedId: null,
      showContentOverlay: false,
      showReplyModal: false,
    });

    console.log('🌌 ==========================================');
    console.log('🌌 MULTI-UNIVERSE LOAD COMPLETE');
    console.log('🌌 ==========================================');
  },

  // 📁 FOLDER MANAGEMENT FUNCTIONS
  createFolder: (name: string, color: string): string => {
    const newId = `folder-${Date.now()}`;

    set(state => ({
      folders: {
        ...state.folders,
        [newId]: {
          id: newId,
          name: name,
          color: color,
          createdAt: Date.now()
        }
      }
    }));

    console.log('📁 Created folder:', name, newId);
    get().saveToLocalStorage();

    return newId;
  },

  renameFolder: (folderId: string, newName: string) => {
    set(state => ({
      folders: {
        ...state.folders,
        [folderId]: {
          ...state.folders[folderId],
          name: newName
        }
      }
    }));

    console.log('📁 Renamed folder:', folderId, 'to', newName);
    get().saveToLocalStorage();
  },

  deleteFolder: (folderId: string) => {
    // Move all universes in this folder to Uncategorized
    set(state => {
      const updatedUniverses = { ...state.universeLibrary };
      Object.keys(updatedUniverses).forEach(universeId => {
        if (updatedUniverses[universeId].folderId === folderId) {
          updatedUniverses[universeId].folderId = 'default';
        }
      });

      const updatedFolders = { ...state.folders };
      delete updatedFolders[folderId];

      return {
        universeLibrary: updatedUniverses,
        folders: updatedFolders
      };
    });

    console.log('📁 Deleted folder:', folderId);
    get().saveToLocalStorage();
  },

  moveUniverseToFolder: (universeId: string, folderId: string) => {
    set(state => ({
      universeLibrary: {
        ...state.universeLibrary,
        [universeId]: {
          ...state.universeLibrary[universeId],
          folderId: folderId
        }
      }
    }));

    console.log('📁 Moved universe', universeId, 'to folder', folderId);
    get().saveToLocalStorage();
  },

  // 🧹 CLEANUP: Delete orphaned universes (universes whose folder no longer exists)
  cleanupOrphanedUniverses: () => {
    const state = get();
    const folderIds = Object.keys(state.folders);
    let deleted = 0;
    const migrated = 0;

    const updatedLibrary = { ...state.universeLibrary };

    Object.entries(state.universeLibrary).forEach(([universeId, universeData]) => {
      const folderId = universeData.folderId || 'default';

      // If the folder doesn't exist, delete the universe
      if (!folderIds.includes(folderId)) {
        console.log(`🧹 Deleting orphaned universe: "${universeData.title}" (folder: ${folderId})`);
        delete updatedLibrary[universeId];
        deleted++;
      }
    });

    set({ universeLibrary: updatedLibrary });
    get().saveToLocalStorage();

    console.log(`🧹 Cleanup complete: Deleted ${deleted} orphaned universes`);
    return { deleted, migrated };
  },

  // 🔧 FIX: Migrate orphaned universes to default folder instead of deleting
  fixOrphanedUniverses: () => {
    const state = get();
    const folderIds = Object.keys(state.folders);
    let fixed = 0;

    const updatedLibrary = { ...state.universeLibrary };

    Object.entries(state.universeLibrary).forEach(([universeId, universeData]) => {
      const folderId = universeData.folderId || 'default';

      // If the folder doesn't exist, move to default
      if (!folderIds.includes(folderId)) {
        console.log(`🔧 Fixing orphaned universe: "${universeData.title}" (${folderId} → default)`);
        updatedLibrary[universeId].folderId = 'default';
        fixed++;
      }
    });

    if (fixed > 0) {
      set({ universeLibrary: updatedLibrary });
      get().saveToLocalStorage();
      console.log(`🔧 Fixed ${fixed} orphaned universes by moving to Uncategorized`);
    }

    return fixed;
  },

  // 🔬 ATOMIZE UNIVERSE
  getL1Nodes: (universeId: string): Node[] => {
    const state = get();
    const universe = state.universeLibrary[universeId];

    if (!universe) {
      console.error('❌ Universe not found:', universeId);
      return [];
    }

    // Get all nexus IDs from this universe
    const nexusIds = universe.nexuses.map(n => n.id);

    // Find all nodes whose parentId is a nexus (these are L1 nodes)
    const l1Nodes: Node[] = [];
    Object.values(universe.nodes).forEach(node => {
      if (nexusIds.includes(node.parentId)) {
        l1Nodes.push(node);
      }
    });

    console.log('🔬 Found', l1Nodes.length, 'L1 nodes in universe', universeId);
    return l1Nodes;
  },

  // 🧠 UNIVERSE ACTIVATION METHODS
  activateUniverse: (universeId: string): boolean => {
    const state = get();

    // Check if already activated
    if (state.activatedUniverseIds.includes(universeId)) {
      console.log('🧠 Universe already activated:', universeId);
      return true;
    }

    // Check limit
    if (state.activatedUniverseIds.length >= state.maxActivatedUniverses) {
      console.warn('🧠 Cannot activate universe - limit reached (5 max)');
      return false;
    }

    // Check if universe exists
    if (!state.universeLibrary[universeId]) {
      console.error('🧠 Cannot activate - universe not found:', universeId);
      return false;
    }

    // Activate
    set({
      activatedUniverseIds: [...state.activatedUniverseIds, universeId]
    });

    console.log('🧠 Activated universe:', state.universeLibrary[universeId].title);
    console.log('🧠 Total activated:', state.activatedUniverseIds.length + 1);

    return true;
  },

  deactivateUniverse: (universeId: string): void => {
    const state = get();

    if (!state.activatedUniverseIds.includes(universeId)) {
      console.log('🧠 Universe not activated:', universeId);
      return;
    }

    set({
      activatedUniverseIds: state.activatedUniverseIds.filter(id => id !== universeId)
    });

    console.log('🧠 Deactivated universe:', state.universeLibrary[universeId]?.title || universeId);
    console.log('🧠 Total activated:', get().activatedUniverseIds.length);
  },

  clearActivatedUniverses: (): void => {
    const count = get().activatedUniverseIds.length;
    set({ activatedUniverseIds: [] });
    console.log('🧠 Cleared all activated universes (', count, ')');
  },

  isUniverseActivated: (universeId: string): boolean => {
    return get().activatedUniverseIds.includes(universeId);
  },

  // 🏛️ MEMORY PALACE MODE FUNCTIONS
  toggleMemoryPalaceMode: () => {
    const state = get();
    const newMode = !state.isMemoryPalaceMode;
    console.log(`🏛️ Memory Palace Mode: ${newMode ? 'ENABLED' : 'DISABLED'}`);

    if (newMode) {
      // Entering Memory Palace: Start transition animation
      set({ isTransitioning: true });

      // After 2 seconds, complete transition
      setTimeout(() => {
        set({
          isMemoryPalaceMode: true,
          memoryPalaceCurrentIndex: 0,
          isTransitioning: false
        });
      }, 2000);
    } else {
      // Exiting Memory Palace: Instant switch (or could add exit animation)
      set({
        isMemoryPalaceMode: false,
        memoryPalaceCurrentIndex: 0
      });
    }
  },

  setIsTransitioning: (isTransitioning: boolean) => {
    set({ isTransitioning });
  },

  navigateToNextNode: () => {
    const state = get();
    const totalNodes = Object.keys(state.nodes).length;

    if (totalNodes === 0) return;

    const nextIndex = (state.memoryPalaceCurrentIndex + 1) % totalNodes;
    console.log(`🏛️ Navigating to next node: ${nextIndex} / ${totalNodes}`);

    set({ memoryPalaceCurrentIndex: nextIndex });
  },

  navigateToPreviousNode: () => {
    const state = get();
    const totalNodes = Object.keys(state.nodes).length;

    if (totalNodes === 0) return;

    const prevIndex = state.memoryPalaceCurrentIndex === 0
      ? totalNodes - 1
      : state.memoryPalaceCurrentIndex - 1;

    console.log(`🏛️ Navigating to previous node: ${prevIndex} / ${totalNodes}`);

    set({ memoryPalaceCurrentIndex: prevIndex });
  },

  setMemoryPalaceIndex: (index: number) => {
    set({ memoryPalaceCurrentIndex: index });
  },

  // 🔬 APPLICATION LAB MODE FUNCTIONS
  toggleApplicationLabMode: () => {
    const state = get();
    const newMode = !state.isApplicationLabMode;
    console.log(`🔬 Application Lab Mode TOGGLE: ${state.isApplicationLabMode} → ${newMode}`);

    set({
      isApplicationLabMode: newMode
    });
  },

  enableApplicationLabMode: () => {
    console.log('🔬 ENABLING Application Lab Mode (forcing TRUE)');
    set({
      isApplicationLabMode: true
    });
  },

  disableApplicationLabMode: () => {
    console.log('🔬 DISABLING Application Lab Mode (forcing FALSE) and clearing analysis');
    set({
      isApplicationLabMode: false,
      applicationLabAnalysis: null,
      isAnalyzingUniverse: false
    });
  },

  analyzeUniverseContent: async () => {
    const state = get();
    console.log('🔬 Starting universe content analysis...');

    set({ isAnalyzingUniverse: true });

    try {
      // Gather all content from nexuses and nodes
      const allContent: string[] = [];

      // Add nexus content
      state.nexuses.forEach(nexus => {
        allContent.push(`NEXUS: ${nexus.title}\n${nexus.content}`);
      });

      // Add node content
      Object.values(state.nodes).forEach((node: any) => {
        allContent.push(`NODE: ${node.title}\n${node.content}`);
      });

      const combinedContent = allContent.join('\n\n---\n\n');

      console.log(`🔬 Analyzing ${allContent.length} items...`);

      // Call API to analyze content
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: combinedContent
          }],
          mode: 'analyze-universe'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze universe content');
      }

      const data = await response.json();
      const analysisText = data.response;

      // Parse JSON from response
      let analysisData;
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/) ||
          analysisText.match(/```\n([\s\S]*?)\n```/) ||
          [null, analysisText];
        const jsonStr = jsonMatch[1] || analysisText;
        analysisData = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse analysis JSON:', e);
        throw new Error('Failed to parse analysis results');
      }

      console.log('🔬 Analysis complete:', analysisData);

      set({
        applicationLabAnalysis: {
          topics: analysisData.topics || [],
          cases: analysisData.cases || [],
          doctrines: analysisData.doctrines || [],
          analyzedAt: Date.now()
        },
        isAnalyzingUniverse: false
      });

    } catch (error) {
      console.error('🔬 Analysis error:', error);
      set({ isAnalyzingUniverse: false });
      throw error;
    }
  },

  atomizeUniverse: async (
    universeId: string,
    onProgress?: (current: number, total: number, status: string, errors: string[]) => void
  ): Promise<{ success: boolean; newUniverseIds: string[]; error?: string; errors: string[] }> => {
    const state = get();
    const universe = state.universeLibrary[universeId];

    if (!universe) {
      return { success: false, newUniverseIds: [], error: 'Universe not found', errors: [] };
    }

    console.log('🔬 ==========================================');
    console.log('🔬 ATOMIZING UNIVERSE:', universe.title);
    console.log('🔬 ==========================================');

    try {
      const newUniverseIds: string[] = [];
      const errors: string[] = [];

      // Get all L1 nodes
      const l1Nodes = get().getL1Nodes(universeId);

      if (l1Nodes.length === 0) {
        return { success: false, newUniverseIds: [], error: 'No L1 nodes found to atomize', errors: [] };
      }

      // Report initial progress
      if (onProgress) {
        onProgress(0, l1Nodes.length, 'Starting atomization...', errors);
      }

      // Create "Atomized" folder if it doesn't exist
      let atomizedFolderId = Object.keys(state.folders).find(
        folderId => state.folders[folderId].name === 'Atomized'
      );

      if (!atomizedFolderId) {
        atomizedFolderId = get().createFolder('Atomized', '#F59E0B');
        console.log('🔬 Created Atomized folder:', atomizedFolderId);
      }

      // For each L1 node, call API and create a new universe
      for (let i = 0; i < l1Nodes.length; i++) {
        const l1Node = l1Nodes[i];
        const nodeTitle = l1Node.semanticTitle || l1Node.content.substring(0, 50) + '...';
        console.log(`🔬 Processing L1 node ${i + 1}/${l1Nodes.length}:`, nodeTitle);

        // Report progress - starting this universe
        if (onProgress) {
          onProgress(i, l1Nodes.length, `Creating universe ${i + 1} of ${l1Nodes.length}: "${nodeTitle}"`, errors);
        }

        try {
          // 🤖 Call API with mode: 'break-off' to generate new L1 nodes
          console.log('🤖 Calling API to atomize node...');
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: l1Node.content }],
              mode: 'break-off',
              nodeContent: l1Node.content,
            }),
          });

          if (!response.ok) {
            const errorMsg = `Failed to create universe from "${nodeTitle}": API returned ${response.status}`;
            console.error('❌', errorMsg);
            errors.push(errorMsg);
            continue; // Skip this node and continue with others
          }

          const data = await response.json();
          console.log('✅ API response:', data);

          if (!data.newUniverse || !data.newUniverse.nodes) {
            const errorMsg = `Failed to create universe from "${nodeTitle}": Invalid API response`;
            console.error('❌', errorMsg);
            errors.push(errorMsg);
            continue;
          }

          const { nexusTitle, nexusContent, nodes: apiNodes } = data.newUniverse;

          // Create a new nexus from the API response
          const newNexusId = `nexus-${Date.now()}-${i}`;
          const newNexus: Nexus = {
            id: newNexusId,
            position: [0, 0, 0], // Centered position
            content: nexusContent || l1Node.content,
            title: nexusTitle || l1Node.semanticTitle || l1Node.content.substring(0, 50),
            type: 'social'
          };

          // Create L1 nodes from API response using Fibonacci sphere distribution
          const newNodes: { [id: string]: Node } = {};
          const nexusPos = newNexus.position;
          const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 137.5 degrees

          console.log(`🌟 Creating ${apiNodes.length} L1 nodes around nexus...`);

          for (let nodeIndex = 0; nodeIndex < apiNodes.length; nodeIndex++) {
            const apiNode = apiNodes[nodeIndex];

            // Position using golden angle spiral (same as regular L1 nodes)
            const baseRadius = 6;
            const radiusIncrement = 0.4;
            const radius = baseRadius + (nodeIndex * radiusIncrement);

            const nodesPerRing = 6;
            const ringIndex = Math.floor(nodeIndex / nodesPerRing);
            const positionInRing = nodeIndex % nodesPerRing;

            const ringRotationOffset = ringIndex * goldenAngle;
            const angle = (positionInRing * 2 * Math.PI) / nodesPerRing + ringRotationOffset;

            let y = 0;
            if (ringIndex > 0) {
              const step = Math.ceil(ringIndex / 2);
              const direction = ringIndex % 2 === 1 ? 1 : -1;
              y = step * 2.5 * direction;
            }

            const x = nexusPos[0] - Math.cos(angle) * radius; // Flipped: first node on left
            const z = nexusPos[2] + Math.sin(angle) * radius;

            const newNodeId = `node-${Date.now()}-${i}-${nodeIndex}`;
            const newNode: Node = {
              id: newNodeId,
              position: [x, y, z],
              title: apiNode.content.substring(0, 50),
              content: apiNode.content,
              parentId: newNexusId,
              children: [],
              nodeType: 'ai-response', // Mark as AI-generated
            };

            newNodes[newNodeId] = newNode;
            console.log(`  ✓ L1 node ${nodeIndex + 1}: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);

            // Small delay to ensure unique IDs
            await new Promise(resolve => setTimeout(resolve, 5));
          }

          // Create the new universe
          const newUniverseId = `universe-${Date.now()}-${i}`;
          const newUniverse: UniverseData = {
            nexuses: [newNexus],
            nodes: newNodes,
            cameraPosition: [10, 8, 15],
            title: newNexus.title,
            createdAt: Date.now(),
            lastModified: Date.now(),
            folderId: atomizedFolderId
          };

          // Add to library
          set(state => ({
            universeLibrary: {
              ...state.universeLibrary,
              [newUniverseId]: newUniverse
            }
          }));

          newUniverseIds.push(newUniverseId);
          console.log(`🔬 Created new universe: "${newUniverse.title}" with ${apiNodes.length} L1 nodes`);

          // Report progress - completed this universe
          if (onProgress) {
            onProgress(i + 1, l1Nodes.length, `Completed universe ${i + 1} of ${l1Nodes.length}`, errors);
          }

          // Delay between universes to ensure unique timestamps
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (nodeError) {
          const errorMsg = `Failed to process "${nodeTitle}": ${String(nodeError)}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      // Save to localStorage
      get().saveToLocalStorage();

      // Report final progress
      if (onProgress) {
        onProgress(l1Nodes.length, l1Nodes.length, 'Atomization complete!', errors);
      }

      console.log('🔬 ==========================================');
      console.log('🔬 ATOMIZATION COMPLETE!');
      console.log('🔬 Created', newUniverseIds.length, 'new universes');
      if (errors.length > 0) {
        console.log('🔬 Errors:', errors.length);
      }
      console.log('🔬 ==========================================');

      return { success: true, newUniverseIds, errors };

    } catch (error) {
      console.error('❌ Error atomizing universe:', error);
      return { success: false, newUniverseIds: [], error: String(error), errors: [String(error)] };
    }
  },

  // 🛡️ BACKUP LIBRARY
  backupLibrary: () => {
    try {
      const current = localStorage.getItem('aurora-portal-data');

      // Only backup if data exists and is not null
      if (current && current !== 'null') {
        localStorage.setItem('aurora-portal-data-backup', current);
        console.log('🛡️ Library backed up successfully');
      } else {
        console.log('🛡️ No valid data to backup');
      }
    } catch (error) {
      console.error('❌ Failed to backup library:', error);
    }
  },

  // 🛡️ RECOVER FROM BACKUP
  recoverFromBackup: () => {
    try {
      const backup = localStorage.getItem('aurora-portal-data-backup');

      if (!backup || backup === 'null') {
        console.error('❌ No backup found');
        return false;
      }

      // Verify backup is valid JSON
      try {
        const parsed = JSON.parse(backup);
        if (!parsed.universeLibrary) {
          console.error('❌ Backup is corrupted (missing universeLibrary)');
          return false;
        }
      } catch (e) {
        console.error('❌ Backup is corrupted (invalid JSON)');
        return false;
      }

      // Restore from backup
      localStorage.setItem('aurora-portal-data', backup);
      console.log('✅ Successfully recovered library from backup!');
      console.log('🛡️ Please reload the page to load recovered data');

      // Alert user
      if (typeof window !== 'undefined') {
        alert('✅ Library recovered from backup!\n\nPlease refresh the page to load your universes.');
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to recover from backup:', error);
      return false;
    }
  },
}));

// 🐛 Enable showActive debug helper now that store is created
if (typeof window !== 'undefined' && (window as any).auroraDebug) {
  // Expose store for debug helpers
  (window as any).auroraStore = useCanvasStore;

  (window as any).auroraDebug.showActive = () => {
    const state = useCanvasStore.getState();
    console.log('🎯 ==========================================');
    console.log('🎯 ACTIVE CANVAS STATE');
    console.log('🎯   Active Universe ID:', state.activeUniverseId || 'none');
    console.log('🎯   Nexuses on canvas:', state.nexuses?.length || 0);
    console.log('🎯   Nodes on canvas:', Object.keys(state.nodes || {}).length);
    console.log('🎯   Selected ID:', state.selectedId || 'none');
    console.log('🎯   Library size:', Object.keys(state.universeLibrary || {}).length, 'universes');
    console.log('🎯 ==========================================');
    return state;
  };

  // Update recoverLibrary now that store is available
  (window as any).auroraDebug.recoverLibrary = () => {
    console.log('🛡️ Attempting to recover library from backup...');
    return useCanvasStore.getState().recoverFromBackup();
  };
}