'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/store';
import { exportToWord } from '@/lib/exportToWord';
import { exportToPDF } from '@/lib/exportToPDF';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedId = useCanvasStore((state) => state.selectedId);
  const revertToOriginal = useCanvasStore((state) => state.revertToOriginal);
  const activeUniverseId = useCanvasStore((state) => state.activeUniverseId);

  const [exportType, setExportType] = useState<'full' | 'analysis'>('full');
  const [exportFormat, setExportFormat] = useState<'word' | 'pdf'>('word');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportedFilename, setExportedFilename] = useState('');
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [exportedNexusId, setExportedNexusId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Find the current universe nexus
  let currentNexus = selectedId ? nexuses.find(n => n.id === selectedId) : null;

  // If selected is a node, find its parent nexus
  if (!currentNexus && selectedId && nodes[selectedId]) {
    let currentNode = nodes[selectedId];
    while (currentNode && currentNode.parentId) {
      const parent = nexuses.find(n => n.id === currentNode.parentId);
      if (parent) {
        currentNexus = parent;
        break;
      }
      currentNode = nodes[currentNode.parentId];
    }
  }

  // Fallback to most recent nexus
  if (!currentNexus && nexuses.length > 0) {
    currentNexus = nexuses[nexuses.length - 1];
  }

  if (!currentNexus) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#1e293b',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            color: 'white',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>No Universe Found</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
            Please create or select a universe to export.
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              backgroundColor: '#9333EA',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Get all nodes in this universe
  const universeNodes = Object.values(nodes).filter(node => {
    // Check if direct child of nexus
    if (node.parentId === currentNexus.id) return true;

    // Check if descendant (walk up the tree)
    let current = node;
    let depth = 0;
    const maxDepth = 1000; // Increased significantly for deep trees
    while (current.parentId && depth < maxDepth) {
      if (current.parentId === currentNexus.id) return true;
      current = nodes[current.parentId];
      if (!current) break;
      depth++;
    }

    return false;
  });

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      // 💾 CRITICAL: Save current universe to library before export
      console.log('💾 Saving current universe before export...');
      useCanvasStore.getState().saveCurrentUniverse();
      console.log('✅ Universe saved to library');

      // 📸 CRITICAL: Create snapshot before first export if none exists
      console.log('📸 Checking for snapshot...');
      console.log('📸 Using activeUniverseId:', activeUniverseId);
      if (!activeUniverseId) {
        throw new Error('No active universe ID found');
      }
      useCanvasStore.getState().createSnapshot(activeUniverseId);
      console.log('✅ Snapshot check complete');

      const response = await fetch('/api/export-universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportType,
          nexus: {
            id: currentNexus.id,
            title: currentNexus.title,
            content: currentNexus.content,
          },
          nodes: universeNodes.map(node => ({
            id: node.id,
            title: node.title,
            content: node.content,
            parentId: node.parentId,
            children: node.children,
            semanticTitle: node.semanticTitle,
            nodeType: node.nodeType,
            isConnectionNode: node.isConnectionNode,
            isSynthesis: node.isSynthesis,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const data = await response.json();
      const structuredData = data.structured;

      // Generate filename
      const safeName = currentNexus.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      const baseFilename = `${safeName}-${exportType}-${dateStr}`;

      // Export based on selected format
      if (exportFormat === 'word') {
        await exportToWord({
          ...structuredData,
          filename: baseFilename,
        });
        setExportedFilename(`${baseFilename}.docx`);
      } else if (exportFormat === 'pdf') {
        exportToPDF({
          ...structuredData,
          filename: baseFilename,
        });
        setExportedFilename(`${baseFilename}.pdf`);
      }

      console.log('✅ Document exported successfully:', baseFilename);
      console.log('📄 EXPORT: Setting exportedNexusId to:', activeUniverseId);
      console.log('📄 EXPORT: Current nexus title:', currentNexus.title);
      console.log('📄 EXPORT: Universe exists in library?', !!useCanvasStore.getState().universeLibrary[activeUniverseId || '']);

      setExportSuccess(true);
      setExportedNexusId(activeUniverseId || null);

      // Show revert modal after a short delay for better UX
      setTimeout(() => {
        setShowRevertModal(true);
      }, 1000);
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert('Failed to export universe. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          color: 'white',
          border: '2px solid rgba(147, 51, 234, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!exportSuccess ? (
          <>
            <h2 style={{ fontSize: '24px', marginBottom: '8px', color: '#FFD700' }}>
              📄 Export Astryon Universe
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '24px' }}>
              Universe: <strong style={{ color: 'white' }}>{currentNexus.title}</strong>
              <br />
              Nodes: {universeNodes.length}
            </p>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '14px', color: '#9333EA', fontWeight: 'bold', marginBottom: '16px' }}>
                Choose content:
              </p>

              {/* Full History Option */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: exportType === 'full' ? '2px solid #9333EA' : '2px solid #334155',
                  backgroundColor: exportType === 'full' ? 'rgba(147, 51, 234, 0.1)' : 'transparent',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setExportType('full')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid #9333EA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {exportType === 'full' && (
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#9333EA',
                        }}
                      />
                    )}
                  </div>
                  <strong style={{ fontSize: '16px' }}>Full Conversation History</strong>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginLeft: '32px' }}>
                  Complete record of all questions, answers, and ideas in narrative form.
                  Includes the full exploration journey.
                </p>
              </div>

              {/* Analysis Only Option */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: exportType === 'analysis' ? '2px solid #9333EA' : '2px solid #334155',
                  backgroundColor: exportType === 'analysis' ? 'rgba(147, 51, 234, 0.1)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setExportType('analysis')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid #9333EA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {exportType === 'analysis' && (
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#9333EA',
                        }}
                      />
                    )}
                  </div>
                  <strong style={{ fontSize: '16px' }}>Final Analysis Only</strong>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginLeft: '32px' }}>
                  Key insights, connections, and recommendations.
                  Focuses on deliverables, skips exploration process.
                </p>
              </div>
            </div>

            {/* Format Selection */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '14px', color: '#00FFD4', fontWeight: 'bold', marginBottom: '16px' }}>
                Choose format:
              </p>

              {/* Word Option */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: exportFormat === 'word' ? '2px solid #00FFD4' : '2px solid #334155',
                  backgroundColor: exportFormat === 'word' ? 'rgba(0, 255, 212, 0.1)' : 'transparent',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setExportFormat('word')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid #00FFD4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {exportFormat === 'word' && (
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#00FFD4',
                        }}
                      />
                    )}
                  </div>
                  <strong style={{ fontSize: '16px' }}>📝 Word Document (.docx)</strong>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginLeft: '32px' }}>
                  Professional Word document with formatting, page numbers, and headers.
                  Editable in Microsoft Word, Google Docs, and other word processors.
                </p>
              </div>

              {/* PDF Option */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: exportFormat === 'pdf' ? '2px solid #00FFD4' : '2px solid #334155',
                  backgroundColor: exportFormat === 'pdf' ? 'rgba(0, 255, 212, 0.1)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setExportFormat('pdf')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid #00FFD4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {exportFormat === 'pdf' && (
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#00FFD4',
                        }}
                      />
                    )}
                  </div>
                  <strong style={{ fontSize: '16px' }}>📄 PDF Document (.pdf)</strong>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginLeft: '32px' }}>
                  Universal PDF format with page numbers and proper formatting.
                  Viewable on any device, preserves layout perfectly.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={isExporting}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  border: '2px solid #475569',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  opacity: isExporting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#9333EA',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isExporting ? 0.7 : 1,
                }}
              >
                {isExporting ? (
                  <>
                    <svg
                      style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}
                      viewBox="0 0 24 24"
                    >
                      <circle
                        style={{ opacity: 0.25 }}
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        style={{ opacity: 0.75 }}
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    📄 Generate Document
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#FFD700' }}>
                Document Exported!
              </h2>
              <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '24px' }}>
                Your document has been downloaded:
                <br />
                <strong style={{ color: 'white', fontSize: '12px' }}>{exportedFilename}</strong>
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setExportSuccess(false);
                    setExportType(exportType === 'full' ? 'analysis' : 'full');
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'transparent',
                    border: '2px solid #9333EA',
                    color: '#9333EA',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  Export Again
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#9333EA',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}

        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Revert Confirmation Modal */}
      {showRevertModal && exportedNexusId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              backgroundColor: '#0A1628',
              border: '2px solid #FFD700',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                color: '#FFD700',
                fontSize: '24px',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              🔄 Revert to Original?
            </h2>

            <p
              style={{
                color: '#E5E7EB',
                fontSize: '16px',
                lineHeight: '1.6',
                marginBottom: '24px',
              }}
            >
              Your document has been downloaded with the full exploration.
              <br />
              <br />
              Would you like to <strong style={{ color: '#FFD700' }}>revert this universe</strong> to its original state?
              <br />
              <br />
              <strong style={{ color: '#00FFD4' }}>This will:</strong>
              <br />
              • Keep the nexus and original L1 nodes
              <br />
              • Remove all exploration (L2+, synthesis, connections)
              <br />
              • Give you a fresh slate to explore again
              <br />
              <br />
              <span style={{ fontSize: '14px', opacity: 0.7 }}>
                Your exported document contains the full exploration.
              </span>
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  console.log('🔄 REVERT BUTTON CLICKED');
                  console.log('🔄   Exported Nexus ID:', exportedNexusId);
                  console.log('🔄   Universe Library Keys:', Object.keys(useCanvasStore.getState().universeLibrary));
                  console.log('🔄   Exists in library?', !!useCanvasStore.getState().universeLibrary[exportedNexusId]);

                  revertToOriginal(exportedNexusId);
                  setShowRevertModal(false);
                  setExportedNexusId(null);
                  // Close the export modal after revert
                  setTimeout(() => {
                    onClose();
                  }, 500);
                }}
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: '#FFD700',
                  color: '#050A1E',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Yes, Revert to Original
              </button>

              <button
                onClick={() => {
                  setShowRevertModal(false);
                  setExportedNexusId(null);
                }}
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: 'transparent',
                  color: '#8B5CF6',
                  border: '2px solid #8B5CF6',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                No, Keep As Is
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
