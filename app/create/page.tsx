'use client';

import CanvasScene from '@/components/CanvasScene';

export default function CreatePage() {
  // 🚀 BLANK CANVAS ON STARTUP - Universes load on demand from Memories
  console.log('🚀 [CREATE PAGE] Starting with blank canvas - no auto-load');

  return <CanvasScene />;
}