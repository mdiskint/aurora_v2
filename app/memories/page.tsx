'use client';

import { useCanvasStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MemoriesPage() {
  const router = useRouter();
  const nexuses = useCanvasStore((state) => state.nexuses);
  const activatedConversations = useCanvasStore((state) => state.activatedConversations);
  const toggleActivateConversation = useCanvasStore((state) => state.toggleActivateConversation);
  const selectNode = useCanvasStore((state) => state.selectNode);

  const handleOpenConversation = (nexusId: string) => {
    // Select the nexus to load it
    selectNode(nexusId, false);
    // Navigate to chat
    router.push('/chat');
  };

  const handleActivateToggle = (nexusId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleActivateConversation(nexusId);
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#050A1E',
      padding: '40px',
      paddingTop: '100px',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{
          color: '#00FFD4',
          fontSize: '48px',
          fontWeight: 'bold',
          marginBottom: '8px'
        }}>
          Your Conversations
        </h1>
        <p style={{
          color: '#6B7280',
          fontSize: '18px'
        }}>
          {nexuses.length} conversation{nexuses.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {/* Empty State */}
      {nexuses.length === 0 && (
        <div style={{
          textAlign: 'center',
          color: '#6B7280',
          fontSize: '20px',
          marginTop: '100px'
        }}>
          No conversations yet. Create one to get started!
        </div>
      )}

      {/* Conversations Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '24px'
      }}>
        {nexuses.map((nexus) => {
          const isActivated = activatedConversations.includes(nexus.id);
          
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
              {/* Activate Checkbox - Top Right */}
              <div
                onClick={(e) => handleActivateToggle(nexus.id, e)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  width: '24px',
                  height: '24px',
                  border: isActivated ? '2px solid #00FFD4' : '2px solid #6B7280',
                  borderRadius: '4px',
                  background: isActivated ? '#00FFD4' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                {isActivated && (
                  <span style={{ color: '#050A1E', fontWeight: 'bold' }}>✓</span>
                )}
              </div>

              {/* Nexus Title */}
              <h3 style={{
                color: '#FFD700',
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '12px',
                marginRight: '40px'
              }}>
                {nexus.title}
              </h3>

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
                Open Conversation
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
                  ACTIVATED FOR CONTEXT
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Back Button */}
      <button
        onClick={() => router.push('/chat')}
        style={{
          marginTop: '40px',
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