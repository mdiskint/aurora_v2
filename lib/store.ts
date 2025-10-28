import { create } from 'zustand';
import { Node } from './types';
import { generateSemanticTitle, generateSemanticTitles } from './titleGenerator';

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

        for (let key in localStorage) {
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

  localStorage.setItem = function(key: string, value: string) {
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

  localStorage.removeItem = function(key: string) {
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

  localStorage.clear = function() {
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

interface Nexus {
  id: string;
  position: [number, number, number];
  content: string;
  title: string;
  videoUrl?: string;
  audioUrl?: string;
  type?: 'academic' | 'social';
}

interface UniverseData {
  nexuses: Nexus[];
  nodes: { [id: string]: Node };
  cameraPosition: [number, number, number];
  title: string;
  lastModified: number;
}

interface CanvasStore {
  // 🌌 UNIVERSE LIBRARY - Each universe stored separately
  activeUniverseId: string | null;
  universeLibrary: { [id: string]: UniverseData };

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
  updateNodeContent: (nodeId: string, newContent: string) => void;
  updateNexusContent: (nexusId: string, newContent: string) => void;
  updateNodeSemanticTitle: (nodeId: string, semanticTitle: string) => void;
  exportToWordDoc: () => void;
  addNode: (content: string, parentId: string, quotedText?: string, nodeType?: 'user-reply' | 'ai-response' | 'socratic-question' | 'socratic-answer' | 'inspiration' | 'synthesis') => string;
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
  addNodeFromWebSocket: (data: any) => void;
  addNexusFromWebSocket: (data: any) => void;
  activatedConversations: string[];
  toggleActivateConversation: (nexusId: string) => void;
  getActivatedConversations: () => Nexus[];
  deleteConversation: (nexusId: string) => void;
  deleteNode: (nodeId: string) => void;
  revertToOriginal: (nexusId: string) => void;
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
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // 🌌 UNIVERSE LIBRARY - Start with blank canvas
  activeUniverseId: null,
  universeLibrary: {},

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

  // 💾 SAVE TO LOCALSTORAGE
  saveToLocalStorage: () => {
    const state = get();

    // 🔍 DIAGNOSTIC: Capture call stack to see who triggered this save
    const saveStack = new Error().stack || '';
    const saveCaller = saveStack.split('\n')[2]?.trim() || 'unknown';

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

      localStorage.setItem('aurora-portal-data', serialized);

      // Comprehensive logging
      const universeCount = Object.keys(state.universeLibrary).length;
      console.log('💾 ==========================================');
      console.log('💾 SAVE TO LOCALSTORAGE:', new Date().toLocaleTimeString());
      console.log('💾 🔍 Called from:', saveCaller);
      console.log('💾 Universes in library:', universeCount);
      if (universeCount > 0) {
        Object.entries(state.universeLibrary).forEach(([id, data]) => {
          console.log(`💾   - ${data.title} (${data.nexuses.length} nexuses, ${Object.keys(data.nodes).length} nodes)`);
        });
      }
      console.log('💾 Data size:', (serialized.length / 1024).toFixed(2), 'KB');
      console.log('💾 Storage key:', 'aurora-portal-data');
      console.log('💾 ==========================================');

      // 🔍 DIAGNOSTIC: Verify save worked by reading back
      const verification = localStorage.getItem('aurora-portal-data');
      if (!verification) {
        throw new Error('Save verification failed - data not in localStorage!');
      }
      const verifiedData = JSON.parse(verification);
      const verifiedCount = Object.keys(verifiedData.universeLibrary || {}).length;
      console.log('💾 ✅ VERIFICATION: Data confirmed in localStorage (' + verifiedCount + ' universes)');

      if (verifiedCount !== universeCount) {
        console.error('💾 🚨 VERIFICATION MISMATCH! Saved', universeCount, 'but found', verifiedCount);
      }
    } catch (error) {
      console.error('❌ ==========================================');
      console.error('❌ CRITICAL: Failed to save to localStorage:', error);
      console.error('❌ ==========================================');

      // Alert user of data loss risk
      if (typeof window !== 'undefined') {
        alert('⚠️ WARNING: Failed to save your universe!\n\nYour changes may be lost. Please:\n1. Take a screenshot\n2. Copy your content\n3. Refresh the page\n\nError: ' + (error as Error).message);
      }
    }
  },

  // 📂 LOAD FROM LOCALSTORAGE
  loadFromLocalStorage: () => {
    try {
      // 🔍 DIAGNOSTIC: Capture call stack
      const loadStack = new Error().stack || '';
      const loadCaller = loadStack.split('\n')[2]?.trim() || 'unknown';

      console.log('📂 ==========================================');
      console.log('📂 LOAD FROM LOCALSTORAGE:', new Date().toLocaleTimeString());
      console.log('📂 🔍 Called from:', loadCaller);

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
          get().loadFromLocalStorage();
          return;
        } else {
          console.error('❌ No backup available - starting with empty library');
          console.log('📂 Starting with blank canvas and empty library');
          console.log('📂 ==========================================');
          return;
        }
      }

      if (!saved) {
        console.log('📂 No saved data found in localStorage');
        console.log('📂 Starting with blank canvas and empty library');
        console.log('📂 ==========================================');
        return;
      }

      const data = JSON.parse(saved);

      // 🛡️ CRITICAL: Verify data structure
      if (!data || typeof data !== 'object') {
        console.error('🚨 DATA IS CORRUPTED! Attempting recovery...');
        const recovered = get().recoverFromBackup();
        if (recovered) {
          get().loadFromLocalStorage();
          return;
        }
        throw new Error('Data is corrupted and no backup available');
      }

      // 🛡️ CRITICAL: Verify universeLibrary exists
      if (!data.universeLibrary || typeof data.universeLibrary !== 'object') {
        console.error('🚨 UNIVERSE LIBRARY IS MISSING OR CORRUPTED! Attempting recovery...');
        const recovered = get().recoverFromBackup();
        if (recovered) {
          get().loadFromLocalStorage();
          return;
        }
        console.warn('⚠️ No backup - initializing empty library');
        data.universeLibrary = {};
      }

      // Load universe library (not the canvas - canvas stays blank)
      const universeLibrary = data.universeLibrary || {};
      const universeCount = Object.keys(universeLibrary).length;

      console.log('📂 Found data from:', data.timestamp ? new Date(data.timestamp).toLocaleString() : 'unknown time');
      console.log('📂 Universes in library:', universeCount);

      if (universeCount > 0) {
        Object.entries(universeLibrary).forEach(([id, uData]: [string, any]) => {
          console.log(`📂   - ${uData.title} (${uData.nexuses.length} nexuses, ${Object.keys(uData.nodes).length} nodes)`);
        });
      }

      set({
        universeLibrary,
        activatedConversations: data.activatedConversations || [],
        // Canvas stays blank - user loads universes from Memories
        nexuses: [],
        nodes: {},
        activeUniverseId: null,
      });

      console.log('✅ Successfully loaded universe library from localStorage!');
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

    } catch (error) {
      console.error('❌ ==========================================');
      console.error('❌ CRITICAL: Failed to load from localStorage:', error);
      console.error('❌ ==========================================');

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
      };

      console.log('🆕   🟢 Created NEW nexus with ID:', newUniverseId);

      return { nexuses: [newNexus] }; // Start fresh with just this nexus
    });

    // 🌌 STEP 4: Auto-save the new universe to library
    console.log('🆕   💾 Auto-saving new universe to library...');
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
  
  addNode: (content: string, parentId: string, quotedText?: string, nodeType?: 'user-reply' | 'ai-response' | 'socratic-question' | 'socratic-answer' | 'inspiration' | 'synthesis') => {
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
        const x = metaPos[0] + Math.cos(angle) * radius;
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

    let newNexus: Nexus = {
      id: newUniverseId,
      position: [0, 0, 0],
      title: title,
      content: `You: ${userMessage}\n\nClaude: ${aiResponse}`,
      type: 'social'
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

        return {
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
      console.log('🗑️   Library count after:', libraryCountAfter);
      console.log('🗑️   Universe IDs after:', Object.keys(updatedState.universeLibrary));

      if (updatedState.universeLibrary[nexusId]) {
        console.error('🗑️   ❌ ERROR: Universe still in library after deletion!');
      } else {
        console.log('🗑️   ✅ Verified: Universe removed from library');
      }

      // Save to localStorage
      console.log('🗑️   💾 Persisting deletion to localStorage...');
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

  // 🔄 REVERT TO ORIGINAL - Keep only nexus + L1 nodes
  revertToOriginal: (nexusId: string) => {
    console.log('🔄 ==========================================');
    console.log('🔄 REVERT TO ORIGINAL:', new Date().toLocaleTimeString());
    console.log('🔄   Universe ID:', nexusId);

    try {
      const state = get();

      // Check if universe exists in library
      if (!state.universeLibrary[nexusId]) {
        console.error('🔄   ❌ Universe not found in library');
        return;
      }

      const universe = state.universeLibrary[nexusId];
      console.log('🔄   Universe title:', universe.title);
      console.log('🔄   Total nodes before:', Object.keys(universe.nodes).length);

      // Keep only L1 nodes (nodes whose parent is the nexus)
      const l1Nodes: { [id: string]: Node } = {};
      Object.entries(universe.nodes).forEach(([nodeId, node]) => {
        if (node.parentId === nexusId) {
          l1Nodes[nodeId] = node;
        }
      });

      const l1NodeCount = Object.keys(l1Nodes).length;
      const removedCount = Object.keys(universe.nodes).length - l1NodeCount;

      console.log('🔄   L1 nodes kept:', l1NodeCount);
      console.log('🔄   Exploration nodes removed:', removedCount);

      // Update universe in library
      set((state) => {
        const updatedLibrary = {
          ...state.universeLibrary,
          [nexusId]: {
            ...universe,
            nodes: l1Nodes,
            lastModified: Date.now()
          }
        };

        // If this is the active universe, update canvas state
        if (state.activeUniverseId === nexusId) {
          console.log('🔄   Updating active canvas state');
          return {
            universeLibrary: updatedLibrary,
            nodes: l1Nodes
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
      console.error('❌   Universe ID:', nexusId);
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

  // 🌌 UNIVERSE MANAGEMENT FUNCTIONS

  saveCurrentUniverse: (cameraPosition?: [number, number, number]) => {
    console.log('───────────────────────────────────');
    console.log('💾 SAVE CURRENT UNIVERSE CALLED');
    console.log('───────────────────────────────────');

    try {
      const state = get();

      console.log('Active Universe ID:', state.activeUniverseId);
      console.log('Nexuses:', state.nexuses);
      console.log('Nexuses count:', state.nexuses.length);
      console.log('Nodes count:', Object.keys(state.nodes).length);
      console.log('Current library size:', Object.keys(state.universeLibrary).length);
      console.log('Current universe IDs in library:', Object.keys(state.universeLibrary));

      // Check 1: Do we have an ID?
      if (!state.activeUniverseId) {
        console.error('❌ SAVE FAILED: No active universe ID');
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
      let universeId = state.activeUniverseId;
      const libraryBeforeSave = { ...state.universeLibrary };
      const libraryCountBefore = Object.keys(libraryBeforeSave).length;

      console.log('📊 Library state before save:');
      console.log('   - Library count:', libraryCountBefore);
      console.log('   - Universe IDs:', Object.keys(libraryBeforeSave));

      // Get title from first nexus
      const title = state.nexuses[0]?.title || 'Untitled Universe';

      // Create universe data object
      const universeData: UniverseData = {
        nexuses: state.nexuses,
        nodes: state.nodes,
        cameraPosition: cameraPosition || [0, 20, 30],
        title,
        lastModified: Date.now(),
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

    // Load the universe data to the canvas
    set({
      activeUniverseId: universeId,
      nexuses: universeData.nexuses,
      nodes: universeData.nodes,
      selectedId: null,
      showContentOverlay: false,
      showReplyModal: false,
    });

    console.log('✅ Universe loaded successfully');

    // TODO: Restore camera position (will be implemented in step 8)
    // This will require integration with the camera controls in CanvasScene
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