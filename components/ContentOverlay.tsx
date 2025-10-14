import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCanvasStore } from '@/lib/store';

export default function ContentOverlay() {
  const pathname = usePathname();
  const isExplorePage = pathname === '/explore' || pathname === '/create';

  const selectedId = useCanvasStore((state) => state.selectedId);
  const nodes = useCanvasStore((state) => state.nodes);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const showContentOverlay = useCanvasStore((state) => state.showContentOverlay);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const updateNexusContent = useCanvasStore((state) => state.updateNexusContent);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const setShowReplyModal = useCanvasStore((state) => state.setShowReplyModal);
  const setQuotedText = useCanvasStore((state) => state.setQuotedText);
  
  const [editedContent, setEditedContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Find selected node or nexus
  const node = selectedId ? nodes[selectedId] : null;
  const nexus = selectedId ? nexuses.find((n) => n.id === selectedId) : null;
  const selectedItem = node || nexus;

  // Initialize edited content when selection changes
  useEffect(() => {
    if (selectedItem && textareaRef.current) {
      const content = selectedItem.content || '';
      setEditedContent(content);
      setHasUnsavedChanges(false);
      // Set textarea value directly to avoid React re-render
      textareaRef.current.value = content;
    }
  }, [selectedId, selectedItem]);

  // Auto-save with debounce - moved into handleContentChange for better control
  // This useEffect now only handles save on node switch
  useEffect(() => {
    return () => {
      // Save when switching nodes/nexuses
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (hasUnsavedChanges && selectedItem && isExplorePage && textareaRef.current) {
        const currentValue = textareaRef.current.value;
        if (node) {
          updateNodeContent(node.id, currentValue);
        } else if (nexus) {
          updateNexusContent(nexus.id, currentValue);
        }
      }
    };
  }, [selectedId]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setHasUnsavedChanges(true);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout - only save after user STOPS typing for 1 second
    saveTimeoutRef.current = setTimeout(() => {
      const currentValue = textareaRef.current?.value || '';
      if (isExplorePage && selectedItem) {
        if (node) {
          updateNodeContent(node.id, currentValue);
        } else if (nexus) {
          updateNexusContent(nexus.id, currentValue);
        }
        setHasUnsavedChanges(false);
        console.log('✅ Auto-saved changes to:', selectedItem.id);
      }
    }, 1000);
  };

  const handleClose = () => {
    // Save before closing if there are unsaved changes
    if (hasUnsavedChanges && selectedItem && isExplorePage && textareaRef.current) {
      const currentValue = textareaRef.current.value;
      if (node) {
        updateNodeContent(node.id, currentValue);
      } else if (nexus) {
        updateNexusContent(nexus.id, currentValue);
      }
    }
    // Keep node selected, just hide overlay - this preserves "next node" highlighting
    selectNode(selectedId, false);
  };

  const handleReply = () => {
    // Get any selected/highlighted text
    const selection = window.getSelection();
    const highlightedText = selection?.toString().trim() || '';
    
    if (highlightedText) {
      setQuotedText(highlightedText);
      console.log('📝 Quoted text:', highlightedText);
    } else {
      setQuotedText(null);
    }
    
    // Open reply modal
    setShowReplyModal(true);
  };

  // Don't show if nothing selected or overlay is hidden
  if (!selectedItem || !showContentOverlay) return null;

  return (
    <>
      {/* Backdrop - click to close */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000]"
        onClick={handleClose}
      />

      {/* Centered Modal - 70% width, 80% height */}
      <div 
        className="fixed z-[2001]"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '70vw',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/50 rounded-2xl shadow-2xl h-full flex flex-col">
          
          {/* Header */}
          <div className="p-6 border-b border-cyan-500/30 flex items-start justify-between flex-shrink-0">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-cyan-400 mb-2">
                {selectedItem.title || 'Untitled'}
              </h2>
              <div className="flex items-center gap-4">
                {hasUnsavedChanges && isExplorePage && (
                  <div className="text-sm text-yellow-400 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                    Saving...
                  </div>
                )}
                {!hasUnsavedChanges && isExplorePage && selectedItem && (
                  <div className="text-sm text-green-400/80 flex items-center gap-2">
                    ✓ Saved
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  ID: {selectedItem.id}
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded"
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content Area - Scrollable and Fills Space */}
          <div className="flex-1 overflow-y-auto p-6">
            {isExplorePage && selectedItem ? (
              <div className="relative h-full flex flex-col">
                <textarea
                  ref={textareaRef}
                  defaultValue={editedContent}
                  onChange={handleContentChange}
                  className="w-full flex-1 bg-slate-950/50 text-gray-200 border border-cyan-500/20 rounded-lg p-4 
                           focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30
                           resize-none text-base leading-relaxed"
                  placeholder="Start typing to edit this section..."
                  spellCheck={true}
                  style={{ minHeight: '400px' }}
                />
                <div className="mt-2 text-xs text-gray-500 italic">
                  💡 Changes auto-save as you type • Ctrl+Z to undo works naturally
                </div>
              </div>
            ) : (
              <div className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                {selectedItem.content || 'No content available.'}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-cyan-500/30 flex justify-between items-center flex-shrink-0">
            <div className="text-sm text-gray-400">
              {isExplorePage && selectedItem ? (
                <span>✏️ Edit mode active - {nexus ? 'Nexus' : 'Node'}</span>
              ) : (
                <span>👁️ Read-only view</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReply}
                type="button"
                className="px-6 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 
                         text-purple-300 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Reply
              </button>
              <button
                onClick={handleClose}
                type="button"
                className="px-6 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 
                         text-cyan-300 rounded-lg transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}