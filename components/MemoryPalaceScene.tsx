'use client';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useCanvasStore } from '@/lib/store';
import { generateMemoryPalaceLayout, MemoryPalaceLayout, MemoryPalaceNode } from '@/lib/memoryPalaceLayout';

// Manual panning enabled with OrbitControls

// Animated golden ball that moves between nodes
function MovingBall({
  nodes,
  currentIndex,
  onArrival
}: {
  nodes: MemoryPalaceNode[];
  currentIndex: number;
  onArrival?: () => void;
}) {
  const ballRef = useRef<THREE.Mesh>(null);
  const [fromPos, setFromPos] = useState<THREE.Vector3>(new THREE.Vector3());
  const [toPos, setToPos] = useState<THREE.Vector3>(new THREE.Vector3());
  const [progress, setProgress] = useState(1); // Start at 1 (arrived)
  const hasCalledArrival = useRef(false);

  useEffect(() => {
    if (nodes.length === 0) return;

    const currentNode = nodes[currentIndex];
    if (!currentNode) return;

    // Set previous position
    if (currentIndex > 0) {
      const prevNode = nodes[currentIndex - 1];
      setFromPos(new THREE.Vector3(...prevNode.position));
    } else {
      setFromPos(new THREE.Vector3(...currentNode.position));
    }

    // Set target position
    setToPos(new THREE.Vector3(...currentNode.position));

    // Start animation
    setProgress(0);
    hasCalledArrival.current = false;

    console.log('🟡 Ball moving from', fromPos, 'to', toPos);
  }, [currentIndex, nodes]);

  useFrame((state, delta) => {
    if (!ballRef.current) return;

    // Animate ball movement
    if (progress < 1) {
      const newProgress = Math.min(progress + delta * 0.7, 1); // 1.4 second duration
      setProgress(newProgress);

      // Ease-in-out cubic
      const eased = newProgress < 0.5
        ? 4 * newProgress * newProgress * newProgress
        : 1 - Math.pow(-2 * newProgress + 2, 3) / 2;

      // Lerp between positions
      const currentPos = new THREE.Vector3().lerpVectors(fromPos, toPos, eased);

      // Add arc (higher in the middle)
      const arcHeight = Math.sin(eased * Math.PI) * 2.5;
      currentPos.y = 0.5 + arcHeight;

      ballRef.current.position.copy(currentPos);

      // Gentle rotation
      ballRef.current.rotation.x += delta * 2;
      ballRef.current.rotation.y += delta * 3;

      // Call onArrival when animation completes
      if (newProgress >= 1 && !hasCalledArrival.current && onArrival) {
        hasCalledArrival.current = true;
        onArrival();
        console.log('🟡✅ Ball arrived at node', currentIndex);
      }
    }
  });

  return (
    <mesh ref={ballRef} position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFD700"
        emissiveIntensity={1.2}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
}

// Auto-navigation controller - smoothly pans camera to target node (top-down view)
function AutoNavigationController({ target }: { target: [number, number, number] | null }) {
  const { camera } = useThree();
  const isAnimating = useRef(false);
  const startPos = useRef(new THREE.Vector3());
  const startTime = useRef(0);
  const duration = 1500; // 1.5 seconds animation

  useEffect(() => {
    if (!target) return;

    console.log('🏛️ Starting auto-navigation to:', target);
    isAnimating.current = true;
    startPos.current.copy(camera.position);
    startTime.current = Date.now();
  }, [target, camera]);

  useFrame(() => {
    if (!isAnimating.current || !target) return;

    const elapsed = Date.now() - startTime.current;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out cubic
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Move camera to be directly above the target, maintaining high altitude
    const targetPos = new THREE.Vector3(target[0], 30, target[2]);

    camera.position.lerpVectors(startPos.current, targetPos, eased);

    if (progress >= 1) {
      isAnimating.current = false;
      console.log('🏛️ Navigation complete');
    }
  });

  return null;
}

// Render a single node in the memory palace (2D top-down view)
function MemoryPalaceNodeMesh({ node, isCurrentNode }: { node: MemoryPalaceNode; isCurrentNode: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    console.log('🏛️ 🔵 Rendering node:', {
      id: node.id,
      title: node.originalNode.title?.substring(0, 30),
      position: node.position,
      isCurrentNode
    });
  }, [node.id, isCurrentNode]);

  // Gentle pulse for current node
  useFrame((state) => {
    if (!meshRef.current || !isCurrentNode) return;
    const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
    meshRef.current.scale.set(scale, 1, scale);
  });

  const color = isCurrentNode ? '#FFD700' : '#00FFD4';
  const size = isCurrentNode ? 1.0 : 0.7;

  return (
    <group position={node.position}>
      {/* Flat circle on ground for 2D appearance */}
      <mesh ref={meshRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[size, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isCurrentNode ? 1.0 : 0.5}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Outer ring for emphasis */}
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 0.9, size * 1.1, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          transparent
          opacity={isCurrentNode ? 0.8 : 0.4}
        />
      </mesh>
    </group>
  );
}

// Render walls of the maze with color-coding
function Walls({ walls }: {
  walls: Array<{
    start: [number, number, number];
    end: [number, number, number];
    nodeIndex: number;
    color: string;
  }>
}) {
  return (
    <>
      {walls.map((wall, i) => {
        const start = new THREE.Vector3(...wall.start);
        const end = new THREE.Vector3(...wall.end);
        const center = start.clone().add(end).multiplyScalar(0.5);
        const length = start.distanceTo(end);
        const angle = Math.atan2(end.z - start.z, end.x - start.x);

        return (
          <Box
            key={i}
            position={[center.x, 0.5, center.z]}
            args={[length, 1, 0.4]}
            rotation={[0, angle, 0]}
          >
            <meshStandardMaterial
              color={wall.color}
              emissive={wall.color}
              emissiveIntensity={0.4}
              roughness={0.5}
              metalness={0.5}
            />
          </Box>
        );
      })}
    </>
  );
}

// Ground plane - large and visible
function Ground() {
  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial
        color="#0f172a"
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}

// Main Memory Palace 3D Scene
function MemoryPalace3DScene() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const memoryPalaceCurrentIndex = useCanvasStore((state) => state.memoryPalaceCurrentIndex);

  const [navigationTarget, setNavigationTarget] = useState<[number, number, number] | null>(null);
  // displayIndex tracks which node should be highlighted (updated after ball arrives)
  const [displayIndex, setDisplayIndex] = useState<number>(0);

  // Generate memory palace layout from current conversation
  const layout: MemoryPalaceLayout = useMemo(() => {
    console.log('🏛️ ==========================================');
    console.log('🏛️ GENERATING MEMORY PALACE LAYOUT');
    console.log('🏛️ Nexuses:', nexuses.length);
    console.log('🏛️ Nodes:', Object.keys(nodes).length);

    if (nexuses.length === 0) {
      console.log('🏛️ ❌ No nexuses found - returning empty layout');
      return { nodes: [], walls: [], pathWidth: 4 };
    }

    // Use the first nexus as the starting point
    const nexusId = nexuses[0].id;
    console.log('🏛️ Starting from nexus:', nexusId, nexuses[0].title);

    const generatedLayout = generateMemoryPalaceLayout(nexusId, nodes);

    console.log('🏛️ ✅ Layout generated:');
    console.log('🏛️   - Memory Palace Nodes:', generatedLayout.nodes.length);
    console.log('🏛️   - Walls:', generatedLayout.walls.length);
    console.log('🏛️   - Path Width:', generatedLayout.pathWidth);

    if (generatedLayout.nodes.length > 0) {
      console.log('🏛️ First node position:', generatedLayout.nodes[0].position);
      console.log('🏛️ Last node position:', generatedLayout.nodes[generatedLayout.nodes.length - 1].position);
    }

    console.log('🏛️ ==========================================');

    return generatedLayout;
  }, [nexuses, nodes]);

  // Log when component mounts and initialize display index
  useEffect(() => {
    console.log('🏛️ 🎬 MemoryPalace3DScene MOUNTED');
    console.log('🏛️ Initial layout:', layout);
    // Initialize displayIndex to current index on mount
    setDisplayIndex(memoryPalaceCurrentIndex);
    return () => {
      console.log('🏛️ 🎬 MemoryPalace3DScene UNMOUNTED');
    };
  }, []);

  // Handle navigation when index changes
  useEffect(() => {
    if (layout.nodes.length === 0) {
      console.log('🏛️ ⚠️ No nodes in layout for navigation');
      return;
    }

    const targetNode = layout.nodes[memoryPalaceCurrentIndex];
    if (targetNode) {
      console.log(`🏛️ Navigating to node ${memoryPalaceCurrentIndex}:`, targetNode.originalNode.title);
      setNavigationTarget(targetNode.position);
    }
  }, [memoryPalaceCurrentIndex, layout]);

  // Callback when ball arrives at target node - update the display index to highlight the node
  const handleBallArrival = () => {
    setDisplayIndex(memoryPalaceCurrentIndex);
    console.log(`🏛️✨ Node ${memoryPalaceCurrentIndex} now highlighted (ball arrived)`);
  };

  console.log('🏛️ RENDERING MemoryPalace3DScene with', layout.nodes.length, 'nodes');

  return (
    <>
      <AutoNavigationController target={navigationTarget} />

      {/* Lighting - optimized for top-down view */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[0, 25, 0]} intensity={1.2} castShadow />
      <hemisphereLight args={['#ffffff', '#444444', 0.5]} />

      {/* Scene elements */}
      <Ground />
      <Walls walls={layout.walls} />

      {/* Moving golden ball */}
      {layout.nodes.length > 0 && (
        <MovingBall
          nodes={layout.nodes}
          currentIndex={memoryPalaceCurrentIndex}
          onArrival={handleBallArrival}
        />
      )}

      {/* Render all nodes in sequence */}
      {layout.nodes.map((node, i) => (
        <MemoryPalaceNodeMesh
          key={node.id}
          node={node}
          isCurrentNode={i === displayIndex}
        />
      ))}
    </>
  );
}

// Navigation UI overlay
function NavigationOverlay() {
  const navigateToNextNode = useCanvasStore((state) => state.navigateToNextNode);
  const navigateToPreviousNode = useCanvasStore((state) => state.navigateToPreviousNode);
  const toggleMemoryPalaceMode = useCanvasStore((state) => state.toggleMemoryPalaceMode);
  const currentIndex = useCanvasStore((state) => state.memoryPalaceCurrentIndex);
  const nodes = useCanvasStore((state) => state.nodes);
  const nexuses = useCanvasStore((state) => state.nexuses);

  // Generate layout to get accurate node count
  const layout = useMemo(() => {
    if (nexuses.length === 0) {
      return { nodes: [], walls: [], pathWidth: 4 };
    }
    return generateMemoryPalaceLayout(nexuses[0].id, nodes);
  }, [nexuses, nodes]);

  const totalNodes = layout.nodes.length;

  console.log('🏛️ 🎮 NavigationOverlay - Current:', currentIndex, 'Total:', totalNodes);

  return (
    <div style={{
      position: 'absolute',
      bottom: '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '16px',
      zIndex: 1000,
      alignItems: 'center'
    }}>
      {/* Previous button */}
      <button
        onClick={navigateToPreviousNode}
        style={{
          padding: '12px 24px',
          backgroundColor: '#8B5CF6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}
      >
        ← Previous
      </button>

      {/* Progress indicator */}
      <div style={{
        padding: '12px 24px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#00FFD4',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 'bold',
        border: '2px solid #00FFD4'
      }}>
        {currentIndex + 1} / {totalNodes}
      </div>

      {/* Next button */}
      <button
        onClick={navigateToNextNode}
        style={{
          padding: '12px 24px',
          backgroundColor: '#00FFD4',
          color: '#050A1E',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}
      >
        Next →
      </button>

      {/* Exit button */}
      <button
        onClick={toggleMemoryPalaceMode}
        style={{
          padding: '12px 24px',
          backgroundColor: '#EF4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginLeft: '24px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}
      >
        Exit Memory Palace
      </button>
    </div>
  );
}

// Content display overlay - shows node content when you arrive
function NodeContentOverlay() {
  const currentIndex = useCanvasStore((state) => state.memoryPalaceCurrentIndex);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);

  // Generate layout to get the current node
  const layout = useMemo(() => {
    if (nexuses.length === 0) {
      return { nodes: [], walls: [], pathWidth: 4 };
    }
    return generateMemoryPalaceLayout(nexuses[0].id, nodes);
  }, [nexuses, nodes]);

  const currentNode = layout.nodes[currentIndex];

  if (!currentNode) return null;

  const { originalNode } = currentNode;
  const isNexus = currentNode.sequenceIndex === 0;

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      right: '20px',
      maxWidth: '800px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: '#FFFFFF',
      padding: '24px',
      borderRadius: '12px',
      border: `3px solid ${isNexus ? '#FFD700' : '#00FFD4'}`,
      zIndex: 1000,
      maxHeight: '60vh',
      overflowY: 'auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
    }}>
      {/* Title */}
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '16px',
        color: isNexus ? '#FFD700' : '#00FFD4',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span>{isNexus ? '🏛️' : '💬'}</span>
        <span>{originalNode.title || (isNexus ? 'Nexus' : `Node ${currentIndex}`)}</span>
      </div>

      {/* Content */}
      <div style={{
        fontSize: '16px',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        color: '#E5E5E5'
      }}>
        {originalNode.content || 'No content available'}
      </div>

      {/* Node indicator */}
      <div style={{
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        fontSize: '14px',
        color: '#999',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>{isNexus ? 'Nexus (Starting Point)' : `Reply Node`}</span>
        <span>Position {currentIndex + 1} of {layout.nodes.length}</span>
      </div>
    </div>
  );
}

// Camera controls - allows panning with two-finger drag while maintaining top-down view
function CameraControls() {
  return (
    <OrbitControls
      enableRotate={false} // Disable rotation to maintain top-down view
      enableZoom={true} // Allow zooming with scroll/pinch
      enablePan={true} // Enable panning with two-finger drag or right-click drag
      mouseButtons={{
        LEFT: undefined, // Disable left-click rotate
        MIDDLE: 2, // Middle mouse button for pan
        RIGHT: 2  // Right mouse button (or two-finger click) for pan
      }}
      touches={{
        ONE: undefined, // Disable one-finger rotation
        TWO: 2 // Two-finger drag for panning
      }}
      minDistance={10} // Minimum zoom distance
      maxDistance={100} // Maximum zoom distance
      minPolarAngle={0} // Keep camera looking down
      maxPolarAngle={0} // Keep camera looking down (no tilt)
    />
  );
}

// Main export component
export default function MemoryPalaceScene() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const navigateToNextNode = useCanvasStore((state) => state.navigateToNextNode);
  const navigateToPreviousNode = useCanvasStore((state) => state.navigateToPreviousNode);

  useEffect(() => {
    console.log('🏛️ 🎬 MAIN MemoryPalaceScene Component MOUNTED');
    console.log('🏛️ 📊 Available data:', {
      nexusCount: nexuses.length,
      nodeCount: Object.keys(nodes).length,
      nexusIds: nexuses.map(n => n.id),
      nodeIds: Object.keys(nodes)
    });
    return () => {
      console.log('🏛️ 🎬 MAIN MemoryPalaceScene Component UNMOUNTED');
    };
  }, [nexuses, nodes]);

  // Keyboard controls for navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        console.log('🏛️ ⌨️ Right arrow pressed - navigating to next node');
        navigateToNextNode();
      } else if (event.key === 'ArrowLeft') {
        console.log('🏛️ ⌨️ Left arrow pressed - navigating to previous node');
        navigateToPreviousNode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    console.log('🏛️ ⌨️ Keyboard controls activated (← → arrow keys)');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      console.log('🏛️ ⌨️ Keyboard controls deactivated');
    };
  }, [navigateToNextNode, navigateToPreviousNode]);

  console.log('🏛️ RENDERING MAIN MemoryPalaceScene');

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', backgroundColor: '#050A1E' }}>
      {/* Node content overlay */}
      <NodeContentOverlay />

      <Canvas
        camera={{ position: [0, 30, 0], fov: 60 }}
        shadows
        style={{ width: '100%', height: '100%' }}
        onCreated={(state) => {
          console.log('🏛️ ✅ Canvas created successfully');
          console.log('🏛️ Camera position (top-down):', state.camera.position);
          console.log('🏛️ Scene children count:', state.scene.children.length);
        }}
      >
        <CameraControls />
        <MemoryPalace3DScene />
      </Canvas>

      <NavigationOverlay />
    </div>
  );
}
