'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/store';
import ExportModal from './ExportModal';
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
  const getAnchoredNodes = useCanvasStore((state) => state.getAnchoredNodes);
  const reparentNode = useCanvasStore((state) => state.reparentNode);
  const isApplicationLabMode = useCanvasStore((state) => state.isApplicationLabMode);
  const [showExportModal, setShowExportModal] = useState(false);

  // 🎯 DRAG-AND-DROP STATE
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Hide navigation tree when Application Lab is active
  if (isApplicationLabMode) {
    console.log('🔬 Hiding SectionNavigator - Application Lab is active');
    return null;
  }

  // Get all anchored nodes
  const anchoredNodes = getAnchoredNodes();

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

  // 🎯 DRAG-AND-DROP HANDLERS

  // Check if a node is an ancestor of another (prevent circular reparenting)
  const isAncestor = (potentialAncestorId: string, nodeId: string): boolean => {
    let currentId = nodeId;
    while (currentId) {
      if (currentId === potentialAncestorId) return true;
      const currentNode = nodes[currentId];
      if (!currentNode) break;
      currentId = currentNode.parentId;
    }
    return false;
  };

  // Calculate hierarchy level of a node (1 = L1, 2 = L2, 3+ = L3+)
  const getNodeLevel = (nodeId: string): number => {
    const node = nodes[nodeId];
    if (!node) return 0;

    // Check if parent is a nexus
    const isParentNexus = nexuses.some(n => n.id === node.parentId);
    if (isParentNexus) return 1; // L1

    // Recursively get parent's level and add 1
    return getNodeLevel(node.parentId) + 1;
  };

  // Calculate new position for reparented node using Fibonacci sphere distribution
  const calculateNewPosition = (parentId: string, siblingIndex: number): [number, number, number] => {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 137.5 degrees

    // Determine what level this node will be at after reparenting
    const isParentNexus = nexuses.some(n => n.id === parentId);
    let baseRadius: number;

    if (isParentNexus) {
      // L1: 8 units from nexus
      baseRadius = 8;
    } else {
      // Get parent's level to determine this node's level
      const parentLevel = getNodeLevel(parentId);
      if (parentLevel === 1) {
        // Parent is L1, so this becomes L2
        baseRadius = 5;
      } else {
        // Parent is L2+, so this becomes L3+
        baseRadius = 3;
      }
    }

    // Get parent position (either nexus or node)
    const parentNexus = nexuses.find(n => n.id === parentId);
    const parentNode = nodes[parentId];
    const parentPos = parentNexus ? parentNexus.position : parentNode ? parentNode.position : [0, 0, 0];

    // Calculate position using Fibonacci sphere distribution
    const radiusIncrement = 0.3;
    const radius = baseRadius + (siblingIndex * radiusIncrement);

    if (isParentNexus) {
      // L1 nodes: Position around nexus in a ring
      const angle = siblingIndex * goldenAngle;
      const yOffset = Math.sin(siblingIndex * 0.5) * 1.2;

      return [
        parentPos[0] + radius * Math.cos(angle),
        parentPos[1] + yOffset,
        parentPos[2] + radius * Math.sin(angle)
      ];
    } else {
      // L2+ nodes: Position BEYOND parent, extending outward from nexus

      // Find the nexus for this tree (walk up to find root)
      let currentNodeId = parentId;
      let nexusPos: [number, number, number] = [0, 0, 0];

      while (currentNodeId) {
        const currentNode = nodes[currentNodeId];
        if (!currentNode) break;

        const parentNexusFound = nexuses.find(n => n.id === currentNode.parentId);
        if (parentNexusFound) {
          nexusPos = parentNexusFound.position;
          break;
        }
        currentNodeId = currentNode.parentId;
      }

      // Calculate vector from nexus to parent (outward direction)
      const dx = parentPos[0] - nexusPos[0];
      const dy = parentPos[1] - nexusPos[1];
      const dz = parentPos[2] - nexusPos[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Normalize the outward direction
      const outwardX = distance > 0 ? dx / distance : 1;
      const outwardY = distance > 0 ? dy / distance : 0;
      const outwardZ = distance > 0 ? dz / distance : 0;

      // Calculate perpendicular vectors for spiral distribution
      // Create a perpendicular vector using cross product with up vector
      const upX = 0, upY = 1, upZ = 0;
      let perpX = outwardY * upZ - outwardZ * upY;
      let perpZ = outwardZ * upX - outwardX * upZ;
      let perpY = outwardX * upY - outwardY * upX;

      // Normalize perpendicular vector
      const perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
      if (perpLen > 0) {
        perpX /= perpLen;
        perpY /= perpLen;
        perpZ /= perpLen;
      }

      // Create second perpendicular vector (perpendicular to both outward and first perp)
      const perp2X = outwardY * perpZ - outwardZ * perpY;
      const perp2Y = outwardZ * perpX - outwardX * perpZ;
      const perp2Z = outwardX * perpY - outwardY * perpX;

      // Apply golden angle spiral around the outward direction
      const angle = siblingIndex * goldenAngle;
      const spiralRadius = radius * 0.4; // Smaller spiral around the outward vector

      // Position = parent + (outward * baseRadius) + spiral around outward axis
      return [
        parentPos[0] + (outwardX * radius) + (perpX * Math.cos(angle) + perp2X * Math.sin(angle)) * spiralRadius,
        parentPos[1] + (outwardY * radius) + (perpY * Math.cos(angle) + perp2Y * Math.sin(angle)) * spiralRadius,
        parentPos[2] + (outwardZ * radius) + (perpZ * Math.cos(angle) + perp2Z * Math.sin(angle)) * spiralRadius
      ];
    }
  };

  // Recursively recalculate positions for a node and all its descendants
  const recalculateSubtreePositions = (nodeId: string, newParentId: string) => {
    const node = nodes[nodeId];
    if (!node) return;

    // Get sibling index (position among parent's children)
    const parentNode = nodes[newParentId];
    const parentNexus = nexuses.find(n => n.id === newParentId);
    const siblings = parentNode
      ? parentNode.children
      : parentNexus
      ? Object.values(nodes).filter(n => n.parentId === newParentId).map(n => n.id)
      : [];
    const siblingIndex = siblings.indexOf(nodeId);

    // Calculate new position for this node
    const newPosition = calculateNewPosition(newParentId, siblingIndex >= 0 ? siblingIndex : 0);

    // Update this node's position (reparentNode already saves to localStorage)
    reparentNode(nodeId, newParentId, newPosition);

    // Recursively update all children (they keep same parent, just need new positions)
    node.children.forEach((childId) => {
      recalculateSubtreePositions(childId, nodeId);
    });
  };

  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    console.log('🎯 Drag started:', nodeId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't allow dropping on itself or its descendants
    if (draggedNodeId && (targetId === draggedNodeId || isAncestor(draggedNodeId, targetId))) {
      return;
    }

    setDropTargetId(targetId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, newParentId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNodeId) return;

    // Prevent dropping on itself or its descendants
    if (newParentId === draggedNodeId || isAncestor(draggedNodeId, newParentId)) {
      console.log('❌ Cannot reparent to self or descendant');
      setDraggedNodeId(null);
      setDropTargetId(null);
      return;
    }

    console.log('🎯 Drop:', draggedNodeId, '→', newParentId);

    // Recalculate positions for the entire subtree
    recalculateSubtreePositions(draggedNodeId, newParentId);

    // Clear drag state
    setDraggedNodeId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggedNodeId(null);
    setDropTargetId(null);
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

    // Visual feedback for drag-and-drop
    const isBeingDragged = draggedNodeId === treeNode.id;
    const isDropTarget = dropTargetId === treeNode.id;
    const isDragActive = draggedNodeId !== null;

    return (
      <>
        <div
          draggable={!isNexus} // Only nodes are draggable (not nexuses)
          onDragStart={(e) => handleDragStart(e, treeNode.id)}
          onDragOver={(e) => handleDragOver(e, treeNode.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, treeNode.id)}
          onDragEnd={handleDragEnd}
          onClick={() => handleClick(treeNode.id)}
          style={{
            padding: '8px 12px',
            paddingLeft: `${12 + indent}px`,
            marginBottom: isNexus ? '8px' : '4px',
            borderRadius: '6px',
            cursor: isBeingDragged ? 'grabbing' : !isNexus ? 'grab' : 'pointer',
            backgroundColor: isDropTarget
              ? 'rgba(34, 197, 94, 0.3)' // Green for drop target
              : selectedId === treeNode.id
              ? 'rgba(147, 51, 234, 0.3)'
              : 'transparent',
            border: isDropTarget
              ? '2px solid #22C55E' // Green border for drop target
              : selectedId === treeNode.id
              ? '2px solid #9333EA'
              : '2px solid transparent',
            color: selectedId === treeNode.id
              ? '#FFD700'
              : isNexus
              ? 'white'
              : '#D1D5DB',
            opacity: isBeingDragged ? 0.5 : 1,
            transition: 'all 0.2s',
            fontSize: isNexus ? '13px' : '12px',
            fontWeight: selectedId === treeNode.id ? 'bold' : isNexus ? 'bold' : 'normal',
            wordBreak: 'break-word',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            transform: isDropTarget ? 'scale(1.05)' : 'scale(1)',
            boxShadow: isDropTarget ? '0 0 10px rgba(34, 197, 94, 0.5)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (selectedId !== treeNode.id && !isDragActive) {
              e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedId !== treeNode.id && !isDragActive) {
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
        {/* Anchored Nodes Section */}
        {anchoredNodes.length > 0 && (
          <>
            <div style={{
              color: '#FFD700',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '8px 12px',
              borderBottom: '2px solid rgba(255, 215, 0, 0.3)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⚓</span>
              <span>ANCHORED NODES ({anchoredNodes.length})</span>
            </div>

            {anchoredNodes.map(node => {
              const label = getNodeLabel(node);
              const icon = getNodeTypeIcon(node.nodeType);

              return (
                <div
                  key={node.id}
                  onClick={() => handleClick(node.id)}
                  style={{
                    padding: '8px 12px',
                    marginBottom: '4px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: selectedId === node.id
                      ? 'rgba(255, 215, 0, 0.2)'
                      : 'transparent',
                    border: selectedId === node.id
                      ? '2px solid #FFD700'
                      : '2px solid transparent',
                    borderLeft: '3px solid #FFD700',
                    color: selectedId === node.id ? '#FFD700' : '#F3E99F',
                    transition: 'all 0.2s',
                    fontSize: '12px',
                    fontWeight: selectedId === node.id ? 'bold' : 'normal',
                    wordBreak: 'break-word',
                    lineHeight: '1.4',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedId !== node.id) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== node.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span style={{
                    fontSize: '14px',
                    lineHeight: '1.2',
                    flexShrink: 0,
                  }}>
                    {icon || '•'}
                  </span>
                  <span style={{ flex: 1 }}>
                    {label}
                  </span>
                </div>
              );
            })}

            <div style={{
              height: '1px',
              background: 'linear-gradient(90deg, rgba(255,215,0,0.5) 0%, rgba(255,215,0,0) 100%)',
              margin: '12px 0'
            }} />
          </>
        )}

        {/* Render complete tree */}
        <TreeNodeComponent treeNode={tree} />
      </div>

      {/* Export Universe Button */}
      <button
        onClick={() => setShowExportModal(true)}
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
        📄 Export Universe
      </button>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}
