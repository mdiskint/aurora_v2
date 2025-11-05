import { Node } from './types';

export interface MemoryPalaceNode {
  id: string;
  position: [number, number, number]; // x, y, z (y is always 0 for ground level)
  direction: number; // rotation in radians (which way the node "faces")
  originalNode: Node;
  sequenceIndex: number; // order in the walkthrough
}

export interface MemoryPalaceLayout {
  nodes: MemoryPalaceNode[];
  walls: Array<{
    start: [number, number, number];
    end: [number, number, number];
    nodeIndex: number; // Which node this wall belongs to
    color: string; // Color for this wall section
  }>;
  pathWidth: number;
}

/**
 * Traverse the conversation tree in depth-first order
 * Starts from a parent ID and finds all child nodes
 */
function traverseTree(
  parentId: string,
  nodesMap: { [id: string]: Node },
  visited: Set<string> = new Set()
): Node[] {
  const result: Node[] = [];

  // Find all nodes whose parentId matches
  const childNodes = Object.values(nodesMap).filter(node => node.parentId === parentId);

  console.log(`🏛️ 🔍 Finding children of ${parentId}: found ${childNodes.length} direct children`);

  for (const node of childNodes) {
    if (visited.has(node.id)) continue;

    visited.add(node.id);
    result.push(node);

    // Recursively get this node's children
    const grandchildren = traverseTree(node.id, nodesMap, visited);
    result.push(...grandchildren);
  }

  return result;
}

// Bright, distinct colors for wall sections (memory landmarks)
const WALL_COLORS = [
  '#00BFFF', // Bright Blue
  '#FF6B35', // Bright Orange
  '#9B59B6', // Bright Purple
  '#00FF7F', // Bright Green
  '#FFD700', // Bright Yellow
  '#FF1493', // Bright Pink
  '#00FFFF', // Cyan
  '#FF4500', // Red-Orange
  '#7FFF00', // Chartreuse
  '#FF69B4', // Hot Pink
  '#1E90FF', // Dodger Blue
  '#FF8C00', // Dark Orange
  '#8A2BE2', // Blue Violet
  '#32CD32', // Lime Green
  '#FFB6C1', // Light Pink
  '#4169E1', // Royal Blue
  '#FFA500', // Orange
];

// Room size presets for variety (like real house rooms)
const ROOM_TYPES = [
  { width: 5, depth: 5, name: 'small' },
  { width: 6, depth: 5, name: 'compact' },
  { width: 7, depth: 6, name: 'medium' },
  { width: 8, depth: 7, name: 'large' },
  { width: 9, depth: 8, name: 'grand' },
  { width: 6, depth: 8, name: 'long' },
  { width: 8, depth: 6, name: 'wide' },
];

// Seeded random number generator
function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

type Direction = 'right' | 'down' | 'left' | 'up';

interface RoomLayout {
  width: number;
  depth: number;
  x: number;
  z: number;
  exitDirection: Direction | null;
  entryDirection: Direction | null;
  doorPosition: [number, number, number]; // Position of exit door
}

/**
 * Generate a path-following house layout where each room connects sequentially
 * with properly aligned doorways
 */
export function generateMemoryPalaceLayout(
  nexusId: string,
  nodesMap: { [id: string]: Node }
): MemoryPalaceLayout {
  const orderedNodes = traverseTree(nexusId, nodesMap);

  if (orderedNodes.length === 0) {
    return { nodes: [], walls: [], pathWidth: 4 };
  }

  const seed = nexusId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = seededRandom(seed);

  const doorWidth = 2.5;
  const memoryNodes: MemoryPalaceNode[] = [];
  const walls: Array<{
    start: [number, number, number];
    end: [number, number, number];
    nodeIndex: number;
    color: string;
  }> = [];

  const rooms: RoomLayout[] = [];
  let currentX = 0;
  let currentZ = 0;

  // Build path-following layout
  orderedNodes.forEach((node, index) => {
    const roomType = ROOM_TYPES[Math.floor(random() * ROOM_TYPES.length)];
    const hasNextRoom = index < orderedNodes.length - 1;

    // Determine exit direction (alternate for snake pattern)
    let exitDirection: Direction | null = null;
    if (hasNextRoom) {
      // Snake pattern: go right for a few, then down, then left, then down, repeat
      const roomsInRow = 4;
      const rowNum = Math.floor(index / roomsInRow);
      const colNum = index % roomsInRow;

      if (colNum < roomsInRow - 1 && index < orderedNodes.length - 1) {
        exitDirection = rowNum % 2 === 0 ? 'right' : 'left';
      } else if (index < orderedNodes.length - 1) {
        exitDirection = 'down';
      }
    }

    // Entry direction is opposite of previous room's exit
    const entryDirection = index > 0 ? rooms[index - 1].exitDirection : null;

    const room: RoomLayout = {
      width: roomType.width,
      depth: roomType.depth,
      x: currentX,
      z: currentZ,
      exitDirection,
      entryDirection,
      doorPosition: [0, 0, 0] // Will be calculated
    };

    // Calculate door position based on exit direction
    if (exitDirection === 'right') {
      room.doorPosition = [currentX + roomType.width, 0, currentZ + roomType.depth / 2];
    } else if (exitDirection === 'down') {
      room.doorPosition = [currentX + roomType.width / 2, 0, currentZ + roomType.depth];
    } else if (exitDirection === 'left') {
      room.doorPosition = [currentX, 0, currentZ + roomType.depth / 2];
    } else if (exitDirection === 'up') {
      room.doorPosition = [currentX + roomType.width / 2, 0, currentZ];
    }

    rooms.push(room);

    // Position node in center of room
    memoryNodes.push({
      id: node.id,
      position: [currentX + roomType.width / 2, 0, currentZ + roomType.depth / 2],
      direction: 0,
      originalNode: node,
      sequenceIndex: index
    });

    // Calculate next room position based on exit direction
    if (exitDirection === 'right') {
      currentX += roomType.width + 0.5;
    } else if (exitDirection === 'down') {
      currentZ += roomType.depth + 0.5;
    } else if (exitDirection === 'left') {
      currentX -= roomType.width + 0.5;
    } else if (exitDirection === 'up') {
      currentZ -= roomType.depth + 0.5;
    }
  });

  // Generate walls with aligned doorways
  rooms.forEach((room, index) => {
    const { x, z, width, depth, exitDirection, entryDirection } = room;
    const color = WALL_COLORS[index % WALL_COLORS.length];

    // Top wall
    if (entryDirection !== 'up' && exitDirection !== 'up') {
      walls.push({
        start: [x, 0, z],
        end: [x + width, 0, z],
        nodeIndex: index,
        color
      });
    } else {
      // Door in top wall
      walls.push({
        start: [x, 0, z],
        end: [x + width/2 - doorWidth/2, 0, z],
        nodeIndex: index,
        color
      });
      walls.push({
        start: [x + width/2 + doorWidth/2, 0, z],
        end: [x + width, 0, z],
        nodeIndex: index,
        color
      });
    }

    // Bottom wall
    if (entryDirection !== 'down' && exitDirection !== 'down') {
      walls.push({
        start: [x, 0, z + depth],
        end: [x + width, 0, z + depth],
        nodeIndex: index,
        color
      });
    } else {
      // Door in bottom wall
      walls.push({
        start: [x, 0, z + depth],
        end: [x + width/2 - doorWidth/2, 0, z + depth],
        nodeIndex: index,
        color
      });
      walls.push({
        start: [x + width/2 + doorWidth/2, 0, z + depth],
        end: [x + width, 0, z + depth],
        nodeIndex: index,
        color
      });
    }

    // Left wall
    if (entryDirection !== 'left' && exitDirection !== 'left') {
      walls.push({
        start: [x, 0, z],
        end: [x, 0, z + depth],
        nodeIndex: index,
        color
      });
    } else {
      // Door in left wall
      walls.push({
        start: [x, 0, z],
        end: [x, 0, z + depth/2 - doorWidth/2],
        nodeIndex: index,
        color
      });
      walls.push({
        start: [x, 0, z + depth/2 + doorWidth/2],
        end: [x, 0, z + depth],
        nodeIndex: index,
        color
      });
    }

    // Right wall
    if (entryDirection !== 'right' && exitDirection !== 'right') {
      walls.push({
        start: [x + width, 0, z],
        end: [x + width, 0, z + depth],
        nodeIndex: index,
        color
      });
    } else {
      // Door in right wall
      walls.push({
        start: [x + width, 0, z],
        end: [x + width, 0, z + depth/2 - doorWidth/2],
        nodeIndex: index,
        color
      });
      walls.push({
        start: [x + width, 0, z + depth/2 + doorWidth/2],
        end: [x + width, 0, z + depth],
        nodeIndex: index,
        color
      });
    }
  });

  console.log('🏛️ ========================================');
  console.log('🏛️ Generated Memory Palace layout:');
  console.log(`  - ${memoryNodes.length} nodes in sequence`);
  console.log(`  - ${walls.length} wall segments`);
  console.log(`  - ${rooms.length} rooms with varied sizes`);
  console.log(`  - Path-following snake layout with 4 rooms per row`);
  if (memoryNodes.length > 0) {
    console.log('🏛️ Room sizes:');
    rooms.forEach((r, i) => {
      console.log(`  ${i}: ${r.width}x${r.depth}m at [${r.x.toFixed(1)}, ${r.z.toFixed(1)}] - ${memoryNodes[i].originalNode.title?.substring(0, 30) || 'untitled'}`);
    });
  }
  console.log('🏛️ ========================================');

  return {
    nodes: memoryNodes,
    walls,
    pathWidth: 7 // Average room size for navigation
  };
}
