'use client';

import { useCanvasStore } from '@/lib/store';

interface SpatialNavigatorProps {
  sections: Array<{ title: string; type: string }>;
  isVisible: boolean;
}

export default function SpatialNavigator({ sections, isVisible }: SpatialNavigatorProps) {
  const selectedId = useCanvasStore((state) => state.selectedId);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectNode = useCanvasStore((state) => state.selectNode);

  if (!isVisible || sections.length === 0) return null;

  // Get the most recent chat nexus
  const chatNexus = nexuses.find(n => n.id.startsWith('chat-'));
  if (!chatNexus) return null;

  // Get all nodes that are children of this nexus
  const childNodes = Object.values(nodes)
    .filter(node => node.parentId === chatNexus.id)
    .sort((a, b) => {
      // Sort by creation time (newer IDs come later)
      return a.id.localeCompare(b.id);
    });

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
        maxHeight: '500px',
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
        marginBottom: '8px',
        fontSize: '14px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        🌌 Spatial Sections
      </div>

      <div style={{
        color: '#D1D5DB',
        fontSize: '12px',
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(147, 51, 234, 0.3)'
      }}>
        {sections.length} sections found
      </div>

      <div style={{ 
        overflowY: 'auto', 
        flex: 1,
        paddingRight: '8px'
      }}>
        {/* Nexus (first section) */}
        {chatNexus && sections[0] && (
          <div
            onClick={() => handleClick(chatNexus.id)}
            style={{
              padding: '8px 12px',
              marginBottom: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: selectedId === chatNexus.id 
                ? 'rgba(147, 51, 234, 0.3)' 
                : 'rgba(147, 51, 234, 0.1)',
              border: selectedId === chatNexus.id 
                ? '2px solid #9333EA'
                : '2px solid rgba(147, 51, 234, 0.3)',
              color: selectedId === chatNexus.id 
                ? '#FFD700' 
                : 'white',
              transition: 'all 0.2s',
              fontSize: '13px',
              fontWeight: selectedId === chatNexus.id ? 'bold' : '600',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <span>{sections[0].title}</span>
            </div>
            <div style={{ 
              fontSize: '10px', 
              marginTop: '4px', 
              color: '#9333EA',
              fontWeight: 'normal'
            }}>
              NEXUS
            </div>
          </div>
        )}

        {/* Child nodes (remaining sections) */}
        {childNodes.map((node, index) => {
          const sectionIndex = index + 1; // +1 because section 0 is the nexus
          const section = sections[sectionIndex];
          
          return (
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
                  : '2px solid transparent',
                color: selectedId === node.id 
                  ? '#FFD700' 
                  : '#D1D5DB',
                transition: 'all 0.2s',
                fontSize: '12px',
                fontWeight: selectedId === node.id ? 'bold' : 'normal',
              }}
            >
              {section?.title || node.title || `Section ${sectionIndex}`}
            </div>
          );
        })}
      </div>
    </div>
  );
}