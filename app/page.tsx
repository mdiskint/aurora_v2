'use client';

import { useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';

export default function Home() {
  // 🚀 BLANK CANVAS ON STARTUP - Universes load on demand from Memories
  useEffect(() => {
    console.log('🚀 [HOME] Starting with blank canvas - no auto-load');
    // loadFromLocalStorage(); // ← Removed: Canvas should start EMPTY
  }, []);

  const handleCreate = () => {
    window.location.href = '/create';
  };

  const handleExplore = () => {
    window.location.href = '/explore';
  };

  const handleChat = () => {
    window.location.href = '/chat';
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#050A1E',
      backgroundImage: 'url(/aurora-bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* TOP BAR - NEW! */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '20px 40px',
        backgroundColor: 'rgba(5, 10, 30, 0.9)',
        borderBottom: '2px solid #FFD700',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          fontSize: '28px',
          color: '#FFD700',
          fontWeight: '700',
          letterSpacing: '2px',
          textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
        }}>
          Welcome to the Conversation
        </div>
      </div>

      {/* Dark overlay to ensure text readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 30, 0.6)',
        zIndex: 0
      }} />

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(0, 255, 212, 0.1) 0%, rgba(5, 10, 30, 0) 70%)',
        animation: 'pulse 4s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        .button-hover {
          transition: all 0.3s ease;
        }

        .button-hover:hover {
          transform: scale(1.05);
          box-shadow: 0 0 30px rgba(0, 255, 212, 0.5);
        }
      `}</style>

      <h1 style={{
        fontSize: '64px',
        fontWeight: 'bold',
        color: '#00FFD4',
        marginBottom: '16px',
        textAlign: 'center',
        letterSpacing: '2px',
        textShadow: '0 0 20px rgba(0, 255, 212, 0.5)',
        animation: 'float 3s ease-in-out infinite',
        zIndex: 1
      }}>
        Aurora
      </h1>

      <div style={{
        display: 'flex',
        gap: '32px',
        zIndex: 1
      }}>
        <button
          onClick={handleCreate}
          className="button-hover"
          style={{
            padding: '20px 50px',
            fontSize: '24px',
            fontWeight: 'bold',
            backgroundColor: '#9333EA',
            color: 'white',
            border: '3px solid #9333EA',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: '200px'
          }}
        >
          Create
        </button>

        <button
          onClick={handleExplore}
          className="button-hover"
          style={{
            padding: '20px 50px',
            fontSize: '24px',
            fontWeight: 'bold',
            backgroundColor: '#00FFD4',
            color: '#050A1E',
            border: '3px solid #00FFD4',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: '200px'
          }}
        >
          Explore
        </button>

        <button
          onClick={handleChat}
          className="button-hover"
          style={{
            padding: '20px 50px',
            fontSize: '24px',
            fontWeight: 'bold',
            backgroundColor: '#3B82F6',
            color: 'white',
           border: '3px solid #3B82F6',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: '200px'
          }}
        >
          Chat
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: '32px',
        marginTop: '16px',
        zIndex: 1
      }}>
        <p style={{
          color: '#9CA3AF',
          fontSize: '14px',
          width: '200px',
          textAlign: 'center'
        }}>
          Build your own conversations
        </p>
        <p style={{
          color: '#9CA3AF',
          fontSize: '14px',
          width: '200px',
          textAlign: 'center'
        }}>
          Navigate academic papers
        </p>
        <p style={{
          color: '#9CA3AF',
          fontSize: '14px',
          width: '200px',
          textAlign: 'center'
        }}>
          Chat with Claude AI
        </p>
      </div>
    </div>
  );
}