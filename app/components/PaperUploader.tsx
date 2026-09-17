'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/store';

export default function PaperUploader() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadAcademicPaperFromData = useCanvasStore((state) => state.loadAcademicPaperFromData);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      // Read file content
      const text = await file.text();
      const paperData = JSON.parse(text);

      // Validate basic structure
      if (!paperData.nexus || !paperData.sections) {
        throw new Error('Invalid paper format: missing nexus or sections');
      }

      // Load into store
      loadAcademicPaperFromData(paperData);
      
      console.log('✅ Paper loaded successfully!');
    } catch (err) {
      console.error('❌ Error loading paper:', err);
      setError(err instanceof Error ? err.message : 'Failed to load paper');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 p-3 bg-black/40 border border-cyan-500/30 rounded">
      <label className="block mb-2 text-sm text-cyan-400">
        Load Academic Paper
      </label>
      
      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        disabled={isLoading}
        className="block w-full text-sm text-gray-400
          file:mr-4 file:py-2 file:px-4
          file:rounded file:border-0
          file:text-sm file:font-semibold
          file:bg-cyan-500 file:text-black
          hover:file:bg-cyan-400
          disabled:opacity-50"
      />
      
      {isLoading && (
        <p className="mt-2 text-sm text-cyan-400">Loading paper...</p>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}