
'use client';

import React from 'react';

interface ChatUIProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  error: string | null;
  handleSendMessage: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  isSpatialModeActive: boolean;
  gapModeEnabled: boolean;
  setGapModeEnabled: (enabled: boolean) => void;
  isFirstMessage: boolean;
  activatedUniverseIds: string[];
}

export default function ChatUI({
  message,
  setMessage,
  isLoading,
  error,
  handleSendMessage,
  handleKeyPress,
  isSpatialModeActive,
  gapModeEnabled,
  setGapModeEnabled,
  isFirstMessage,
  activatedUniverseIds,
}: ChatUIProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        width: '400px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        border: `1px solid ${isSpatialModeActive ? '#9333EA' : '#00FFD4'}`,
        borderRadius: '8px',
        padding: '16px',
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ color: isSpatialModeActive ? '#9333EA' : (gapModeEnabled ? '#8B5CF6' : '#00FFD4'), fontSize: '14px', fontWeight: 'bold' }}>
          {isSpatialModeActive ? '🌌 Spatial Exploration Mode' : gapModeEnabled ? '🧠 GAP Mode Active' : '🧠 Astryon Chat'} {!isFirstMessage && '(Full Context Active)'}
        </div>

        {/* GAP Mode Toggle Button */}
        <button
          onClick={() => setGapModeEnabled(!gapModeEnabled)}
          title="GAP Mode: Enable graph-aware AI that reasons over your entire universe structure. More intelligent but uses more tokens."
          style={{
            padding: '6px 12px',
            backgroundColor: gapModeEnabled ? '#8B5CF6' : '#333',
            color: gapModeEnabled ? '#fff' : '#666',
            border: `2px solid ${gapModeEnabled ? '#8B5CF6' : '#555'}`,
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: gapModeEnabled ? '0 0 12px rgba(139, 92, 246, 0.6)' : 'none',
            animation: gapModeEnabled ? 'pulse 2s ease-in-out infinite' : 'none',
          }}
        >
          🧠 GAP
        </button>
      </div>

      {/* 🧠 Active Sources Indicator */}
      {gapModeEnabled && activatedUniverseIds.length > 0 && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          border: '1px solid #8B5CF6',
          borderRadius: '6px',
          marginBottom: '8px',
          fontSize: '12px',
          color: '#8B5CF6',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🌌 Active: {activatedUniverseIds.length} {activatedUniverseIds.length === 1 ? 'universe' : 'universes'}</span>
          <button
            onClick={() => {
              // Navigate to Memories page
              window.location.href = '/memories';
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: 'rgba(139, 92, 246, 0.3)',
              color: '#8B5CF6',
              border: '1px solid #8B5CF6',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            View Sources
          </button>
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Enter a topic (AI creates nodes) or use **Title **Node1 **Node2 for manual parsing..."
        disabled={isLoading}
        style={{
          width: '100%',
          minHeight: '80px',
          padding: '8px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #9333EA',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '14px',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      {error && (
        <div style={{ color: '#ff4444', fontSize: '12px', marginTop: '8px' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSendMessage}
        disabled={isLoading || !message.trim()}
        style={{
          marginTop: '12px',
          width: '100%',
          padding: '10px',
          backgroundColor: isLoading || !message.trim() ? '#333' : (isSpatialModeActive ? '#9333EA' : '#00FFD4'),
          color: isLoading || !message.trim() ? '#666' : (isSpatialModeActive ? '#fff' : '#000'),
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: isLoading || !message.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {isLoading
          ? (isSpatialModeActive ? '✨ Generating universe...' : 'Claude is thinking...')
          : (isSpatialModeActive ? '🌌 Explore in 3D Space' : 'Send Message')
        }
      </button>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
          }
          50% {
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.9);
          }
        }
      `}</style>
    </div>
  );
}
