'use client';

import { useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import CanvasScene from '@/components/CanvasScene';

export default function CreatePage() {
  // 🚀 CRITICAL: LOAD DATA FROM LOCALSTORAGE WHEN PAGE LOADS
  useEffect(() => {
    console.log('🚀 [CREATE PAGE] Loading data from localStorage...');
    useCanvasStore.getState().loadFromLocalStorage();
  }, []);

  return <CanvasScene />;
}