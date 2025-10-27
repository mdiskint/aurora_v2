'use client';
import React from 'react';
import SectionNavigator from './SectionNavigator';
import UnifiedNodeModal from './UnifiedNodeModal';
import { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Text3D, Html } from '@react-three/drei';
import { useCanvasStore } from '@/lib/store';
import CreateNexusModal from './CreateNexusModal';
import * as THREE from 'three';
import { useCameraAnimation } from '@/lib/useCameraAnimation';
import { io } from 'socket.io-client';

// 📸 Camera-tracking OrbitControls component
function TrackedOrbitControls() {
  const controlsRef = useRef<any>(null);
  const saveCurrentUniverse = useCanvasStore((state) => state.saveCurrentUniverse);
  const { camera } = useThree();

  useEffect(() => {
    if (!controlsRef.current) return;

    const handleCameraChange = () => {
      const position = camera.position;
      const cameraPos: [number, number, number] = [position.x, position.y, position.z];
      console.log('📸 Camera moved, saving position:', cameraPos);
      saveCurrentUniverse(cameraPos);
    };

    // Listen to the 'end' event (fired when user stops dragging)
    controlsRef.current.addEventListener('end', handleCameraChange);

    return () => {
      if (controlsRef.current) {
        controlsRef.current.removeEventListener('end', handleCameraChange);
      }
    };
  }, [camera, saveCurrentUniverse]);

  return <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} />;
}

// 📸 Camera Position Manager - Restores camera when universe loads
function CameraPositionManager() {
  const { camera } = useThree();
  const activeUniverseId = useCanvasStore((state) => state.activeUniverseId);
  const universeLibrary = useCanvasStore((state) => state.universeLibrary);
  const prevUniverseId = useRef<string | null>(null);

  useEffect(() => {
    // Only restore if universe changed (not on initial mount or same universe)
    if (activeUniverseId && activeUniverseId !== prevUniverseId.current) {
      const universeData = universeLibrary[activeUniverseId];
      if (universeData?.cameraPosition) {
        const [x, y, z] = universeData.cameraPosition;
        console.log('📸 Restoring camera position:', universeData.cameraPosition);
        camera.position.set(x, y, z);
      }
      prevUniverseId.current = activeUniverseId;
    }
  }, [activeUniverseId, universeLibrary, camera]);

  return null;
}

function RotatingConnectionNode({ node, size, baseColor, onClick, onPointerEnter, onPointerLeave, scale = 1 }: any) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Rotate the mesh every frame (slowed by 1/3)
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0067; // Rotate on Y axis
      meshRef.current.rotation.x += 0.0033; // Slight X rotation for complexity
    }
  });

  // Meta-inspiration nodes are 1.5x larger
  const finalSize = size * 0.5 * scale;

  return (
    <mesh ref={meshRef} position={node.position} onClick={onClick} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <dodecahedronGeometry args={[finalSize, 0]} />
      <meshStandardMaterial
        color="#FFD700" // Golden color for connection nodes!
        metalness={1.0}
        roughness={0.0}
        emissive="#FFD700"
        emissiveIntensity={0.5}
        envMapIntensity={3.0}
      />
    </mesh>
  );
}

function RotatingNode({ node, size, geometry, color, emissive, emissiveIntensity, roughness = 0.0, onClick, onPointerEnter, onPointerLeave }: any) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Rotate the mesh every frame (slowed by 1/3)
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0067; // Rotate on Y axis
      meshRef.current.rotation.x += 0.0033; // Slight X rotation for complexity
    }
  });

  return (
    <mesh ref={meshRef} position={node.position} onClick={onClick} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} castShadow receiveShadow>
      {geometry}
      {node.nodeType === 'ai-response' ? (
        // AI responses: Wireframe like nexus
        <meshBasicMaterial
          color={color}
          wireframe={true}
          transparent={true}
          opacity={1}
        />
      ) : (
        // All other nodes: Standard material
        <meshStandardMaterial
          color={color}
          metalness={0.8}
          roughness={roughness}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          envMapIntensity={0.5}
          flatShading={false}
        />
      )}
    </mesh>
  );
}

// NEW: Clean user reply node component
function RotatingUserReplyNode({ node, size, onClick, onPointerEnter, onPointerLeave }: any) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Debug log
  console.log('🟣 RENDERING USER REPLY NODE:', node.id, 'nodeType:', node.nodeType);

  // Rotate the mesh every frame
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.005;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={node.position}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      castShadow
      receiveShadow
    >
      <octahedronGeometry args={[size, 0]} />
      <meshStandardMaterial
        color="#8B5CF6"
        emissive="#8B5CF6"
        emissiveIntensity={1.5}
        metalness={0.0}
        roughness={1.0}
      />
    </mesh>
  );
}

function RotatingNexus({ nexus, onClick, onPointerEnter, onPointerLeave }: any) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Rotate the mesh every frame (slowed by 1/3)
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0067; // Rotate on Y axis
      meshRef.current.rotation.x += 0.0033; // Slight X rotation for complexity
    }
  });

  return (
    <mesh ref={meshRef} position={nexus.position} onClick={onClick} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <sphereGeometry args={[2, 32, 32]} />
      <meshBasicMaterial
        color="#00FF9D"
        wireframe={true}
        transparent={true}
        opacity={1}
      />
    </mesh>
  );
}

function ConnectionLines() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const [pulseStates, setPulseStates] = useState<{ [key: string]: number }>({});
  const initializedRef = useRef(false);
  
  // Initialize pulses with random positions
  useEffect(() => {
    if (!initializedRef.current) {
      const initialStates: { [key: string]: number } = {};
      Object.values(nodes).forEach((node) => {
        initialStates[node.id] = Math.random();
      });
      setPulseStates(initialStates);
      initializedRef.current = true;
    }
  }, [nodes]);
  
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    const newPulseStates: { [key: string]: number } = {};
    Object.values(nodes).forEach((node) => {
      const currentPos = pulseStates[node.id] || Math.random();
      newPulseStates[node.id] = (currentPos + 0.01) % 1;
    });
    setPulseStates(newPulseStates);
  });
  
  if (nexuses.length === 0) return null;
  
  const nodeArray = Object.values(nodes);
  
  return (
    <>
      {nodeArray.map((node, idx) => {
        // Special handling for connection nodes - draw to connected nodes
        if (node.isConnectionNode && node.connectionNodes) {
          const pulseProgress = pulseStates[node.id] || Math.random();
          const hue = (pulseProgress + idx * 0.15) % 1;
          const rainbowColor = new THREE.Color().setHSL(hue, 1, 0.6);

          // Meta-inspiration nodes: draw to ALL connected items (nexus + nodes)
          const isMetaNode = node.id.startsWith('meta-inspiration');
          if (isMetaNode) {
            return (
              <group key={node.id}>
                {node.connectionNodes.map((connectedId, connIdx) => {
                  // First item is nexus, rest are nodes
                  const connectedNexus = nexuses.find(n => n.id === connectedId);
                  const connectedNode = nodes[connectedId];
                  const connectedItem = connectedNexus || connectedNode;

                  if (!connectedItem) return null;

                  return (
                    <React.Fragment key={`meta-line-${connectedId}`}>
                      <Line
                        points={[node.position, connectedItem.position]}
                        color={rainbowColor}
                        lineWidth={2}
                        transparent
                        opacity={0.5}
                      />
                      {/* Pulse on some lines */}
                      {connIdx % 3 === 0 && (() => {
                        const pulseX = node.position[0] + (connectedItem.position[0] - node.position[0]) * pulseProgress;
                        const pulseY = node.position[1] + (connectedItem.position[1] - node.position[1]) * pulseProgress;
                        const pulseZ = node.position[2] + (connectedItem.position[2] - node.position[2]) * pulseProgress;

                        return (
                          <mesh position={[pulseX, pulseY, pulseZ]}>
                            <sphereGeometry args={[0.12, 16, 16]} />
                            <meshBasicMaterial
                              color={rainbowColor}
                              transparent
                              opacity={0.6}
                            />
                          </mesh>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </group>
            );
          }

          // Regular 2-node connection
          const [nodeAId, nodeBId] = node.connectionNodes;
          const nodeA = nodes[nodeAId];
          const nodeB = nodes[nodeBId];

          if (!nodeA || !nodeB) return null;

          return (
            <group key={node.id}>
              {/* Line from connection node to Node A */}
              <Line
                points={[node.position, nodeA.position]}
                color={rainbowColor}
                lineWidth={2}
                transparent
                opacity={0.5}
              />

              {/* Line from connection node to Node B */}
              <Line
                points={[node.position, nodeB.position]}
                color={rainbowColor}
                lineWidth={2}
                transparent
                opacity={0.5}
              />

              {/* Pulse on line to Node A */}
              {idx % 2 === 0 && (() => {
                const pulseX = node.position[0] + (nodeA.position[0] - node.position[0]) * pulseProgress;
                const pulseY = node.position[1] + (nodeA.position[1] - node.position[1]) * pulseProgress;
                const pulseZ = node.position[2] + (nodeA.position[2] - node.position[2]) * pulseProgress;

                return (
                  <mesh position={[pulseX, pulseY, pulseZ]}>
                    <sphereGeometry args={[0.12, 16, 16]} />
                    <meshBasicMaterial
                      color={rainbowColor}
                      transparent
                      opacity={0.6}
                    />
                  </mesh>
                );
              })()}

              {/* Pulse on line to Node B */}
              {idx % 2 === 1 && (() => {
                const pulseX = node.position[0] + (nodeB.position[0] - node.position[0]) * pulseProgress;
                const pulseY = node.position[1] + (nodeB.position[1] - node.position[1]) * pulseProgress;
                const pulseZ = node.position[2] + (nodeB.position[2] - node.position[2]) * pulseProgress;

                return (
                  <mesh position={[pulseX, pulseY, pulseZ]}>
                    <sphereGeometry args={[0.12, 16, 16]} />
                    <meshBasicMaterial
                      color={rainbowColor}
                      transparent
                      opacity={0.6}
                    />
                  </mesh>
                );
              })()}
            </group>
          );
        }
        
        // Normal node - draw single line to parent
        let parentPosition: [number, number, number];
        
        const parentNexus = nexuses.find(n => n.id === node.parentId);
        if (parentNexus) {
          parentPosition = parentNexus.position;
        } else if (node.parentId && nodes[node.parentId]) {
          parentPosition = nodes[node.parentId].position;
        } else {
          return null;
        }
        
        const pulseProgress = pulseStates[node.id] || Math.random();
        
        const pulseX = parentPosition[0] + (node.position[0] - parentPosition[0]) * pulseProgress;
        const pulseY = parentPosition[1] + (node.position[1] - parentPosition[1]) * pulseProgress;
        const pulseZ = parentPosition[2] + (node.position[2] - parentPosition[2]) * pulseProgress;
        
        const hue = (pulseProgress + idx * 0.15) % 1;
        const rainbowColor = new THREE.Color().setHSL(hue, 1, 0.6);
        
        return (
          <group key={node.id}>
            <Line
              points={[parentPosition, node.position]}
              color={rainbowColor}
              lineWidth={2}
              transparent
              opacity={0.5}
            />
            
            {idx % 2 === 0 && (
              <mesh position={[pulseX, pulseY, pulseZ]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshBasicMaterial 
                  color={rainbowColor}
                  transparent
                  opacity={0.6}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

function VideoThumbnail({ videoUrl, position }: { videoUrl: string; position: [number, number, number] }) {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  
  useEffect(() => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.loop = false;
    video.muted = true;
    video.playsInline = true;
    
    video.addEventListener('loadeddata', () => {
      video.currentTime = 0.1;
    });
    
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    setVideoTexture(texture);
    
    return () => {
      texture.dispose();
      video.remove();
    };
  }, [videoUrl]);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position);
    }
  });
  
  if (!videoTexture) return null;
  
  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[2.8, 2.8]} />
      <meshBasicMaterial map={videoTexture} transparent opacity={0.9} />
    </mesh>
  );
}

function NexusTitle({ title, position }: { title: string; position: [number, number, number] }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position);
    }
  });
  
  return (
    <group ref={groupRef} position={[position[0], position[1] + 3, position[2]]}>
      <Html center distanceFactor={10} zIndexRange={[0, 0]}>
        <div style={{
          color: '#FFD700',
          fontSize: '48px',
          fontWeight: 'bold',
          textShadow: '0 0 10px rgba(255, 215, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.5)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 1,
        }}>
          {title}
        </div>
      </Html>
    </group>
  );
}

function CameraLight() {
  const { camera } = useThree();
  const lightRef = useRef<THREE.SpotLight>(null);
  const fillLight1Ref = useRef<THREE.PointLight>(null);
  const fillLight2Ref = useRef<THREE.PointLight>(null);
  const spotlight1Ref = useRef<THREE.SpotLight>(null);
  const spotlight2Ref = useRef<THREE.SpotLight>(null);
  const spotlight3Ref = useRef<THREE.SpotLight>(null);
  const topLight1Ref = useRef<THREE.SpotLight>(null);
  const topLight2Ref = useRef<THREE.SpotLight>(null);
  
  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.position.copy(camera.position);
      lightRef.current.target.position.set(0, 0, 0);
      lightRef.current.target.updateMatrixWorld();
    }
    
    if (spotlight1Ref.current) {
      const offset = new THREE.Vector3(3, 2, 0);
      spotlight1Ref.current.position.copy(camera.position).add(offset);
      spotlight1Ref.current.target.position.set(0, 0, 0);
      spotlight1Ref.current.target.updateMatrixWorld();
    }
    
    if (spotlight2Ref.current) {
      const offset = new THREE.Vector3(-3, 2, 0);
      spotlight2Ref.current.position.copy(camera.position).add(offset);
      spotlight2Ref.current.target.position.set(0, 0, 0);
      spotlight2Ref.current.target.updateMatrixWorld();
    }
    
    if (spotlight3Ref.current) {
      const offset = new THREE.Vector3(0, 3, 0);
      spotlight3Ref.current.position.copy(camera.position).add(offset);
      spotlight3Ref.current.target.position.set(0, 0, 0);
      spotlight3Ref.current.target.updateMatrixWorld();
    }
    
    if (topLight1Ref.current) {
      const offset = new THREE.Vector3(5, 8, 0);
      topLight1Ref.current.position.copy(camera.position).add(offset);
      topLight1Ref.current.target.position.set(0, -5, 0);
      topLight1Ref.current.target.updateMatrixWorld();
    }
    
    if (topLight2Ref.current) {
      const offset = new THREE.Vector3(-5, 8, 0);
      topLight2Ref.current.position.copy(camera.position).add(offset);
      topLight2Ref.current.target.position.set(0, -5, 0);
      topLight2Ref.current.target.updateMatrixWorld();
    }
    
    if (fillLight1Ref.current) {
      const offset1 = new THREE.Vector3(5, 3, 0);
      fillLight1Ref.current.position.copy(camera.position).add(offset1);
    }
    
    if (fillLight2Ref.current) {
      const offset2 = new THREE.Vector3(-5, 3, 0);
      fillLight2Ref.current.position.copy(camera.position).add(offset2);
    }
  });
  
  const equatorLights = Array.from({ length: 4 }).map((_, i) => {
    const angle = (i / 4) * Math.PI * 2;
    const radius = 15;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 0;
    
    return (
      <spotLight
        key={`equator-${i}`}
        position={[x, y, z]}
        target-position={[0, 0, 0]}
        intensity={350}
        angle={Math.PI / 2.5}
        penumbra={0.2}
        distance={350}
        decay={0.3}
        color="#ffffff"
      />
    );
  });
  
  return (
    <>
      <spotLight 
        ref={lightRef} 
        intensity={250} 
        angle={Math.PI / 1.5}
        penumbra={0.3}
        distance={400}
        decay={0.4}
      />
      
      <spotLight 
        ref={spotlight1Ref} 
        intensity={200} 
        angle={Math.PI / 1.8}
        penumbra={0.3}
        distance={400}
        decay={0.4}
      />
      
      <spotLight 
        ref={topLight2Ref} 
        intensity={200} 
        angle={Math.PI / 1.8}
        penumbra={0.3}
        distance={400}
        decay={0.4}
      />
      
      <pointLight 
        ref={fillLight1Ref} 
        intensity={50}
        distance={150}
        decay={1}
      />
      <pointLight 
        ref={fillLight2Ref} 
        intensity={50}
        distance={150}
        decay={1}
      />
      
      {equatorLights}
    </>
  );
}

function Scene({ isHoldingC }: { isHoldingC: boolean }) {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const selectedId = useCanvasStore((state) => state.selectedId);
  const getNodeLevel = useCanvasStore((state) => state.getNodeLevel);
  const getNexusForNode = useCanvasStore((state) => state.getNexusForNode);
  const startConnectionMode = useCanvasStore((state) => state.startConnectionMode);
  const clearConnectionMode = useCanvasStore((state) => state.clearConnectionMode);
  const connectionModeActive = useCanvasStore((state) => state.connectionModeActive);
  const connectionModeNodeA = useCanvasStore((state) => state.connectionModeNodeA);
  const createConnection = useCanvasStore((state) => state.createConnection);
  const createMetaInspirationNode = useCanvasStore((state) => state.createMetaInspirationNode);
  const selectedNodesForConnection = useCanvasStore((state) => state.selectedNodesForConnection);
  const addNodeToConnection = useCanvasStore((state) => state.addNodeToConnection);
  const setShowContentOverlay = useCanvasStore((state) => state.setShowContentOverlay);
  const setHoveredNode = useCanvasStore((state) => state.setHoveredNode);

  useCameraAnimation();

  const selectedMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());
  const nextMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());
  const alternateMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());
  const sparkleMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial[]>>(new Map());

  // Double-click detection for nexus meshes
  const lastNexusClickRef = useRef<{ nexusId: string | null; timestamp: number }>({
    nexusId: null,
    timestamp: 0
  });

  // Hover preview timeout
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const nodeArray = Object.values(nodes);
  
  const getGlowNodes = () => {
    const glowNodes = {
      selected: null as string | null,
      next: null as string | null,
      alternate: null as string | null
    };

    if (!selectedId) return glowNodes;

    const allNodes = Object.values(nodes);
    glowNodes.selected = selectedId;

    console.log(`🎨 Glow States - Selected: ${selectedId}, Next: calculating...`);
    
    const selectedNexus = nexuses.find(n => n.id === selectedId);
    
    if (selectedNexus) {
      const l1Nodes = allNodes.filter(n => n.parentId === selectedNexus.id);
      if (l1Nodes.length >= 1) {
        glowNodes.next = l1Nodes[0].id;
      }
    } else if (nodes[selectedId]) {
      const currentNode = nodes[selectedId];
      const children = allNodes.filter(n => n.parentId === selectedId);
      const nodeNexus = getNexusForNode(selectedId);
      
      if (children.length >= 1) {
        glowNodes.next = children[0].id;
        
        const parentNexus = nexuses.find(n => n.id === currentNode.parentId);
        if (parentNexus) {
          const l1Siblings = allNodes.filter(n => n.parentId === parentNexus.id);
          const currentIndex = l1Siblings.findIndex(n => n.id === selectedId);
          if (currentIndex >= 0 && currentIndex < l1Siblings.length - 1) {
            glowNodes.alternate = l1Siblings[currentIndex + 1].id;
          }
        }
      } else {
        const siblings = allNodes.filter(n => n.parentId === currentNode.parentId);
        const currentIndex = siblings.findIndex(n => n.id === selectedId);
        
        if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
          glowNodes.next = siblings[currentIndex + 1].id;
        }
        
        if (nodeNexus) {
          let l1Ancestor = currentNode;
          while (l1Ancestor.parentId !== nodeNexus.id && nodes[l1Ancestor.parentId]) {
            l1Ancestor = nodes[l1Ancestor.parentId];
          }
          
          const l1Siblings = allNodes.filter(n => n.parentId === nodeNexus.id);
          const l1Index = l1Siblings.findIndex(n => n.id === l1Ancestor.id);
          
          if (l1Index >= 0 && l1Index < l1Siblings.length - 1) {
            glowNodes.alternate = l1Siblings[l1Index + 1].id;
          } else if (l1Siblings.length > 0) {
            glowNodes.alternate = l1Siblings[0].id;
          }
        }
      }
    }
    
    return glowNodes;
  };
  
  const glowNodes = getGlowNodes();
  
  useFrame(() => {
    // No pulsing - halos and sparkles stay static
  });
  
  return (
    <>
      <CameraLight />
      <ConnectionLines />

      {nexuses.map((nexus) => (
        <group key={nexus.id}>
          <RotatingNexus
            nexus={nexus}
            onClick={(e: any) => {
              e.stopPropagation();

              // Check for double-click on nexus (creates meta-inspiration node)
              const now = Date.now();
              const lastClick = lastNexusClickRef.current;
              const isDoubleClick =
                lastClick.nexusId === nexus.id &&
                (now - lastClick.timestamp) < 300;

              if (isDoubleClick && !isHoldingC && !connectionModeActive) {
                console.log('🌌 DOUBLE-CLICK detected on nexus:', nexus.id);
                const metaNodeId = createMetaInspirationNode(nexus.id);
                console.log('✅ Meta-node created via double-click:', metaNodeId);

                // Animate camera to new meta-node and open modal
                setTimeout(() => {
                  selectNode(metaNodeId, true);
                }, 100);

                // Reset click tracking after double-click
                lastNexusClickRef.current = { nexusId: null, timestamp: 0 };
                return;
              }

              // Update last click tracking
              lastNexusClickRef.current = { nexusId: nexus.id, timestamp: now };

              // NEW: Multi-node connection mode (hold C)
              if (isHoldingC) {
                console.log('🔗 Adding nexus to selection:', nexus.id);
                addNodeToConnection(nexus.id);
              } else if (connectionModeActive) {
                if (!connectionModeNodeA) {
                  console.log('🔗 Node A selected:', nexus.id);
                  startConnectionMode(nexus.id);
                } else if (connectionModeNodeA === nexus.id) {
                  console.log('❌ Cancelled - same node clicked');
                  clearConnectionMode();
                } else {
                  console.log('✅ Creating connection:', connectionModeNodeA, '→', nexus.id);
                  createConnection(connectionModeNodeA, nexus.id);
                  clearConnectionMode();
                }
              } else {
                selectNode(nexus.id);
              }
            }}
            onPointerEnter={(e: any) => {
              e.stopPropagation();
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
              }
              hoverTimeoutRef.current = setTimeout(() => {
                setHoveredNode(nexus.id);
              }, 200);
            }}
            onPointerLeave={(e: any) => {
              e.stopPropagation();
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
              }
              setHoveredNode(null);
            }}
          />

          {/* NEW: Golden glow for nexuses selected in multi-connection mode */}
          {selectedNodesForConnection.includes(nexus.id) && (
            <>
              <mesh position={nexus.position} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.15, 16, 32]} />
                <meshBasicMaterial
                  color="#FFD700"
                  transparent
                  opacity={0.9}
                />
              </mesh>

              {Array.from({ length: 30 }).map((_, i) => {
                const angle = (Math.random() * Math.PI * 2);
                const sparkleRadius = 2.4 + Math.random() * 0.3;
                const x = nexus.position[0] + Math.cos(angle) * sparkleRadius;
                const z = nexus.position[2] + Math.sin(angle) * sparkleRadius;
                const y = nexus.position[1] + (Math.random() - 0.5) * 0.1;
                const size = 0.04 + Math.random() * 0.06;

                return (
                  <mesh key={`sparkle-conn-${i}`} position={[x, y, z]}>
                    <sphereGeometry args={[size, 6, 6]} />
                    <meshBasicMaterial
                      color="#FFD700"
                      transparent
                      opacity={0.9}
                    />
                  </mesh>
                );
              })}
            </>
          )}

          {glowNodes.selected === nexus.id && (
            <>
              <mesh position={nexus.position} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.15, 16, 32]} />
                <meshBasicMaterial 
                  ref={(mat) => {
                    if (mat) selectedMaterialsRef.current.set(nexus.id, mat);
                  }}
                  color="#FFFF00"
                  transparent
                  opacity={0.8}
                />
              </mesh>
              
              {Array.from({ length: 30 }).map((_, i) => {
                const angle = (Math.random() * Math.PI * 2);
                const sparkleRadius = 2.4 + Math.random() * 0.3;
                const x = nexus.position[0] + Math.cos(angle) * sparkleRadius;
                const z = nexus.position[2] + Math.sin(angle) * sparkleRadius;
                const y = nexus.position[1] + (Math.random() - 0.5) * 0.1;
                const size = 0.04 + Math.random() * 0.06;
                
                return (
                  <mesh key={`sparkle-${i}`} position={[x, y, z]}>
                    <sphereGeometry args={[size, 6, 6]} />
                    <meshBasicMaterial 
                      ref={(mat) => {
                        if (mat) {
                          if (!sparkleMaterialsRef.current.has(nexus.id)) {
                            sparkleMaterialsRef.current.set(nexus.id, []);
                          }
                          sparkleMaterialsRef.current.get(nexus.id)!.push(mat);
                        }
                      }}
                      color="#FFFF00"
                      transparent
                      opacity={0.8}
                    />
                  </mesh>
                );
              })}
            </>
          )}

          {glowNodes.next === nexus.id && (
            <>
              <mesh position={nexus.position} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.15, 16, 32]} />
                <meshBasicMaterial 
                  ref={(mat) => {
                    if (mat) nextMaterialsRef.current.set(nexus.id, mat);
                  }}
                  color="#00FFFF"
                  transparent
                  opacity={0.9}
                />
              </mesh>
              
              {Array.from({ length: 30 }).map((_, i) => {
                const angle = (Math.random() * Math.PI * 2);
                const sparkleRadius = 2.4 + Math.random() * 0.3;
                const x = nexus.position[0] + Math.cos(angle) * sparkleRadius;
                const z = nexus.position[2] + Math.sin(angle) * sparkleRadius;
                const y = nexus.position[1] + (Math.random() - 0.5) * 0.1;
                const size = 0.04 + Math.random() * 0.06;
                
                return (
                  <mesh key={`sparkle-next-${i}`} position={[x, y, z]}>
                    <sphereGeometry args={[size, 6, 6]} />
                    <meshBasicMaterial 
                      ref={(mat) => {
                        if (mat) {
                          if (!sparkleMaterialsRef.current.has(nexus.id)) {
                            sparkleMaterialsRef.current.set(nexus.id, []);
                          }
                          sparkleMaterialsRef.current.get(nexus.id)!.push(mat);
                        }
                      }}
                      color="#00FFFF"
                      transparent
                      opacity={0.9}
                    />
                  </mesh>
                );
              })}
            </>
          )}
          
          {glowNodes.alternate === nexus.id && (
            <>
              <mesh position={nexus.position} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.15, 16, 32]} />
                <meshBasicMaterial 
                  ref={(mat) => {
                    if (mat) alternateMaterialsRef.current.set(nexus.id, mat);
                  }}
                  color="#00FFFF"
                  transparent
                  opacity={0.8}
                />
              </mesh>
              
              {Array.from({ length: 30 }).map((_, i) => {
                const angle = (Math.random() * Math.PI * 2);
                const sparkleRadius = 2.4 + Math.random() * 0.3;
                const x = nexus.position[0] + Math.cos(angle) * sparkleRadius;
                const z = nexus.position[2] + Math.sin(angle) * sparkleRadius;
                const y = nexus.position[1] + (Math.random() - 0.5) * 0.1;
                const size = 0.04 + Math.random() * 0.06;
                
                return (
                  <mesh key={`sparkle-alt-${i}`} position={[x, y, z]}>
                    <sphereGeometry args={[size, 6, 6]} />
                    <meshBasicMaterial 
                      ref={(mat) => {
                        if (mat) {
                          if (!sparkleMaterialsRef.current.has(nexus.id)) {
                            sparkleMaterialsRef.current.set(nexus.id, []);
                          }
                          sparkleMaterialsRef.current.get(nexus.id)!.push(mat);
                        }
                      }}
                      color="#00FFFF"
                      transparent
                      opacity={0.8}
                    />
                  </mesh>
                );
              })}
            </>
          )}
          
          {nexus.videoUrl && (
            <VideoThumbnail videoUrl={nexus.videoUrl} position={nexus.position} />
          )}
          <NexusTitle title={nexus.title} position={nexus.position} />
        </group>
      ))}
      
      {nodeArray.map((node) => {
        const level = getNodeLevel(node.id);
        const size = level === 1 ? 0.75 : 0.5;

        const baseColor = "#A855F7"; // Bright vibrant purple

        let haloColor = null;
        let haloType = null;

        // NEW: Golden glow for nodes selected in multi-connection mode
        if (selectedNodesForConnection.includes(node.id)) {
          haloColor = "#FFD700"; // Gold color
          haloType = 'connection-selected';
        } else if (glowNodes.selected === node.id) {
          haloColor = "#FFFF00";
          haloType = 'selected';
        } else if (glowNodes.next === node.id) {
          haloColor = "#00FFFF";
          haloType = 'next';
        } else if (glowNodes.alternate === node.id) {
          haloColor = "#00FFFF";
          haloType = 'alternate';
        }
        
       // Geometry selection based on nodeType (user-reply handled separately)
let Geometry;
let nodeColor = baseColor;

if (node.nodeType === 'synthesis') {
  // Synthesis nodes: Gem-like icosahedron (cyan)
  Geometry = <icosahedronGeometry args={[size * 1.2, 0]} />;
  nodeColor = "#00FFFF";
} else if (node.nodeType === 'ai-response') {
  // AI responses: Deep burnt orange sphere (wireframe)
  Geometry = <sphereGeometry args={[size, 32, 32]} />;
  nodeColor = "#D2691E"; // Deep burnt orange
} else if (node.nodeType === 'inspiration' || node.nodeType === 'socratic-question') {
  // Inspiration/Socratic questions: Dodecahedron star (gold)
  Geometry = <dodecahedronGeometry args={[size * 1.3, 0]} />;
  nodeColor = "#FFD700";
}
// Note: user-reply and socratic-answer are rendered by RotatingUserReplyNode component

        // Debug: Log what we're about to render
        console.log('🎨 RENDERING NODE:', node.id, 'type:', node.nodeType, 'isConnection:', node.isConnectionNode);

       return (
  <group key={node.id}>
    {node.isConnectionNode ? (
      // Render rotating golden star for connection nodes (1.5x larger for meta-inspiration nodes)
      <RotatingConnectionNode
        node={node}
        size={size}
        baseColor={baseColor}
        scale={node.id.startsWith('meta-inspiration') ? 1.5 : 1}
        onClick={(e: any) => {
          e.stopPropagation();

          // NEW: Multi-node connection mode (hold C)
          if (isHoldingC) {
            console.log('🔗 Adding connection node to selection:', node.id);
            addNodeToConnection(node.id);
          } else if (connectionModeActive) {
            if (!connectionModeNodeA) {
              console.log('🔗 Node A selected:', node.id);
              startConnectionMode(node.id);
            } else if (connectionModeNodeA === node.id) {
              console.log('❌ Cancelled - same node clicked');
              clearConnectionMode();
            } else {
              console.log('✅ Creating connection:', connectionModeNodeA, '→', node.id);
              createConnection(connectionModeNodeA, node.id);
              clearConnectionMode();
            }
          } else {
            // Check if this is a connection node with content (Socratic question)
            if (node.isConnectionNode && node.content?.trim()) {
              console.log('💭 Opening Socratic exploration for connection node:', node.id);
              selectNode(node.id);
              setShowContentOverlay(true);
            } else {
              selectNode(node.id);
              setShowContentOverlay(true);
            }
          }
        }}
        onPointerEnter={(e: any) => {
          e.stopPropagation();
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          hoverTimeoutRef.current = setTimeout(() => {
            setHoveredNode(node.id);
          }, 200);
        }}
        onPointerLeave={(e: any) => {
          e.stopPropagation();
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          setHoveredNode(null);
        }}
      />
    ) : node.nodeType === 'user-reply' || node.nodeType === 'socratic-answer' ? (
      // User reply nodes: Clean purple diamonds
      <RotatingUserReplyNode
        node={node}
        size={size}
        onClick={(e: any) => {
          e.stopPropagation();

          // NEW: Multi-node connection mode (hold C)
          if (isHoldingC) {
            console.log('🔗 Adding node to selection:', node.id);
            addNodeToConnection(node.id);
          } else if (connectionModeActive) {
            if (!connectionModeNodeA) {
              console.log('🔗 Node A selected:', node.id);
              startConnectionMode(node.id);
            } else if (connectionModeNodeA === node.id) {
              console.log('❌ Cancelled - same node clicked');
              clearConnectionMode();
            } else {
              console.log('✅ Creating connection:', connectionModeNodeA, '→', node.id);
              createConnection(connectionModeNodeA, node.id);
              clearConnectionMode();
            }
          } else {
            selectNode(node.id);
            setShowContentOverlay(true);
          }
        }}
        onPointerEnter={(e: any) => {
          e.stopPropagation();
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          hoverTimeoutRef.current = setTimeout(() => {
            setHoveredNode(node.id);
          }, 200);
        }}
        onPointerLeave={(e: any) => {
          e.stopPropagation();
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          setHoveredNode(null);
        }}
      />
    ) : (
      // All other nodes: AI responses, synthesis, inspiration
      <RotatingNode
        node={node}
        size={size}
        geometry={Geometry}
        color={nodeColor}
        emissive={nodeColor}
        emissiveIntensity={node.nodeType === 'synthesis' ? 0.8 : 0.3}
        roughness={0.0}
        onClick={(e: any) => {
          e.stopPropagation();

          // NEW: Multi-node connection mode (hold C)
          if (isHoldingC) {
            console.log('🔗 Adding node to selection:', node.id);
            addNodeToConnection(node.id);
          } else if (connectionModeActive) {
            if (!connectionModeNodeA) {
              console.log('🔗 Node A selected:', node.id);
              startConnectionMode(node.id);
            } else if (connectionModeNodeA === node.id) {
              console.log('❌ Cancelled - same node clicked');
              clearConnectionMode();
            } else {
              console.log('✅ Creating connection:', connectionModeNodeA, '→', node.id);
              createConnection(connectionModeNodeA, node.id);
              clearConnectionMode();
            }
          } else {
            selectNode(node.id);
            setShowContentOverlay(true);
          }
        }}
        onPointerEnter={(e: any) => {
          e.stopPropagation();
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          hoverTimeoutRef.current = setTimeout(() => {
            setHoveredNode(node.id);
          }, 200);
        }}
        onPointerLeave={(e: any) => {
          e.stopPropagation();
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          setHoveredNode(null);
        }}
      />
    )}
                {haloColor && (
  <>
  <mesh position={node.position} rotation={[Math.PI / 2, 0, 0]}>
  <torusGeometry args={[size * 1.5, 0.08, 16, 32]} />
  <meshBasicMaterial
    ref={(mat) => {
      if (mat && haloType) {
        if (haloType === 'selected') {
          selectedMaterialsRef.current.set(node.id, mat);
        } else if (haloType === 'next') {
          nextMaterialsRef.current.set(node.id, mat);
        } else if (haloType === 'alternate') {
          alternateMaterialsRef.current.set(node.id, mat);
        }
      }
    }}
    color={haloColor}
    transparent
    opacity={haloType === 'selected' ? 0.8 : 0.9}
  />
</mesh>
                {Array.from({ length: 20 }).map((_, i) => {
                  const angle = (Math.random() * Math.PI * 2);
                  const sparkleRadius = size * 1.4 + Math.random() * 0.2;
                  const x = node.position[0] + Math.cos(angle) * sparkleRadius;
                  const z = node.position[2] + Math.sin(angle) * sparkleRadius;
                  const y = node.position[1] + (Math.random() - 0.5) * 0.05;
                  const sparkSize = 0.02 + Math.random() * 0.04;
                  
                  return (
                    <mesh key={`sparkle-node-${i}`} position={[x, y, z]}>
                      <sphereGeometry args={[sparkSize, 6, 6]} />
                      <meshBasicMaterial 
                        ref={(mat) => {
                          if (mat) {
                            if (!sparkleMaterialsRef.current.has(node.id)) {
                              sparkleMaterialsRef.current.set(node.id, []);
                            }
                            sparkleMaterialsRef.current.get(node.id)!.push(mat);
                          }
                        }}
                        color={haloColor}
                        transparent
                        opacity={haloType === 'selected' ? 0.8 : 0.9}
                      />
                    </mesh>
                  );
                })}
              </>
            )}
          </group>
        );
      })}
      
      <ambientLight intensity={0.02} />
      <pointLight position={[10, 10, 10]} intensity={0.1} />
    </>
  );
}

function ConnectionModeHint({ isHoldingC, selectedCount }: { isHoldingC: boolean; selectedCount: number }) {
  if (!isHoldingC && selectedCount === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(255, 215, 0, 0.95)',
      color: '#000',
      padding: '20px 40px',
      borderRadius: '12px',
      fontSize: '24px',
      fontWeight: 'bold',
      zIndex: 2000,
      boxShadow: '0 0 30px rgba(255, 215, 0, 0.8)',
      border: '3px solid #FFD700',
      textAlign: 'center',
    }}>
      {isHoldingC && selectedCount === 0 && (
        <div>🔗 Hold C and click nodes to connect...</div>
      )}
      {isHoldingC && selectedCount > 0 && (
        <div>
          <div>🔗 {selectedCount} node{selectedCount > 1 ? 's' : ''} selected</div>
          <div style={{ fontSize: '16px', marginTop: '8px', opacity: 0.8 }}>
            {selectedCount < 2 ? 'Select at least 2 nodes' : 'Release C to connect'}
          </div>
        </div>
      )}
    </div>
  );
}

function Controls() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const nexuses = useCanvasStore((state) => state.nexuses);

  return (
    <>
      {/* Create Nexus Button (top-left) */}
      <div style={{ position: 'absolute', top: 19, left: 40, zIndex: 1000 }}>
        {nexuses.length < 3 && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#00FFD4',
              color: '#050A1E',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Create Nexus
          </button>
        )}
      </div>

      <CreateNexusModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}

export default function CanvasScene() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedId = useCanvasStore((state) => state.selectedId);
  const addNodeFromWebSocket = useCanvasStore((state) => state.addNodeFromWebSocket);
  const addNexusFromWebSocket = useCanvasStore((state) => state.addNexusFromWebSocket);
  const selectedNodesForConnection = useCanvasStore((state) => state.selectedNodesForConnection);
  const clearConnectionMode = useCanvasStore((state) => state.clearConnectionMode);
  const createMultiConnection = useCanvasStore((state) => state.createMultiConnection);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const deleteConversation = useCanvasStore((state) => state.deleteConversation);

  const [isHoldingC, setIsHoldingC] = useState(false);

  // Show section navigator for any universe with nexuses
  const hasUniverse = nexuses.length > 0;

  // Keyboard handling moved to parent component
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'c' || e.key === 'C') && !isHoldingC) {
        console.log('🔗 Multi-connection mode ACTIVE - Click nodes to select');
        setIsHoldingC(true);
      } else if (e.key === 'Escape') {
        console.log('❌ Cancelled connection mode');
        setIsHoldingC(false);
        clearConnectionMode();
      } else if (e.key === 'Delete' && selectedId) {
        // Handle deletion of selected node or nexus (Delete key only, not 'x')
        console.log('🗑️ Delete key pressed for:', selectedId);

        // Check if selected is a nexus
        const selectedNexus = nexuses.find(n => n.id === selectedId);
        if (selectedNexus) {
          // Count descendant nodes for confirmation
          const countDescendants = (parentId: string): number => {
            return Object.values(nodes).filter(n => n.parentId === parentId).reduce((count, node) => {
              return count + 1 + countDescendants(node.id);
            }, 0);
          };
          const nodeCount = countDescendants(selectedId);

          const confirmed = window.confirm(
            `Delete this conversation and all ${nodeCount} nodes?\n\nThis action cannot be undone.`
          );

          if (confirmed) {
            console.log('✅ User confirmed nexus deletion');
            deleteConversation(selectedId);
          } else {
            console.log('❌ User cancelled nexus deletion');
          }
        } else {
          // It's a regular node - delete without confirmation
          const selectedNode = nodes[selectedId];
          if (selectedNode) {
            console.log('🗑️ Deleting node:', selectedId);
            deleteNode(selectedId);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        console.log('🔗 C key released');
        setIsHoldingC(false);

        // Create connection if 2+ nodes selected
        if (selectedNodesForConnection.length >= 2) {
          console.log('✨ Creating multi-connection with', selectedNodesForConnection.length, 'nodes');
          createMultiConnection(selectedNodesForConnection);
        } else if (selectedNodesForConnection.length === 1) {
          console.log('⚠️ Only 1 node selected - need at least 2');
          clearConnectionMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isHoldingC, selectedNodesForConnection, createMultiConnection, clearConnectionMode, selectedId, nexuses, nodes, deleteNode, deleteConversation]);

  useEffect(() => {
    console.log('🔵 useEffect running, attempting connection...');
    const socket = io('http://localhost:3001');

    socket.on('connect', () => {
      console.log('🟢 Connected to WebSocket server');
      socket.emit('join_portal', 'default-portal');
      console.log('📍 Joined default-portal');
    });

    socket.on('nodeCreated', (data) => {
      console.log('📥 Received node from WebSocket:', data);
      addNodeFromWebSocket(data);
    });

    socket.on('nexusCreated', (data) => {
      console.log('📥 Received nexus from WebSocket:', data);
      addNexusFromWebSocket(data);
    });

    (window as any).socket = socket;

    return () => {
      socket.disconnect();
    };
  }, [addNodeFromWebSocket, addNexusFromWebSocket]);

  // ⏰ AUTOSAVE INTERVAL - Backup save every 30 seconds
  useEffect(() => {
    console.log('⏰ Starting autosave interval (every 30 seconds)...');

    const interval = setInterval(() => {
      const state = useCanvasStore.getState();
      if (state.nexuses.length > 0 || Object.keys(state.nodes).length > 0) {
        console.log('⏰ AUTOSAVE triggered');
        state.saveToLocalStorage();
      }
    }, 30000); // 30 seconds

    return () => {
      console.log('⏰ Clearing autosave interval');
      clearInterval(interval);
    };
  }, []);

  // 💾 SAVE ON PAGE UNLOAD - Capture universe before user leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('💾 Page unloading - saving current universe...');
      const state = useCanvasStore.getState();
      state.saveCurrentUniverse();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#050A1E' }}>
      <Controls />
      <UnifiedNodeModal />
      <ConnectionModeHint isHoldingC={isHoldingC} selectedCount={selectedNodesForConnection.length} />
      {hasUniverse && <SectionNavigator />}
      <Canvas camera={{ position: [10, 8, 15], fov: 60 }}>
        <Scene isHoldingC={isHoldingC} />
        <TrackedOrbitControls />
        <CameraPositionManager />
      </Canvas>
    </div>
  );
}