'use client';

import { useRef, useState } from 'react';
import CanvasScene from '@/components/CanvasScene';
import ContentOverlay from '@/components/ContentOverlay';
import SectionNavigator from '@/components/SectionNavigator';
import ReplyModal from '@/components/ReplyModal';
import { useCanvasStore } from '@/lib/store';

export default function ExplorePage() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const loadAcademicPaperFromData = useCanvasStore((state) => state.loadAcademicPaperFromData);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a JSON file
    if (!file.name.endsWith('.json')) {
      alert('Please upload a JSON file (.json)');
      return;
    }

    setIsUploading(true);

    try {
      // Read the JSON file directly in the browser
      const fileContent = await file.text();
      const data = JSON.parse(fileContent);
      
      console.log('📄 Loaded JSON data:', data);

      // Load the paper into Aurora
      loadAcademicPaperFromData(data);
      console.log('✅ Paper loaded into Aurora!');
    } catch (error) {
      console.error('Error loading paper:', error);
      alert('Failed to load paper. Make sure it\'s a valid JSON file with the correct format.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const hasPaper = nexuses.length > 0;

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Landing Page - Show when no paper loaded */}
      {!hasPaper && (
        <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
          <div className="max-w-4xl w-full space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Academic Paper Explorer
              </h1>
              <p className="text-xl text-yellow-400/90">
                Navigate complex arguments in 3D space
              </p>
            </div>

            {/* Upload Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-cyan-500/30 rounded-2xl p-8 space-y-6">
              <h2 className="text-2xl font-semibold text-cyan-400">
                Upload Your Academic Paper
              </h2>
              
              <p className="text-gray-300">
                Upload a JSON file with your parsed academic paper to visualize it as an interactive 3D conversation space. 
                Your paper sections will appear as nodes that you can navigate, edit, and explore spatially.
              </p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Upload Button */}
              <button
                onClick={handleUploadClick}
                disabled={isUploading}
                className="w-full px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 
                         text-white font-semibold rounded-xl transition-all duration-200 
                         disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg shadow-cyan-500/20"
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading Your Paper...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Choose File to Upload
                  </span>
                )}
              </button>

              <p className="text-sm text-gray-400 text-center">
                Supported format: JSON (.json)
              </p>
            </div>

            {/* Instructions Section */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-cyan-400">
                JSON Format Expected
              </h3>
              
              <p className="text-gray-300 text-sm">
                Your JSON file should have this structure:
              </p>

              <pre className="bg-slate-900/50 p-4 rounded-lg text-xs text-gray-300 overflow-x-auto">
{`{
  "nexus": {
    "id": "paper-nexus",
    "title": "Your Paper Title",
    "content": "Abstract text here..."
  },
  "sections": [
    {
      "title": "I. Introduction",
      "content": "Section content here..."
    },
    {
      "title": "II. Background",
      "content": "Section content here..."
    }
  ]
}`}
              </pre>

              <p className="text-xs text-gray-500 italic">
                Tip: You can use the democratic-review-paper.json file as a template!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3D Canvas - Always rendered */}
      <CanvasScene />

      {/* UI Overlays - Only show when paper is loaded */}
      {hasPaper && (
        <>
          <ContentOverlay />
          <SectionNavigator />
          <ReplyModal />
        </>
      )}
    </div>
  );
}