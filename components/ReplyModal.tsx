'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';

export default function ReplyModal() {
  const [content, setContent] = useState('');
  const selectedId = useCanvasStore((state) => state.selectedId);
  const showReplyModal = useCanvasStore((state) => state.showReplyModal);
  const quotedText = useCanvasStore((state) => state.quotedText);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const addNode = useCanvasStore((state) => state.addNode);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const setShowReplyModal = useCanvasStore((state) => state.setShowReplyModal);
  const setQuotedText = useCanvasStore((state) => state.setQuotedText);
  
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
    
    // Check if this is an empty connection node
    const selectedNode = nodes[selectedId];
    if (selectedNode && selectedNode.isConnectionNode && !selectedNode.content.trim()) {
      // Update the connection node's content directly
      console.log('✏️ Updating connection node content:', selectedId);
      updateNodeContent(selectedId, content);
      setContent('');
      setShowReplyModal(false);
      setQuotedText(null);
      // Keep the connection node selected so user can see their content
    } else {
      // Normal behavior: create a child node
      addNode(content, selectedId, quotedText || undefined);
      setContent('');
      setShowReplyModal(false);
      setQuotedText(null);
      selectNode(null);
    }
  };
  
  const handleClose = () => {
    setContent('');
    setShowReplyModal(false);
    setQuotedText(null);
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
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto',
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
        
        {/* Quoted Text Section - Prominent Display */}
        {quotedText && (
          <div style={{
            backgroundColor: '#374151',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid #9333EA',
          }}>
            <div style={{ 
              color: '#9ca3af', 
              fontSize: '12px', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Quoted Section:
            </div>
            <div style={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              {quotedText}
            </div>
          </div>
        )}
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your reply..."
          style={{
            width: '100%',
            height: '150px',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: '#374151',
            color: 'white',
            border: '2px solid #9333EA',
            borderRadius: '8px',
            marginBottom: '16px',
            resize: 'vertical',
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