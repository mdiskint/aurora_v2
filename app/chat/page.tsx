'use client';

import dynamic from 'next/dynamic';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';

const CanvasScene = dynamic(() => import('@/components/CanvasScene'), {
  ssr: false,
});

export default function ChatPage() {
  // 🚀 BLANK CANVAS ON STARTUP - Universes load on demand from Memories
  console.log('🚀 [CHAT PAGE] Starting with blank canvas - no auto-load');

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

        {/* UnifiedNodeModal is rendered in CanvasScene */}
      </div>
    </>
  );
}