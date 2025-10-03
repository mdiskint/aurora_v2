'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';

export default function ReplyModal() {
  const [content, setContent] = useState('');
  const selectedId = useCanvasStore((state) => state.selectedId);
  const showReplyModal = useCanvasStore((state) => state.showReplyModal);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const addNode = useCanvasStore((state) => state.addNode);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const setShowReplyModal = useCanvasStore((state) => state.setShowReplyModal);
  
  const isOpen = showReplyModal && !!selectedId;
  
  let selectedContent = '';
  const selectedNexus = nexuses.find(n => n.id === selectedId);
  if (selectedNexus) {
    selectedContent = selectedNexus.content;
  } else if (selectedId && nodes[selectedId]) {
    selectedContent = nodes[selectedId].content;
  }
  
  const handleSubmit = () => {
    if (!content.trim() || !selectedId) return;
    
    console.log('📝 Submitting reply to:', selectedId);
    addNode(content, selectedId);
    setContent('');
    setShowReplyModal(false);
    selectNode(null);
  };
  
  const handleClose = () => {
    setContent('');
    setShowReplyModal(false);
    selectNode(null);
  };
  
  if (!isOpen) return null;
  
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 10, 30, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#1f2937',
          padding: '32px',
          borderRadius: '16px',
          width: '500px',
          maxWidth: '90vw',
          border: '2px solid #9333EA',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: '#9333EA', marginBottom: '8px', fontSize: '24px' }}>
          Reply to Node
        </h2>
        
        <p style={{ color: '#9ca3af', marginBottom: '16px', fontSize: '14px' }}>
          Replying to: "{selectedContent.slice(0, 50)}{selectedContent.length > 50 ? '...' : ''}"
        </p>
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your reply..."
          style={{
            width: '100%',
            height: '120px',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: '#374151',
            color: 'white',
            border: '2px solid #9333EA',
            borderRadius: '8px',
            marginBottom: '16px',
            resize: 'none',
          }}
          autoFocus
        />
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: content.trim() ? '#9333EA' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: content.trim() ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Submit Reply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}