'use client';

import { useCanvasStore } from '@/lib/store';

export default function ContentOverlay() {
  const selectedId = useCanvasStore((state) => state.selectedId);
  const showContentOverlay = useCanvasStore((state) => state.showContentOverlay);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const setShowContentOverlay = useCanvasStore((state) => state.setShowContentOverlay);
  const setShowReplyModal = useCanvasStore((state) => state.setShowReplyModal);
  const getNodeLevel = useCanvasStore((state) => state.getNodeLevel);
  
  if (!selectedId || !showContentOverlay) return null;
  
  // Get the selected item
  let content = '';
  let videoUrl: string | undefined;
  let audioUrl: string | undefined;
  let isNexus = false;
  let level = 0;
  
  const selectedNexus = nexuses.find(n => n.id === selectedId);
  
  if (selectedNexus) {
    content = selectedNexus.content;
    videoUrl = selectedNexus.videoUrl;
    audioUrl = selectedNexus.audioUrl;
    isNexus = true;
  } else if (nodes[selectedId]) {
    content = nodes[selectedId].content;
    videoUrl = nodes[selectedId].videoUrl;
    audioUrl = nodes[selectedId].audioUrl;
    level = getNodeLevel(selectedId);
  }
  
  const handleClose = () => {
    setShowContentOverlay(false);
  };
  
  const handleReply = () => {
    setShowContentOverlay(false);
    setShowReplyModal(true);
  };
  
  return (
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
        zIndex: 10000,
        padding: '40px',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#1f2937',
          padding: '48px',
          borderRadius: '24px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          border: isNexus ? '3px solid #10b981' : '3px solid #d946ef',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: '12px',
            backgroundColor: isNexus ? '#10b981' : '#d946ef',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '16px',
          }}>
            {isNexus ? 'NEXUS' : `LEVEL ${level} REPLY`}
          </div>
          
          <button
            onClick={handleClose}
            style={{
              float: 'right',
              padding: '8px 16px',
              backgroundColor: '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Close
          </button>
        </div>
        
        {videoUrl && (
          <div style={{ marginBottom: '24px' }}>
            <video
  src={videoUrl}
  autoPlay
  loop
  playsInline
              style={{
                width: '100%',
                maxHeight: '400px',
                borderRadius: '12px',
                backgroundColor: '#000',
              }}
            />
          </div>
        )}
        
        {audioUrl && (
          <div style={{ marginBottom: '24px' }}>
          <audio
  src={audioUrl}
  // Remove autoPlay
  loop
  style={{
    width: '100%',
    borderRadius: '8px',
  }}
  controls
/>
          </div>
        )}
        
        {content && (
          <div style={{
            color: 'white',
            fontSize: '18px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {content}
          </div>
        )}
        
        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #4b5563' }}>
          <button
            onClick={handleReply}
            style={{
              padding: '12px 24px',
              backgroundColor: isNexus ? '#10b981' : '#d946ef',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              width: '100%',
            }}
          >
            Reply to this {isNexus ? 'Nexus' : 'Node'}
          </button>
        </div>
      </div>
    </div>
  );
}