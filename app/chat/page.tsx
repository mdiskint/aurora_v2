'use client';

import { useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import dynamic from 'next/dynamic';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';

const CanvasScene = dynamic(() => import('@/components/CanvasScene'), {
  ssr: false,
});

export default function ChatPage() {
  // 🚀 CRITICAL: LOAD DATA FROM LOCALSTORAGE WHEN PAGE LOADS
  useEffect(() => {
    console.log('🚀 [CHAT PAGE] Loading data from localStorage...');
    useCanvasStore.getState().loadFromLocalStorage();
  }, []);

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