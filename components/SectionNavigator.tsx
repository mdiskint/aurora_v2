'use client';

import { useCanvasStore } from '@/lib/store';
import PaperUploader from './PaperUploader';

export default function SectionNavigator() {
  const selectedId = useCanvasStore((state) => state.selectedId);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const exportToWordDoc = useCanvasStore((state) => state.exportToWordDoc);

  // Get the academic paper nexus (first one)
  const nexus = nexuses[0];
  if (!nexuses.length) return null;

  // Get all L1 nodes (children of the nexus)
  const l1Nodes = Object.values(nodes)
    .filter(node => node.parentId === nexus?.id)
    .sort((a, b) => {
      // Sort by the index in the id (l1-0, l1-1, etc.)
      const aIndex = parseInt(a.id.split('-')[1]);
      const bIndex = parseInt(b.id.split('-')[1]);
      return aIndex - bIndex;
    });

  // Determine next in sequence
  let nextId: string | null = null;
  
  if (selectedId === nexus?.id && l1Nodes.length > 0) {
    nextId = l1Nodes[0].id;
  } else if (selectedId && nodes[selectedId]) {
    const currentIndex = l1Nodes.findIndex(n => n.id === selectedId);
    if (currentIndex >= 0 && currentIndex < l1Nodes.length - 1) {
      nextId = l1Nodes[currentIndex + 1].id;
    }
  }

  const handleClick = (id: string) => {
    selectNode(id, true);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '350px',
        maxHeight: '400px',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        border: '2px solid rgba(147, 51, 234, 0.5)',
        padding: '16px',
        zIndex: 1000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ 
        color: '#9333EA', 
        fontWeight: 'bold', 
        marginBottom: '12px',
        fontSize: '14px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        Paper Sections
      </div>

      <div style={{ 
        overflowY: 'auto', 
        flex: 1,
        paddingRight: '8px'
      }}>
        {/* Nexus */}
        {nexus && (
          <div
            onClick={() => handleClick(nexus.id)}
            style={{
              padding: '8px 12px',
              marginBottom: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: selectedId === nexus.id 
                ? 'rgba(147, 51, 234, 0.3)' 
                : 'transparent',
              border: selectedId === nexus.id 
                ? '2px solid #9333EA'
                : nextId === nexus.id
                ? '2px solid #00E5FF'
                : '2px solid transparent',
              color: selectedId === nexus.id 
                ? '#FFD700' 
                : nextId === nexus.id
                ? '#00E5FF'
                : 'white',
              transition: 'all 0.2s',
              fontSize: '13px',
              fontWeight: selectedId === nexus.id ? 'bold' : 'normal',
            }}
          >
            {nexus.title}
          </div>
        )}

        {/* L1 Sections */}
        {l1Nodes.map((node) => (
          <div
            key={node.id}
            onClick={() => handleClick(node.id)}
            style={{
              padding: '8px 12px',
              marginBottom: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: selectedId === node.id 
                ? 'rgba(147, 51, 234, 0.3)' 
                : 'transparent',
              border: selectedId === node.id 
                ? '2px solid #9333EA'
                : nextId === node.id
                ? '2px solid #00E5FF'
                : '2px solid transparent',
              color: selectedId === node.id 
                ? '#FFD700' 
                : nextId === node.id
                ? '#00E5FF'
                : '#D1D5DB',
              transition: 'all 0.2s',
              fontSize: '12px',
              fontWeight: selectedId === node.id ? 'bold' : 'normal',
            }}
          >
            {node.title}
          </div>
        ))}
      </div>

      {/* Paper Upload Button */}
      <PaperUploader />

      {/* Export to Word Button */}
      <button
        onClick={exportToWordDoc}
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: 'rgba(147, 51, 234, 0.2)',
          border: '2px solid rgba(147, 51, 234, 0.5)',
          borderRadius: '8px',
          color: '#D8B4FE',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.3)';
          e.currentTarget.style.borderColor = '#9333EA';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.2)';
          e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.5)';
        }}
      >
        <svg 
          style={{ width: '20px', height: '20px' }}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
        Export to Word
      </button>
    </div>
  );
}