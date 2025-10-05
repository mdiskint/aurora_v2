'use client';

import { useCanvasStore } from '@/lib/store';
import { Nexus, Node } from '@/lib/types';

export default function ContentOverlay() {
  const { selectedId, nexuses, nodes, isAnimatingCamera, showContentOverlay } = useCanvasStore();

  if (!selectedId || isAnimatingCamera || !showContentOverlay) return null;

  const nexus = nexuses.find((n: Nexus) => n.id === selectedId);
  const node = nodes[selectedId];
  const selectedItem = nexus || node;

  if (!selectedItem) return null;

  const isNexus = !!nexus;
  const level = isNexus ? 0 : (node as Node).parentId ? 1 : 0;
  const quotedText = !isNexus && node ? (node as Node).quotedText : undefined;

  const handleReplyClick = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || null;
    
    useCanvasStore.setState({ quotedText: selectedText });
    useCanvasStore.setState({ showReplyModal: true });
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 pointer-events-auto">
        <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl border-2 border-purple-500/50 p-8 shadow-2xl">
          {/* Header with badge and close button */}
          <div className="flex items-start justify-between mb-6">
            <div className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
              {isNexus ? 'NEXUS' : `LEVEL ${level} REPLY`}
            </div>
            <button
              onClick={() => useCanvasStore.setState({ showContentOverlay: false })}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>

          {/* Title - Fixed at top, bold, uppercase, same size as body */}
          <div className="mb-4">
            <h2 className="font-bold uppercase text-white">
              {selectedItem.title}
            </h2>
          </div>

          {/* Quoted Text Section - Shows what this reply is responding to */}
          {quotedText && (
            <div className="mb-6 bg-slate-700/50 p-4 rounded-lg border-l-4 border-purple-500">
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                Responding to:
              </div>
              <div className="text-white font-bold leading-relaxed">
                {quotedText}
              </div>
            </div>
          )}

          {/* Scrollable Content - The actual reply */}
          <div className="max-h-[60vh] overflow-y-auto text-gray-200 leading-relaxed">
            <div className="whitespace-pre-wrap">
              {selectedItem.content}
            </div>
          </div>

          {/* Reply button for ALL content */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <button
              onClick={handleReplyClick}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
            >
              {isNexus ? 'Reply to Nexus' : 'Reply to Node'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}