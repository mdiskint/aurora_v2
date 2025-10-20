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
        {/* 3D Canvas */}
        <CanvasScene />

        {/* Chat Interface */}
        <ChatInterface />
      </div>
    </>
  );
}