'use client';

import { useCanvasStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function MemoriesPage() {
  const router = useRouter();
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const activatedConversations = useCanvasStore((state) => state.activatedConversations);
  const toggleActivateConversation = useCanvasStore((state) => state.toggleActivateConversation);
  const deleteConversation = useCanvasStore((state) => state.deleteConversation);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const updateNexusContent = useCanvasStore((state) => state.updateNexusContent);

  const [editingNexusId, setEditingNexusId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 🚀 LOAD DATA FROM LOCALSTORAGE WHEN PAGE OPENS
  useEffect(() => {
    console.log('🚀 Memories page loading data from localStorage...');
    useCanvasStore.getState().loadFromLocalStorage();
  }, []);

  // Calculate node count for a nexus
  const getNodeCount = (nexusId: string) => {
    return Object.values(nodes).filter(node => {
      // Check if node's ultimate parent is this nexus
      let currentNode = node;
      while (currentNode.parentId) {
        if (currentNode.parentId === nexusId) return true;
        currentNode = nodes[currentNode.parentId];
        if (!currentNode) break;
      }
      return false;
    }).length;
  };

  // Get creation date (from nexus ID if timestamp-based)
  const getCreationDate = (nexusId: string) => {
    // Extract timestamp from ID if present (e.g., "chat-1234567890")
    const match = nexusId.match(/(\d{13})/); // 13-digit timestamp
    if (match) {
      const timestamp = parseInt(match[1]);
      return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return 'Unknown date';
  };

  const handleOpenConversation = (nexusId: string) => {
    selectNode(nexusId, false);
    router.push('/chat');
  };

  const handleActivateToggle = (nexusId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleActivateConversation(nexusId);
  };

  const handleDeleteClick = (nexusId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(nexusId);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteConversation(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const handleRenameClick = (nexusId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNexusId(nexusId);
    setEditingTitle(currentTitle);
  };

  const saveRename = () => {
    if (editingNexusId && editingTitle.trim()) {
      const nexus = nexuses.find(n => n.id === editingNexusId);
      if (nexus) {
        // Update the title by updating the content (we'll modify the nexus structure)
        updateNexusContent(editingNexusId, nexus.content);
        // We need to update the title separately - let's directly modify
        const store = useCanvasStore.getState();
        const updatedNexuses = store.nexuses.map(n =>
          n.id === editingNexusId ? { ...n, title: editingTitle.trim() } : n
        );
        useCanvasStore.setState({ nexuses: updatedNexuses });
        store.saveToLocalStorage();
      }
    }
    setEditingNexusId(null);
    setEditingTitle('');
  };

  const cancelRename = () => {
    setEditingNexusId(null);
    setEditingTitle('');
  };

  const handleExport = (nexusId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nexus = nexuses.find(n => n.id === nexusId);
    if (!nexus) return;

    // Get all nodes for this universe
    const universeNodes = Object.values(nodes).filter(node => {
      let currentNode = node;
      while (currentNode.parentId) {
        if (currentNode.parentId === nexusId) return true;
        currentNode = nodes[currentNode.parentId];
        if (!currentNode) break;
      }
      return false;
    });

    // Create export data
    const exportData = {
      id: nexusId,
      title: nexus.title,
      nexus: nexus,
      nodes: universeNodes,
      createdAt: getCreationDate(nexusId),
      exportedAt: new Date().toISOString(),
      nodeCount: universeNodes.length
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nexus.title.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target?.result as string);

          // Validate structure
          if (!importedData.nexus || !importedData.nodes) {
            alert('Invalid universe file format');
            return;
          }

          // Generate new ID to avoid conflicts
          const newNexusId = `imported-${Date.now()}`;
          const idMapping: { [oldId: string]: string } = {
            [importedData.id]: newNexusId
          };

          // Create new IDs for all nodes
          importedData.nodes.forEach((node: any) => {
            idMapping[node.id] = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          });

          // Import nexus with new ID
          const newNexus = { ...importedData.nexus, id: newNexusId };

          // Import nodes with remapped IDs and parent references
          const newNodes: any = {};
          importedData.nodes.forEach((node: any) => {
            const newNodeId = idMapping[node.id];
            newNodes[newNodeId] = {
              ...node,
              id: newNodeId,
              parentId: idMapping[node.parentId] || node.parentId,
              children: node.children.map((childId: string) => idMapping[childId] || childId)
            };
          });

          // Add to store
          const store = useCanvasStore.getState();
          useCanvasStore.setState({
            nexuses: [...store.nexuses, newNexus],
            nodes: { ...store.nodes, ...newNodes }
          });
          store.saveToLocalStorage();

          alert(`Successfully imported: ${importedData.title}`);
        } catch (error) {
          console.error('Import error:', error);
          alert('Failed to import universe file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#050A1E',
      padding: '40px',
      paddingTop: '80px',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            color: '#00FFD4',
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '8px'
          }}>
            Universe Library
          </h1>
          <p style={{
            color: '#6B7280',
            fontSize: '18px'
          }}>
            {nexuses.length} universe{nexuses.length !== 1 ? 's' : ''} saved • {Object.keys(nodes).length} total nodes
          </p>
        </div>

        {/* Import Button */}
        <button
          onClick={handleImport}
          style={{
            padding: '12px 24px',
            background: '#9333EA',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#7C3AED'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#9333EA'}
        >
          📥 Import Universe
        </button>
      </div>

      {/* Empty State */}
      {nexuses.length === 0 && (
        <div style={{
          textAlign: 'center',
          color: '#6B7280',
          fontSize: '20px',
          marginTop: '100px'
        }}>
          <p style={{ marginBottom: '20px' }}>No universes yet. Create one to get started!</p>
          <button
            onClick={() => router.push('/chat')}
            style={{
              padding: '12px 32px',
              background: '#00FFD4',
              color: '#050A1E',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Create Universe
          </button>
        </div>
      )}

      {/* Universes Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        {nexuses.map((nexus) => {
          const isActivated = activatedConversations.includes(nexus.id);
          const nodeCount = getNodeCount(nexus.id);
          const creationDate = getCreationDate(nexus.id);
          const isEditing = editingNexusId === nexus.id;

          return (
            <div
              key={nexus.id}
              style={{
                background: '#1a2235',
                borderRadius: '12px',
                padding: '24px',
                border: isActivated ? '3px solid #00FFD4' : '2px solid #2a3245',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Top Right Controls */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                zIndex: 10
              }}>
                {/* Activate Checkbox */}
                <div
                  onClick={(e) => handleActivateToggle(nexus.id, e)}
                  style={{
                    width: '24px',
                    height: '24px',
                    border: isActivated ? '2px solid #00FFD4' : '2px solid #6B7280',
                    borderRadius: '4px',
                    background: isActivated ? '#00FFD4' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Activate for AI context"
                >
                  {isActivated && (
                    <span style={{ color: '#050A1E', fontWeight: 'bold' }}>✓</span>
                  )}
                </div>

                {/* Export Button */}
                <div
                  onClick={(e) => handleExport(nexus.id, e)}
                  style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  title="Export universe"
                >
                  📤
                </div>

                {/* Delete Button */}
                <div
                  onClick={(e) => handleDeleteClick(nexus.id, e)}
                  style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#EF4444',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#DC2626';
                    e.currentTarget.style.transform = 'scale(1.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#EF4444';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="Delete universe"
                >
                  ×
                </div>
              </div>

              {/* Nexus Title - Editable */}
              {isEditing ? (
                <div style={{ marginBottom: '12px', marginRight: '100px' }}>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') saveRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      background: '#2a3245',
                      border: '2px solid #00FFD4',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#FFD700',
                      fontSize: '20px',
                      fontWeight: 'bold'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={saveRename}
                      style={{
                        padding: '4px 12px',
                        background: '#00FFD4',
                        color: '#050A1E',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelRename}
                      style={{
                        padding: '4px 12px',
                        background: '#6B7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '12px',
                  marginRight: '100px'
                }}>
                  <h3 style={{
                    color: '#FFD700',
                    fontSize: '22px',
                    fontWeight: 'bold',
                    flex: 1
                  }}>
                    {nexus.title}
                  </h3>
                  <div
                    onClick={(e) => handleRenameClick(nexus.id, nexus.title, e)}
                    style={{
                      cursor: 'pointer',
                      color: '#6B7280',
                      fontSize: '16px',
                      padding: '4px'
                    }}
                    title="Rename universe"
                  >
                    ✏️
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '12px',
                fontSize: '12px',
                color: '#6B7280'
              }}>
                <span>📅 {creationDate}</span>
                <span>•</span>
                <span>🌐 {nodeCount} nodes</span>
              </div>

              {/* Nexus Content Preview */}
              <p style={{
                color: '#9CA3AF',
                fontSize: '14px',
                marginBottom: '20px',
                lineHeight: '1.5',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {nexus.content}
              </p>

              {/* Open Button */}
              <button
                onClick={() => handleOpenConversation(nexus.id)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#9333EA',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#7C3AED'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#9333EA'}
              >
                Open Universe
              </button>

              {/* Activated Badge */}
              {isActivated && (
                <div style={{
                  marginTop: '12px',
                  padding: '6px 12px',
                  background: 'rgba(0, 255, 212, 0.1)',
                  border: '1px solid #00FFD4',
                  borderRadius: '6px',
                  color: '#00FFD4',
                  fontSize: '12px',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}>
                  ✓ ACTIVATED FOR CONTEXT
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1a2235',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            border: '2px solid #EF4444'
          }}>
            <h2 style={{
              color: '#EF4444',
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '16px'
            }}>
              Delete Universe?
            </h2>
            <p style={{
              color: '#9CA3AF',
              fontSize: '16px',
              marginBottom: '24px',
              lineHeight: '1.5'
            }}>
              Are you sure you want to delete "{nexuses.find(n => n.id === deleteConfirmId)?.title}"?
              This will permanently remove the nexus and all {getNodeCount(deleteConfirmId)} nodes.
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDelete}
                style={{
                  padding: '12px 24px',
                  background: '#2a3245',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '12px 24px',
                  background: '#EF4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#DC2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#EF4444'}
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={() => router.push('/chat')}
        style={{
          padding: '12px 24px',
          background: '#2a3245',
          color: '#00FFD4',
          border: '2px solid #00FFD4',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        ← Back to Chat
      </button>
    </div>
  );
}
