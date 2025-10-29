'use client';

import { useCanvasStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { listBackups, restoreBackup } from '@/lib/db';

export default function MemoriesPage() {
  const router = useRouter();

  const folders = useCanvasStore(state => state.folders);
  const universeLibrary = useCanvasStore(state => state.universeLibrary);
  const createFolder = useCanvasStore(state => state.createFolder);
  const renameFolder = useCanvasStore(state => state.renameFolder);
  const deleteFolder = useCanvasStore(state => state.deleteFolder);
  const moveUniverseToFolder = useCanvasStore(state => state.moveUniverseToFolder);
  const loadUniverse = useCanvasStore(state => state.loadUniverse);
  const deleteConversation = useCanvasStore(state => state.deleteConversation);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#8B5CF6');

  // 🔄 Recovery UI state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [backups, setBackups] = useState<Array<{id: string; timestamp: number; label: string; date: string}>>([]);

  // 🚀 LOAD DATA FROM LOCALSTORAGE WHEN PAGE OPENS
  useEffect(() => {
    console.log('📚 MEMORIES PAGE LOADED:', new Date().toLocaleTimeString());
    useCanvasStore.getState().loadFromLocalStorage();

    // Expand all folders by default
    const folderIds = Object.keys(useCanvasStore.getState().folders);
    setExpandedFolders(new Set(folderIds));

    // Load available backups
    listBackups().then(setBackups);
  }, []);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim(), selectedColor);
      setNewFolderName('');
      setShowNewFolderModal(false);

      // Auto-expand the new folder
      setTimeout(() => {
        const newFolderId = `folder-${Date.now()}`;
        setExpandedFolders(prev => new Set(prev).add(newFolderId));
      }, 100);
    }
  };

  const handleRenameFolder = (folderId: string) => {
    const folder = folders[folderId];
    const newName = prompt('Rename folder:', folder.name);
    if (newName && newName.trim()) {
      renameFolder(folderId, newName.trim());
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    if (folderId === 'default') {
      alert('Cannot delete Uncategorized folder');
      return;
    }

    const folder = folders[folderId];
    if (confirm(`Delete folder "${folder.name}"? Universes will move to Uncategorized.`)) {
      deleteFolder(folderId);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Restore from this backup? Your current data will be replaced.')) {
      return;
    }

    const data = await restoreBackup(backupId);
    if (data) {
      // Update Zustand store with restored data
      useCanvasStore.setState({
        universeLibrary: data.universeLibrary || {},
        folders: data.folders || {},
        activatedConversations: data.activatedConversations || [],
        nexuses: [],
        nodes: {},
        activeUniverseId: null,
      });

      // Save restored data
      useCanvasStore.getState().saveToLocalStorage();

      setShowRecoveryModal(false);
      alert('✅ Backup restored successfully!');

      // Reload the page to reflect changes
      window.location.reload();
    } else {
      alert('❌ Failed to restore backup');
    }
  };

  // Group universes by folder
  const universesByFolder: { [folderId: string]: typeof universeLibrary } = {};
  Object.entries(universeLibrary).forEach(([universeId, universeData]) => {
    const folderId = universeData.folderId || 'default';
    if (!universesByFolder[folderId]) {
      universesByFolder[folderId] = {};
    }
    universesByFolder[folderId][universeId] = universeData;
  });

  const folderColors = ['#8B5CF6', '#00FFD4', '#FFD700', '#10B981', '#EF4444', '#F59E0B'];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#050A1E',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px'
        }}>
          <h1 style={{
            color: '#00FFD4',
            fontSize: '48px',
            margin: 0
          }}>
            🧠 Memories
          </h1>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowRecoveryModal(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#EF4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🔄 Recover Data
            </button>

            <button
              onClick={() => setShowNewFolderModal(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#8B5CF6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              + New Folder
            </button>
          </div>
        </div>

        {/* Folders */}
        {Object.values(folders)
          .sort((a, b) => {
            // Default folder always last
            if (a.id === 'default') return 1;
            if (b.id === 'default') return -1;
            return a.createdAt - b.createdAt;
          })
          .map(folder => {
            const folderUniverses = universesByFolder[folder.id] || {};
            const count = Object.keys(folderUniverses).length;
            const isExpanded = expandedFolders.has(folder.id);

            return (
              <div key={folder.id} style={{ marginBottom: '24px' }}>
                {/* Folder Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px',
                    backgroundColor: '#0A1628',
                    border: `2px solid ${folder.color}`,
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleFolder(folder.id)}
                >
                  <span style={{ fontSize: '20px', marginRight: '12px' }}>
                    {isExpanded ? '📂' : '📁'}
                  </span>

                  <span style={{
                    color: folder.color,
                    fontSize: '20px',
                    fontWeight: 'bold',
                    flex: 1
                  }}>
                    {folder.name} ({count})
                  </span>

                  {folder.id !== 'default' && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'relative'
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const action = prompt('Rename (r) or Delete (d)?', 'r');
                          if (action === 'r') handleRenameFolder(folder.id);
                          if (action === 'd') handleDeleteFolder(folder.id);
                        }}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: 'transparent',
                          color: folder.color,
                          border: 'none',
                          fontSize: '18px',
                          cursor: 'pointer'
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                  )}
                </div>

                {/* Universe Cards */}
                {isExpanded && (
                  <div style={{
                    marginTop: '12px',
                    marginLeft: '32px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '16px'
                  }}>
                    {Object.entries(folderUniverses)
                      .sort(([,a], [,b]) => b.lastModified - a.lastModified)
                      .map(([universeId, universeData]) => (
                        <div
                          key={universeId}
                          style={{
                            backgroundColor: '#0A1628',
                            border: '2px solid #8B5CF6',
                            borderRadius: '8px',
                            padding: '16px'
                          }}
                        >
                          <h3 style={{
                            color: '#00FFD4',
                            fontSize: '16px',
                            marginBottom: '8px',
                            wordBreak: 'break-word'
                          }}>
                            {universeData.title}
                          </h3>

                          <div style={{
                            color: '#6B7280',
                            fontSize: '12px',
                            marginBottom: '12px'
                          }}>
                            <div>{universeData.nexuses.length} nexuses</div>
                            <div>{Object.keys(universeData.nodes).length} nodes</div>
                            <div>{new Date(universeData.lastModified).toLocaleDateString()}</div>
                          </div>

                          {/* Folder Selector */}
                          <select
                            value={universeData.folderId || 'default'}
                            onChange={(e) => moveUniverseToFolder(universeId, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '8px',
                              marginBottom: '12px',
                              backgroundColor: '#050A1E',
                              color: '#E5E7EB',
                              border: '1px solid #4B5563',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            {Object.values(folders).map(f => (
                              <option key={f.id} value={f.id}>
                                📁 {f.name}
                              </option>
                            ))}
                          </select>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => {
                                loadUniverse(universeId);
                                router.push('/chat');
                              }}
                              style={{
                                flex: 1,
                                padding: '10px',
                                backgroundColor: '#8B5CF6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              Open
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete "${universeData.title}"?`)) {
                                  // Find the nexus ID (first nexus in the universe)
                                  const nexusId = universeData.nexuses[0]?.id;
                                  if (nexusId) {
                                    deleteConversation(nexusId);
                                  }
                                }
                              }}
                              style={{
                                padding: '10px 14px',
                                backgroundColor: 'transparent',
                                color: '#EF4444',
                                border: '2px solid #EF4444',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#0A1628',
            border: '2px solid #8B5CF6',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h2 style={{ color: '#00FFD4', marginBottom: '16px' }}>
              Create New Folder
            </h2>

            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                }
              }}
              placeholder="Folder name..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '16px',
                backgroundColor: '#050A1E',
                color: 'white',
                border: '2px solid #4B5563',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />

            <div style={{ marginBottom: '24px' }}>
              <div style={{ color: '#E5E7EB', marginBottom: '8px' }}>
                Choose color:
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {folderColors.map(color => (
                  <div
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: color,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: selectedColor === color ? '3px solid white' : 'none'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: newFolderName.trim() ? '#00FFD4' : '#4B5563',
                  color: '#050A1E',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: newFolderName.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Create
              </button>

              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  color: '#8B5CF6',
                  border: '2px solid #8B5CF6',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Modal */}
      {showRecoveryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#0A1628',
            border: '2px solid #EF4444',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ color: '#EF4444', marginBottom: '16px' }}>
              🔄 Recover Lost Data
            </h2>

            <p style={{ color: '#E5E7EB', marginBottom: '24px' }}>
              Restore your universes from an automatic backup snapshot.
              Aurora creates backups every 5 saves.
            </p>

            {backups.length === 0 ? (
              <div style={{
                color: '#9CA3AF',
                textAlign: 'center',
                padding: '40px 20px'
              }}>
                No backups available yet.
                <br/>
                Backups are created automatically as you save universes.
              </div>
            ) : (
              <div style={{ marginBottom: '24px' }}>
                {backups.map(backup => (
                  <div
                    key={backup.id}
                    style={{
                      backgroundColor: '#050A1E',
                      border: '1px solid #4B5563',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ color: '#00FFD4', fontWeight: 'bold', marginBottom: '4px' }}>
                          {backup.label === 'auto' ? '📦 Auto Backup' : backup.label}
                        </div>
                        <div style={{ color: '#9CA3AF', fontSize: '14px' }}>
                          {backup.date}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestoreBackup(backup.id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#00FFD4',
                          color: '#050A1E',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowRecoveryModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#EF4444',
                border: '2px solid #EF4444',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
