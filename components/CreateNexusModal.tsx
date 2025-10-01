'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';

interface CreateNexusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateNexusModal({ isOpen, onClose }: CreateNexusModalProps) {
  const [content, setContent] = useState('');
  const createNexus = useCanvasStore((state) => state.createNexus);
  
  const handleSubmit = () => {
    if (!content.trim()) return;
    
    console.log('🟢 Creating Nexus with content:', content);
    createNexus(content);
    setContent('');
    onClose();
  };
  
  const handleClose = () => {
    setContent('');
    onClose();
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
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: '#10b981', marginBottom: '16px', fontSize: '24px' }}>
          Create New Nexus
        </h2>
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's this conversation about? (Later you'll be able to add video/music too)"
          style={{
            width: '100%',
            height: '120px',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: '#374151',
            color: 'white',
            border: '2px solid #10b981',
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
              backgroundColor: content.trim() ? '#10b981' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: content.trim() ? 'pointer' : 'not-allowed',
              fontSize: '16px',
            }}
          >
            Create Nexus
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}