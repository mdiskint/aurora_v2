'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';
import { extractTextFromFile } from '@/lib/extractFileText';

interface CreateNexusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.md', '.json', '.rtf', '.html', '.xml',
].join(',');

const FRIENDLY_TYPES = 'PDF, Word, Excel, PowerPoint, Text, CSV, Markdown, JSON, RTF, HTML';

export default function CreateNexusModal({ isOpen, onClose }: CreateNexusModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createNexus = useCanvasStore((state) => state.createNexus);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setExtractError(null);
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);

    // Extract text from any file type
    setExtracting(true);
    try {
      const text = await extractTextFromFile(file);
      if (text.trim()) {
        setContent(text);
      }
    } catch (err) {
      console.error('Failed to extract text from file:', err);
      setExtractError('Could not extract text from this file.');
    } finally {
      setExtracting(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setExtractError(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFilePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    console.log('🟢 Creating Nexus with title:', title, 'file:', uploadedFile?.name || 'none');
    createNexus(
      title,
      content,
      undefined, // videoUrl
      undefined, // audioUrl
      filePreviewUrl || undefined,
      uploadedFile?.name || undefined,
    );
    setTitle('');
    setContent('');
    handleRemoveFile();
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setContent('');
    handleRemoveFile();
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

        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            color: '#00FFD4',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Upload File (optional)
          </label>
          <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px' }}>
            {FRIENDLY_TYPES}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileChange}
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

        {uploadedFile && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#374151',
            borderRadius: '8px',
            border: '1px solid #4b5563',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ color: '#00FFD4', fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
                {uploadedFile.name}
              </p>
              <p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0 0' }}>
                {(uploadedFile.size / 1024).toFixed(1)} KB
                {extracting && ' — Extracting text...'}
              </p>
            </div>
            <button
              onClick={handleRemoveFile}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px 8px',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {extractError && (
          <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
            {extractError}
          </p>
        )}

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            color: '#00FFD4',
            marginBottom: '8px',
            fontSize: '14px',
          }}>
            Content {uploadedFile ? '(extracted from file — editable)' : '(optional)'}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={extracting ? 'Extracting text from file...' : 'Additional content (optional)'}
            readOnly={extracting}
            style={{
              width: '100%',
              height: '180px',
              padding: '12px',
              fontSize: '14px',
              backgroundColor: extracting ? '#2d3748' : '#374151',
              color: 'white',
              border: '2px solid #00FFD4',
              borderRadius: '8px',
              resize: 'vertical',
              opacity: extracting ? 0.6 : 1,
            }}
          />
        </div>

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
            disabled={!title.trim() || extracting}
            style={{
              padding: '10px 20px',
              backgroundColor: (title.trim() && !extracting) ? '#00FFD4' : '#6b7280',
              color: (title.trim() && !extracting) ? '#050A1E' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (title.trim() && !extracting) ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            {extracting ? 'Extracting...' : 'Create Nexus'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
