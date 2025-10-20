'use client';

import dynamic from 'next/dynamic';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';

const CanvasScene = dynamic(() => import('@/components/CanvasScene'), {
  ssr: false,
});

export default function ChatPage() {
  return (
    <>
      <Navigation />
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        position: 'relative',
        background: '#000'
      }}>
        {/* Welcome Header */}
        <div style={{
          position: 'absolute',
          top: '90px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: 'bold',
            color: '#FFD700',
            textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
            margin: 0,
          }}>
            Welcome to the conversation
          </h1>
        </div>

        {/* 3D Canvas */}
        <CanvasScene />

        {/* Chat Interface */}
        <ChatInterface />
      </div>
    </>
  );
}