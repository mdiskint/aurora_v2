'use client';

import dynamic from 'next/dynamic';
import ChatInterface from '@/components/ChatInterface';

const CanvasScene = dynamic(() => import('@/components/CanvasScene'), {
  ssr: false,
});

export default function ChatPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <CanvasScene />
      <ChatInterface />
    </div>
  );
}