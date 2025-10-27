'use client';

import { useCanvasStore } from '@/lib/store';
import PaperUploader from './PaperUploader';
import { Node } from '@/lib/types';
import { getDisplayTitle, getNodeTypeIcon } from '@/lib/titleGenerator';

// Recursive tree node structure
interface TreeNode {
  id: string;
  data: Node | { id: string; title: string; content: string }; // Node or Nexus
  children: TreeNode[];
  level: number;
}

export default function SectionNavigator() {
  const selectedId = useCanvasStore((state) => state.selectedId);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const exportToWordDoc = useCanvasStore((state) => state.exportToWordDoc);

  // Get current nexus (selected or most recent chat/paper nexus)
  let nexus = selectedId ? nexuses.find(n => n.id === selectedId) : null;

  // If selected item is a node, find its parent nexus
  if (!nexus && selectedId && nodes[selectedId]) {
    let currentNode = nodes[selectedId];
    // Walk up the tree to find the root nexus
    while (currentNode && currentNode.parentId) {
      const parent = nexuses.find(n => n.id === currentNode.parentId);
      if (parent) {
        nexus = parent;
        break;
      }
      currentNode = nodes[currentNode.parentId];
    }
  }

  // Fallback to most recent nexus (chat or paper)
  if (!nexus) {
    nexus = nexuses.find(n => n.id.startsWith('chat-') || n.id.startsWith('l1-')) || nexuses[0];
  }

  if (!nexuses.length || !nexus) return null;

  // Build recursive tree structure
  const buildTree = (parentId: string, level: number = 0): TreeNode[] => {
    const children = Object.values(nodes)
      .filter(node => node.parentId === parentId)
      .sort((a, b) => {
        // Sort by creation time (timestamp in ID)
        const aTime = parseInt(a.id.split('-')[1]) || 0;
        const bTime = parseInt(b.id.split('-')[1]) || 0;
        return aTime - bTime;
      });

    return children.map(node => ({
      id: node.id,
      data: node,
      level,
      children: buildTree(node.id, level + 1),
    }));
  };

  // Build the complete tree starting from nexus
  const tree: TreeNode = {
    id: nexus.id,
    data: nexus,
    level: 0,
    children: buildTree(nexus.id, 1),
  };

  const handleClick = (id: string) => {
    selectNode(id, true);
  };

  // Helper function to get meaningful node label
  const getNodeLabel = (nodeData: Node | { id: string; title: string; content: string }) => {
    // If this is a Node with semanticTitle, use it
    if ('semanticTitle' in nodeData && nodeData.semanticTitle) {
      return nodeData.semanticTitle;
    }

    // Otherwise use getDisplayTitle helper for Nodes, or fall back to content preview
    if ('semanticTitle' in nodeData) {
      // It's a Node, use the helper
      return getDisplayTitle(nodeData);
    }

    // For non-Node objects (nexuses), use content preview
    if (nodeData.content && nodeData.content.trim()) {
      const preview = nodeData.content.trim().substring(0, 50);
      return preview + (nodeData.content.length > 50 ? '...' : '');
    }

    // Fallback to title if content is empty (but skip generic timestamp titles)
    if (nodeData.title && !nodeData.title.startsWith('Reply ')) {
      return nodeData.title;
    }

    // Last resort: timestamp
    const timestamp = parseInt(nodeData.id.split('-')[1]) || Date.now();
    return `Node ${new Date(timestamp).toLocaleTimeString()}`;
  };

  // Recursive component to render tree nodes
  const TreeNodeComponent = ({ treeNode }: { treeNode: TreeNode }) => {
    const isNexus = treeNode.level === 0;
    const indent = treeNode.level * 20; // 20px per level
    const label = getNodeLabel(treeNode.data);

    // Get node type icon if this is a Node
    const icon = !isNexus && 'nodeType' in treeNode.data
      ? getNodeTypeIcon(treeNode.data.nodeType)
      : null;

    return (
      <>
        <div
          onClick={() => handleClick(treeNode.id)}
          style={{
            padding: '8px 12px',
            paddingLeft: `${12 + indent}px`,
            marginBottom: isNexus ? '8px' : '4px',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: selectedId === treeNode.id
              ? 'rgba(147, 51, 234, 0.3)'
              : 'transparent',
            border: selectedId === treeNode.id
              ? '2px solid #9333EA'
              : '2px solid transparent',
            color: selectedId === treeNode.id
              ? '#FFD700'
              : isNexus
              ? 'white'
              : '#D1D5DB',
            transition: 'all 0.2s',
            fontSize: isNexus ? '13px' : '12px',
            fontWeight: selectedId === treeNode.id ? 'bold' : isNexus ? 'bold' : 'normal',
            wordBreak: 'break-word',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
          }}
          onMouseEnter={(e) => {
            if (selectedId !== treeNode.id) {
              e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedId !== treeNode.id) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {/* Node type icon or bullet point for non-nexus nodes */}
          {!isNexus && (
            <span style={{
              fontSize: '14px',
              lineHeight: '1.2',
              flexShrink: 0,
            }}>
              {icon || '•'}
            </span>
          )}
          <span style={{ flex: 1 }}>
            {label}
          </span>
        </div>

        {/* Recursively render children */}
        {treeNode.children.map(child => (
          <TreeNodeComponent key={child.id} treeNode={child} />
        ))}
      </>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '350px',
        maxHeight: '500px',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        border: '2px solid rgba(147, 51, 234, 0.5)',
        padding: '16px',
        zIndex: 1000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{
        color: '#9333EA',
        fontWeight: 'bold',
        marginBottom: '12px',
        fontSize: '14px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        Navigation Tree
      </div>

      <div style={{
        overflowY: 'auto',
        flex: 1,
        paddingRight: '8px',
        marginBottom: '12px',
      }}>
        {/* Render complete tree */}
        <TreeNodeComponent treeNode={tree} />
      </div>

      {/* Paper Upload Button */}
      <PaperUploader />

      {/* Export to Word Button */}
      <button
        onClick={exportToWordDoc}
        style={{
          width: '100%',
          marginTop: '12px',
          padding: '12px 16px',
          backgroundColor: 'rgba(147, 51, 234, 0.2)',
          border: '2px solid rgba(147, 51, 234, 0.5)',
          borderRadius: '8px',
          color: '#D8B4FE',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.3)';
          e.currentTarget.style.borderColor = '#9333EA';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.2)';
          e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.5)';
        }}
      >
        <svg
          style={{ width: '20px', height: '20px' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Export to Word
      </button>
    </div>
  );
}
