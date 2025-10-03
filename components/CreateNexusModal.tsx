'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';

interface CreateNexusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateNexusModal({ isOpen, onClose }: CreateNexusModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const createNexus = useCanvasStore((state) => state.createNexus);
  
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
    }
  };
  
  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioPreview(url);
    }
  };
  
  const handleSubmit = () => {
    if (!title.trim()) return;
    
    console.log('🟢 Creating Nexus with title:', title, 'video:', !!videoFile, 'audio:', !!audioFile);
    createNexus(title, content, videoPreview || undefined, audioPreview || undefined);
    setTitle('');
    setContent('');
    setVideoFile(null);
    setVideoPreview(null);
    setAudioFile(null);
    setAudioPreview(null);
    onClose();
  };
  
  const handleClose = () => {
    setTitle('');
    setContent('');
    setVideoFile(null);
    setAudioFile(null);
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview);
    }
    setVideoPreview(null);
    setAudioPreview(null);
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
          maxHeight: '90vh',
          overflow: 'auto',
          border: '2px solid #00FFD4',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: '#00FFD4', marginBottom: '16px', fontSize: '24px' }}>
          Create New Nexus
        </h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block',
            color: '#00FFD4',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            Title (required)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for this Nexus"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              backgroundColor: '#374151',
              color: 'white',
              border: '2px solid #00FFD4',
              borderRadius: '8px',
            }}
            autoFocus
          />
        </div>
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Additional content (optional)"
          style={{
            width: '100%',
            height: '120px',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: '#374151',
            color: 'white',
            border: '2px solid #00FFD4',
            borderRadius: '8px',
            marginBottom: '16px',
            resize: 'none',
          }}
        />
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block',
            color: '#00FFD4',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Upload Video (optional)
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoChange}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#374151',
              color: 'white',
              border: '2px solid #00FFD4',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          />
        </div>
        
        {videoPreview && (
          <div style={{ marginBottom: '16px' }}>
            <video
              src={videoPreview}
              style={{
                width: '100%',
                maxHeight: '200px',
                borderRadius: '8px',
                backgroundColor: '#000',
              }}
              controls
            />
          </div>
        )}
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block',
            color: '#00FFD4',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Upload Audio (optional)
          </label>
          <input
            type="file"
            accept="audio/*"
            onChange={handleAudioChange}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#374151',
              color: 'white',
              border: '2px solid #00FFD4',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          />
        </div>
        
        {audioPreview && (
          <div style={{ marginBottom: '16px' }}>
            <audio
              src={audioPreview}
              style={{
                width: '100%',
                borderRadius: '8px',
              }}
              controls
            />
          </div>
        )}
        
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
            disabled={!title.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: title.trim() ? '#00FFD4' : '#6b7280',
              color: title.trim() ? '#050A1E' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
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