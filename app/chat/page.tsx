'use client';

import dynamic from 'next/dynamic';
import ChatInterface from '@/components/chat/ChatInterface';
import Navigation from '@/components/Navigation';
import { useNexusEvolution } from '@/lib/useNexusEvolution';
import { useNexusApplicationLabEvolution } from '@/lib/useNexusApplicationLabEvolution';

const CanvasScene = dynamic(() => import('@/components/CanvasScene'), {
  ssr: false,
});

export default function ChatPage() {
  // 🚀 BLANK CANVAS ON STARTUP - Universes load on demand from Memories
  console.log('🚀 [CHAT PAGE] Starting with blank canvas - no auto-load');

  // 🌱 EVOLVING NEXUS - Watch for completed nexuses and generate mastery summaries
  useNexusEvolution();

  // 🎓 APPLICATION LAB EVOLUTION - Watch for completed nexuses and generate Application Labs
  useNexusApplicationLabEvolution();

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