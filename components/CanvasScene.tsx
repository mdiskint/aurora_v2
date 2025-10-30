'use client';
import React from 'react';
import SectionNavigator from './SectionNavigator';
import UnifiedNodeModal from './UnifiedNodeModal';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Text3D, Html, Points, PointMaterial } from '@react-three/drei';
import { useCanvasStore } from '@/lib/store';
import CreateNexusModal from './CreateNexusModal';
import * as THREE from 'three';
import { useCameraAnimation } from '@/lib/useCameraAnimation';
import { io } from 'socket.io-client';

// 📸 Camera-tracking OrbitControls component
function TrackedOrbitControls({ enabled = true }: { enabled?: boolean }) {
  const controlsRef = useRef<any>(null);
  const saveCurrentUniverse = useCanvasStore ((state) => state.saveCurrentUniverse);
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

  return <OrbitControls ref={controlsRef} enabled={enabled} enableDamping dampingFactor={0.05} />;
}

// 📸 Camera Position Manager - Resets camera when universe switches
function CameraPositionManager() {
  const { camera } = useThree();
  const activeUniverseId = useCanvasStore((state) => state.activeUniverseId);
  const universeLibrary = useCanvasStore((state) => state.universeLibrary);
  const prevUniverseId = useRef<string | null>(null);

  useEffect(() => {
    // Only act if universe changed (not on initial mount or same universe)
    if (prevUniverseId.current !== null && activeUniverseId !== prevUniverseId.current) {
      console.log('📷 ==========================================');
      console.log('📷 UNIVERSE CHANGED - Resetting camera');
      console.log('📷   From:', prevUniverseId.current);
      console.log('📷   To:', activeUniverseId);
      console.log('📷 ==========================================');

      // Get current position
      const startX = camera.position.x;
      const startY = camera.position.y;
      const startZ = camera.position.z;

      // Default viewing position (same as Canvas default)
      const targetX = 10;
      const targetY = 8;
      const targetZ = 15;

      // Smooth animation
      const duration = 800; // 0.8 seconds
      const startTime = Date.now();

      const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        // Interpolate position
        camera.position.x = startX + (targetX - startX) * eased;
        camera.position.y = startY + (targetY - startY) * eased;
        camera.position.z = startZ + (targetZ - startZ) * eased;

        // Reset look target to origin
        camera.lookAt(0, 0, 0);

        if (progress < 1) {
          requestAnimationFrame(animateCamera);
        } else {
          console.log('✅ Camera reset complete at:', [targetX, targetY, targetZ]);
        }
      };

      animateCamera();
    }

    prevUniverseId.current = activeUniverseId;
  }, [activeUniverseId, universeLibrary, camera]);

  return null;
}

function NodeSparkles({ position, opacity = 1 }: { position: [number, number, number]; opacity?: number }) {
  const pointsRef = useRef<any>();

  // Create sparkle positions in a ring around the node
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const radius = 1.3; // Just outside the node
      temp.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        (Math.random() - 0.5) * 0.3
      );
    }
    return new Float32Array(temp);
  }, []);

  // Rotate sparkles continuously
  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.z += 0.01; // Slow rotation
    }
  });

  return (
    <group position={position}>
      <Points ref={pointsRef} positions={particles} stride={3}>
        <PointMaterial
          transparent
          color="#FFD700"
          size={0.08}
          sizeAttenuation={true}
          opacity={0.9 * opacity}
        />
      </Points>
    </group>
  );
}

// 💥 PARTICLE BURST EFFECT - Triggered on break-off
function ParticleBurst({ position, onComplete }: { position: [number, number, number]; onComplete: () => void }) {
  const particles = useMemo(() => {
    const count = 30;
    const temp = [];
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const velocity = 0.15 + Math.random() * 0.1;

      temp.push({
        position: [...position] as [number, number, number],
        velocity: [
          Math.sin(phi) * Math.cos(theta) * velocity,
          Math.sin(phi) * Math.sin(theta) * velocity,
          Math.cos(phi) * velocity,
        ] as [number, number, number],
        life: 1.0,
      });
    }
    return temp;
  }, [position]);

  const particleRefs = useRef(particles);
  const [isComplete, setIsComplete] = useState(false);

  useFrame(() => {
    let allDead = true;
    particleRefs.current.forEach((p) => {
      p.position[0] += p.velocity[0];
      p.position[1] += p.velocity[1];
      p.position[2] += p.velocity[2];
      p.life -= 0.02;
      if (p.life > 0) allDead = false;
    });

    if (allDead && !isComplete) {
      setIsComplete(true);
      onComplete();
    }
  });

  return (
    <>
      {particleRefs.current.map((p, i) => {
        if (p.life <= 0) return null;
        return (
          <mesh key={i} position={p.position}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial
              color="#00FFD4"
              transparent
              opacity={p.life * 0.8}
            />
          </mesh>
        );
      })}
    </>
  );
}

function RotatingConnectionNode({ node, size, baseColor, onClick, onPointerDown, onPointerEnter, onPointerLeave, scale = 1, opacity = 1 }: any) {
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
    <mesh ref={meshRef} position={node.position} onClick={onClick} onPointerDown={onPointerDown} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <dodecahedronGeometry args={[finalSize, 0]} />
      <meshStandardMaterial
        color="#FFD700" // Golden color for connection nodes!
        metalness={1.0}
        roughness={0.0}
        emissive="#FFD700"
        emissiveIntensity={0.5 * opacity} // Scale emissive with opacity
        envMapIntensity={3.0}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function RotatingNode({ node, size, geometry, color, emissive, emissiveIntensity, roughness = 0.0, onClick, onPointerDown, onPointerEnter, onPointerLeave, opacity = 1 }: any) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Rotate the mesh every frame (slowed by 1/3)
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0067; // Rotate on Y axis
      meshRef.current.rotation.x += 0.0033; // Slight X rotation for complexity
    }
  });

  return (
    <mesh ref={meshRef} position={node.position} onClick={onClick} onPointerDown={onPointerDown} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} castShadow receiveShadow>
      {geometry}
      {node.nodeType === 'ai-response' ? (
        // AI responses: Wireframe like nexus
        <meshBasicMaterial
          color={color}
          wireframe={true}
          transparent={true}
          opacity={opacity}
        />
      ) : (
        // All other nodes: Standard material
        <meshStandardMaterial
          color={color}
          metalness={0.8}
          roughness={roughness}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity * opacity} // Scale emissive with opacity
          envMapIntensity={0.5}
          flatShading={false}
          transparent={opacity < 1}
          opacity={opacity}
        />
      )}
    </mesh>
  );
}

// NEW: Clean user reply node component
function RotatingUserReplyNode({ node, size, onClick, onPointerDown, onPointerEnter, onPointerLeave, opacity = 1 }: any) {
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
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      castShadow
      receiveShadow
    >
      <octahedronGeometry args={[size, 0]} />
      <meshStandardMaterial
        color="#8B5CF6"
        emissive="#8B5CF6"
        emissiveIntensity={1.5 * opacity} // Scale emissive with opacity
        metalness={0.0}
        roughness={1.0}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function RotatingNexus({ nexus, onClick, onPointerEnter, onPointerLeave, opacity = 1 }: any) {
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
        opacity={opacity}
      />
    </mesh>
  );
}

function ConnectionLines({ fadingUniverse }: { fadingUniverse: { excludeNodeId: string; progress: number } | null }) {
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

  // 🌫️ Calculate line opacity based on fade state
  const calculateLineOpacity = (nodeId: string): number => {
    if (fadingUniverse) {
      // If this IS the breaking node, hide its connection line immediately
      if (nodeId === fadingUniverse.excludeNodeId) {
        return 0;
      }
      // All other lines fade out
      return (1 - fadingUniverse.progress) * 0.5; // Base opacity is 0.5
    }
    return 0.5; // Default opacity
  };
  
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
                        opacity={calculateLineOpacity(node.id)}
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
                              opacity={calculateLineOpacity(node.id) * 1.2}
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
                opacity={calculateLineOpacity(node.id)}
              />

              {/* Line from connection node to Node B */}
              <Line
                points={[node.position, nodeB.position]}
                color={rainbowColor}
                lineWidth={2}
                transparent
                opacity={calculateLineOpacity(node.id)}
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
                      opacity={calculateLineOpacity(node.id) * 1.2}
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
                      opacity={calculateLineOpacity(node.id) * 1.2}
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
              opacity={calculateLineOpacity(node.id)}
            />

            {idx % 2 === 0 && (
              <mesh position={[pulseX, pulseY, pulseZ]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshBasicMaterial
                  color={rainbowColor}
                  transparent
                  opacity={calculateLineOpacity(node.id) * 1.2}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

function VideoThumbnail({ videoUrl, position, opacity = 1 }: { videoUrl: string; position: [number, number, number]; opacity?: number }) {
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
      <meshBasicMaterial map={videoTexture} transparent opacity={0.9 * opacity} />
    </mesh>
  );
}

function NexusTitle({ title, position, opacity = 1 }: { title: string; position: [number, number, number]; opacity?: number }) {
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
          opacity: opacity,
          transition: 'opacity 0.1s linear',
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
  const createNexus = useCanvasStore((state) => state.createNexus);
  const addNode = useCanvasStore((state) => state.addNode);

  // 🚀 DRAG-TO-BREAK STATE
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<[number, number, number] | null>(null);
  const [dragCurrentPosition, setDragCurrentPosition] = useState<[number, number, number] | null>(null);
  const [dragDistance, setDragDistance] = useState(0);
  const [isBreakingOff, setIsBreakingOff] = useState(false);
  const [particleBursts, setParticleBursts] = useState<Array<{ id: string; position: [number, number, number] }>>([]);
  const [transformingNode, setTransformingNode] = useState<{ nodeId: string; startTime: number } | null>(null);
  const [fadingUniverse, setFadingUniverse] = useState<{ excludeNodeId: string; progress: number } | null>(null);

  const BREAK_THRESHOLD = 5; // Units before break-off (changed from 10)
  const GLOW_START = 3; // Distance when glow starts (changed from 5)

  const { camera, gl } = useThree();

  useCameraAnimation();

  // 🎬 ANIMATION STATE for break-off transformation
  const transformingNodeRef = useRef<THREE.Mesh | null>(null);
  const allNodeRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const allNexusRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  // 🎯 DRAG HANDLERS
  const handleNodePointerDown = useCallback((e: any, node: any) => {
    console.log('🎯 POINTER DOWN EVENT FIRED on node:', node.id);

    if (isHoldingC || connectionModeActive || isBreakingOff) {
      console.log('❌ Drag blocked - isHoldingC:', isHoldingC, 'connectionMode:', connectionModeActive, 'isBreaking:', isBreakingOff);
      return;
    }

    // Prevent OrbitControls from interfering
    e.stopPropagation();

    setIsDragging(true);
    setDraggedNode(node.id);
    setDragStartPosition(node.position);
    setDragCurrentPosition(node.position);
    setDragDistance(0);
    console.log('✅ Drag started on node:', node.id);
  }, [isHoldingC, connectionModeActive, isBreakingOff, gl]);

  // 🎬 ANIMATION HELPERS for break-off sequence

  // Easing functions
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // 1. Slide node to center (0,0,0) - 1 second, ease-out cubic
  const slideNodeToCenter = useCallback((nodeId: string, startPosition: [number, number, number]): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const duration = 1000; // 1 second

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);

        const newX = startPosition[0] + (0 - startPosition[0]) * easedProgress;
        const newY = startPosition[1] + (0 - startPosition[1]) * easedProgress;
        const newZ = startPosition[2] + (0 - startPosition[2]) * easedProgress;

        const currentPos: [number, number, number] = [newX, newY, newZ];
        setDragCurrentPosition(currentPos);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log('✅ Node reached center (0,0,0)');
          resolve();
        }
      };

      animate();
    });
  }, []);

  // 2. Fade out current universe - 1 second, linear fade
  const fadeOutCurrentUniverse = useCallback((excludeNodeId: string): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const duration = 1000; // 1 second

      console.log('  Fading all nodes/nexuses except breaking node:', excludeNodeId);

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Update state with fade progress
        setFadingUniverse({ excludeNodeId, progress });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log('  Fade complete');
          resolve();
        }
      };

      animate();
    });
  }, []);

  // 3. Transform node to emerald nexus at center - 1 second, ease in-out
  const transformToNexus = useCallback((nodeId: string): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const duration = 1000; // 1 second
      const startScale = 1;
      const endScale = 2; // 2x larger
      const startColor = new THREE.Color("#8B5CF6"); // Purple
      const endColor = new THREE.Color("#00FF9D"); // Emerald green

      console.log('  Transforming: grow + color shift to emerald');

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        // Scale animation
        const scale = startScale + (endScale - startScale) * easedProgress;

        // Color animation
        const color = new THREE.Color().lerpColors(startColor, endColor, easedProgress);

        // Apply to transforming node if ref exists
        if (transformingNodeRef.current) {
          transformingNodeRef.current.scale.set(scale, scale, scale);
          const material = transformingNodeRef.current.material as THREE.MeshStandardMaterial;
          if (material) {
            material.color.copy(color);
            material.emissive.copy(color);
            // Gentle continuous pulse
            material.emissiveIntensity = Math.sin(Date.now() / 400) * 0.15 + 0.25;
          }
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log('  Transform complete - now pulsing while waiting for AI');

          // KEEP PULSING after transform completes (while waiting for AI)
          const continuePulse = () => {
            if (!isBreakingOff) return; // Stop when break-off completes

            if (transformingNodeRef.current) {
              const material = transformingNodeRef.current.material as THREE.MeshStandardMaterial;
              if (material) {
                material.emissive = endColor;
                material.emissiveIntensity = Math.sin(Date.now() / 400) * 0.15 + 0.25;
              }
            }

            requestAnimationFrame(continuePulse);
          };
          continuePulse();

          resolve();
        }
      };

      animate();
    });
  }, [isBreakingOff]);

  // 4. Fibonacci sphere distribution for child nodes
  const getFibonacciSpherePosition = useCallback((index: number, total: number, radius: number): [number, number, number] => {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
    const y = 1 - (index / (total - 1)) * 2; // -1 to 1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;

    const x = Math.cos(theta) * radiusAtY * radius;
    const z = Math.sin(theta) * radiusAtY * radius;
    const yPos = y * radius;

    return [x, yPos, z];
  }, []);

  // 5. Animate individual node birth - 0.6 seconds per node
  const animateNodeBirth = useCallback((startPos: [number, number, number], endPos: [number, number, number], delay: number): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const startTime = Date.now();
        const duration = 600; // 0.6 seconds

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeOutCubic(progress);

          // This would update node position during birth animation
          // Since we're creating nodes via addNode, they'll spawn with stagger

          if (progress >= 1) {
            resolve();
          } else {
            requestAnimationFrame(animate);
          }
        };

        animate();
      }, delay);
    });
  }, []);

  // 6. Spawn child nodes with Fibonacci distribution - 0.8 seconds total
  const spawnChildNodes = useCallback(async (nexusId: string, newNodes: any[]): Promise<void> => {
    console.log('🌱 Spawning', newNodes.length, 'child nodes from center...');

    const staggerDelay = 800 / newNodes.length; // Distribute 0.8s across all nodes

    const birthPromises = newNodes.map((nodeData, index) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log(`🌱 Spawning node ${index + 1}/${newNodes.length}`);
          addNode(nodeData.content, nexusId, undefined, 'ai-response');
          resolve();
        }, index * staggerDelay);
      });
    });

    await Promise.all(birthPromises);
    console.log('✅ All child nodes spawned');
  }, [addNode]);

  // 🔥 BREAK-OFF HANDLER - Called when threshold is crossed during drag
  const handleBreakOff = useCallback(async () => {
    if (!draggedNode || !dragCurrentPosition || isBreakingOff) return;

    console.log('═══════════════════════════════════');
    console.log('🌌 BREAK-OFF SEQUENCE STARTING');
    console.log('Node:', draggedNode);
    console.log('═══════════════════════════════════');

    // CRITICAL: Save original universe BEFORE any changes
    console.log('💾 Step 0: Saving original universe before break-off...');
    const originalUniverseId = useCanvasStore.getState().activeUniverseId;
    useCanvasStore.getState().saveCurrentUniverse();
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('✅ Original universe saved:', originalUniverseId);

    // Prevent multiple break-offs
    setIsBreakingOff(true);
    setIsDragging(false);

    const breakingNodeId = draggedNode;
    const breakPosition = dragCurrentPosition;
    const startPosition = dragStartPosition!;

    try {
      // 1. SNAP EFFECT (instant)
      console.log('✓ Step 1: Snap effect');
      setParticleBursts((prev) => [...prev, { id: breakingNodeId, position: breakPosition }]);
      setTransformingNode({ nodeId: breakingNodeId, startTime: Date.now() });
      setDragDistance(0);

      // 2. START AI GENERATION IN BACKGROUND (don't wait!)
      console.log('→ Step 2: Starting AI generation (background process)');
      const nodeData = nodes[breakingNodeId];
      const generationPromise = fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: nodeData.content }],
          mode: 'break-off',
          nodeContent: nodeData.content,
        }),
      }).then(res => res.json());
      // NOTE: We're NOT awaiting this yet! It runs in background.

      // 3. IMMEDIATELY FADE + SLIDE (don't wait for AI!)
      console.log('→ Step 3: Fading universe + sliding to center (1 second)');
      await Promise.all([
        fadeOutCurrentUniverse(breakingNodeId),
        slideNodeToCenter(breakingNodeId, startPosition)
      ]);
      console.log('✓ Step 3 complete: Original universe GONE, node at center');
      // DON'T clear fade state yet - keep nodes invisible until new universe replaces them

      // 4. TRANSFORM TO NEXUS (1 second) - still don't wait for AI
      console.log('→ Step 4: Transforming to nexus (1 second)');
      await transformToNexus(breakingNodeId);
      console.log('✓ Step 4 complete: Now a nexus at center');

      // 5. NOW wait for AI if it's not done yet
      console.log('→ Step 5: Checking if AI is ready...');
      const data = await generationPromise;
      console.log('✓ Step 5 complete: AI finished -', data.newUniverse?.nexusTitle || 'unnamed');

      if (data.newUniverse) {
        const { nexusTitle, nexusContent, nodes: newNodes } = data.newUniverse;

        // Create new universe (clears old one, creates new nexus)
        console.log('🌌 Creating new universe:', nexusTitle);

        // Clear fade state NOW - right before creating new universe
        setFadingUniverse(null);

        createNexus(nexusTitle, nexusContent);

        // Get the newly created nexus ID
        const newState = useCanvasStore.getState();
        const newNexusId = newState.nexuses[0]?.id;

        if (newNexusId) {
          console.log('✅ New universe created with nexus:', newNexusId);

          // 6. BIRTH CHILD NODES (0.8 seconds)
          console.log('→ Step 6: Birthing child nodes');
          await spawnChildNodes(newNexusId, newNodes);
          console.log('✓ Step 6 complete: All nodes birthed');

          // 7. COMPLETE & SAVE NEW UNIVERSE
          console.log('✓ BREAK-OFF COMPLETE');
          console.log('═══════════════════════════════════');

          setTimeout(() => {
            console.log('💾 Step 7: Saving new universe...');
            useCanvasStore.getState().saveCurrentUniverse();
            console.log('✅ New universe saved - both universes now in memory');

            setIsBreakingOff(false);
            setTransformingNode(null);
            setDraggedNode(null);
            setDragStartPosition(null);
            setDragCurrentPosition(null);
          }, 100);
        }
      }

    } catch (error) {
      console.error('❌ Break-off failed:', error);
      setIsBreakingOff(false);
      setTransformingNode(null);
      setDraggedNode(null);
      setDragStartPosition(null);
      setDragCurrentPosition(null);

      // Restore original universe on error
      if (originalUniverseId) {
        console.log('🔄 Restoring original universe after error');
        const store = useCanvasStore.getState();
        store.activeUniverseId = originalUniverseId;
      }
    }
  }, [draggedNode, dragCurrentPosition, dragStartPosition, isBreakingOff, nodes, createNexus, fadeOutCurrentUniverse, slideNodeToCenter, transformToNexus, spawnChildNodes]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging || !draggedNode || !dragStartPosition || isBreakingOff) return;

    // Calculate new position based on pointer movement
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Project pointer to 3D space
    const vector = new THREE.Vector3(x, y, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));

    const currentPos: [number, number, number] = [pos.x, pos.y, pos.z];
    setDragCurrentPosition(currentPos);

    // Calculate distance from start
    const dx = currentPos[0] - dragStartPosition[0];
    const dy = currentPos[1] - dragStartPosition[1];
    const dz = currentPos[2] - dragStartPosition[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    setDragDistance(dist);

    console.log('📏 Drag distance:', dist.toFixed(2));

    // 🔥 CRITICAL: Auto-break when threshold crossed (no release needed!)
    if (dist >= BREAK_THRESHOLD) {
      console.log('═══════════════════════════════════');
      console.log('🔥 THRESHOLD CROSSED at', dist.toFixed(2), 'units - AUTO BREAKING!');
      console.log('═══════════════════════════════════');

      // Stop dragging immediately
      setIsDragging(false);

      // Trigger break-off sequence
      handleBreakOff();
    }
  }, [isDragging, draggedNode, dragStartPosition, isBreakingOff, camera, gl, BREAK_THRESHOLD, handleBreakOff]);

  const handlePointerUp = useCallback(() => {
    // If break-off is in progress, don't do anything (let animation complete)
    if (isBreakingOff) {
      console.log('🎯 Pointer up - break-off in progress, ignoring');
      return;
    }

    // Only handle snap-back if we're still dragging and haven't broken off
    if (isDragging && draggedNode) {
      console.log('🎯 Pointer up - distance:', dragDistance);

      if (dragDistance < BREAK_THRESHOLD) {
        // Released before threshold - snap back to original position
        console.log('↩️ Released before threshold - snapping back');
        // Node will snap back automatically when we reset dragCurrentPosition
      }

      // Clean up drag state
      setIsDragging(false);
      setDraggedNode(null);
      setDragStartPosition(null);
      setDragCurrentPosition(null);
      setDragDistance(0);
    }
  }, [isDragging, draggedNode, dragDistance, isBreakingOff, BREAK_THRESHOLD]);

  // Listen for pointer move/up on window
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

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
      <TrackedOrbitControls enabled={!isDragging} />
      <CameraLight />
      <ConnectionLines fadingUniverse={fadingUniverse} />

      {nexuses.map((nexus) => {
        // 🌫️ FADE CONTROL: Calculate opacity for nexuses
        let nexusOpacity = 1;
        if (fadingUniverse) {
          nexusOpacity = 1 - fadingUniverse.progress; // Fade from 1 to 0
        }

        return (
        <group key={nexus.id}>
          <RotatingNexus
            nexus={nexus}
            opacity={nexusOpacity}
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
                  opacity={0.9 * nexusOpacity}
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
                      opacity={0.9 * nexusOpacity}
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
                  opacity={0.8 * nexusOpacity}
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
                      opacity={0.8 * nexusOpacity}
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
                  opacity={0.9 * nexusOpacity}
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
                      opacity={0.9 * nexusOpacity}
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
                  opacity={0.8 * nexusOpacity}
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
                      opacity={0.8 * nexusOpacity}
                    />
                  </mesh>
                );
              })}
            </>
          )}
          
          {nexus.videoUrl && (
            <VideoThumbnail videoUrl={nexus.videoUrl} position={nexus.position} opacity={nexusOpacity} />
          )}
          <NexusTitle title={nexus.title} position={nexus.position} opacity={nexusOpacity} />
        </group>
      );
      })}
      
      {nodeArray.map((node) => {
        const level = getNodeLevel(node.id);
        const size = level === 1 ? 0.75 : 0.5;

        const baseColor = "#A855F7"; // Bright vibrant purple

        // 🌫️ FADE CONTROL: Calculate opacity based on fading state
        let nodeOpacity = 1;

        // SPECIAL CASE: Transforming node always stays visible
        if (transformingNode && node.id === transformingNode.nodeId) {
          nodeOpacity = 1; // Keep fully visible during entire transformation
        } else if (fadingUniverse && node.id !== fadingUniverse.excludeNodeId) {
          nodeOpacity = 1 - fadingUniverse.progress; // Fade from 1 to 0
        }

        // 🚀 DRAG-TO-BREAK: Override position if this node is being dragged
        const isBeingDragged = draggedNode === node.id;
        const displayNode = isBeingDragged && dragCurrentPosition
          ? { ...node, position: dragCurrentPosition }
          : node;

        // 🌟 DRAG-TO-BREAK: Add emerald glow if distance > GLOW_START
        const isDragGlowing = isBeingDragged && dragDistance >= GLOW_START;
        const glowIntensity = isDragGlowing
          ? Math.min((dragDistance - GLOW_START) / (BREAK_THRESHOLD - GLOW_START), 1)
          : 0;

        let haloColor = null;
        let haloType = null;

        // 🌟 Drag glow takes precedence
        if (isDragGlowing) {
          haloColor = "#00FFD4"; // Emerald green
          haloType = 'drag-glow';
        } else if (selectedNodesForConnection.includes(node.id)) {
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
        node={displayNode}
        size={size}
        baseColor={baseColor}
        scale={node.id.startsWith('meta-inspiration') ? 1.5 : 1}
        opacity={nodeOpacity}
        onPointerDown={(e: any) => handleNodePointerDown(e, node)}
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
        node={displayNode}
        size={size}
        opacity={nodeOpacity}
        onPointerDown={(e: any) => handleNodePointerDown(e, node)}
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
        node={displayNode}
        size={size}
        geometry={Geometry}
        color={nodeColor}
        emissive={nodeColor}
        emissiveIntensity={node.nodeType === 'synthesis' ? 0.8 : 0.3}
        roughness={0.0}
        opacity={nodeOpacity}
        onPointerDown={(e: any) => handleNodePointerDown(e, node)}
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
  <mesh position={displayNode.position} rotation={[Math.PI / 2, 0, 0]}>
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
    opacity={(haloType === 'drag-glow' ? 0.5 + glowIntensity * 0.4 : (haloType === 'selected' ? 0.8 : 0.9)) * nodeOpacity}
  />
</mesh>
                {Array.from({ length: 20 }).map((_, i) => {
                  const angle = (Math.random() * Math.PI * 2);
                  const sparkleRadius = size * 1.4 + Math.random() * 0.2;
                  const x = displayNode.position[0] + Math.cos(angle) * sparkleRadius;
                  const z = displayNode.position[2] + Math.sin(angle) * sparkleRadius;
                  const y = displayNode.position[1] + (Math.random() - 0.5) * 0.05;
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
                        opacity={(haloType === 'selected' ? 0.8 : 0.9) * nodeOpacity}
                      />
                    </mesh>
                  );
                })}
              </>
            )}

            {/* Anchor Indicator - Sparkles orbiting around anchored nodes */}
            {node.isAnchored && (
              <NodeSparkles position={displayNode.position} opacity={nodeOpacity} />
            )}
          </group>
        );
      })}

      <ambientLight intensity={0.02} />
      <pointLight position={[10, 10, 10]} intensity={0.1} />

      {/* 💥 PARTICLE BURSTS */}
      {particleBursts.map((burst) => (
        <ParticleBurst
          key={burst.id}
          position={burst.position}
          onComplete={() => {
            setParticleBursts((prev) => prev.filter((b) => b.id !== burst.id));
            console.log('💥 Particle burst complete for:', burst.id);
          }}
        />
      ))}
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
  const activeUniverseId = useCanvasStore((state) => state.activeUniverseId);
  const universeLibrary = useCanvasStore((state) => state.universeLibrary);
  const renameUniverse = useCanvasStore((state) => state.renameUniverse);

  const [isHoldingC, setIsHoldingC] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

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

  // Get current universe data
  const currentUniverse = activeUniverseId ? universeLibrary[activeUniverseId] : null;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#050A1E' }}>
      <Controls />

      {/* Universe Title - editable on right-click */}
      {currentUniverse && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          pointerEvents: 'auto'
        }}>
          {isEditingTitle ? (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value.slice(0, 80))}
                onBlur={() => {
                  if (activeUniverseId) {
                    renameUniverse(activeUniverseId, editTitle);
                  }
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeUniverseId) {
                    renameUniverse(activeUniverseId, editTitle);
                    setIsEditingTitle(false);
                  }
                  if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                style={{
                  padding: '12px 20px',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  backgroundColor: 'rgba(26, 31, 58, 0.9)',
                  color: '#FFD700',
                  border: '2px solid #00FFD4',
                  borderRadius: '8px',
                  outline: 'none',
                  textAlign: 'center',
                  minWidth: '300px'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '-20px',
                right: '4px',
                fontSize: '10px',
                color: editTitle.length > 80 ? '#EF4444' : 'rgba(255, 255, 255, 0.4)'
              }}>
                {editTitle.length}/80
              </div>
            </div>
          ) : (
            <div>
              <h1
                onContextMenu={(e) => {
                  e.preventDefault();
                  setEditTitle(currentUniverse.title);
                  setIsEditingTitle(true);
                }}
                style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: '#FFD700',
                  textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                  cursor: 'context-menu',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(26, 31, 58, 0.7)',
                  userSelect: 'none',
                  margin: 0
                }}
              >
                {currentUniverse.title}
              </h1>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.4)',
                textAlign: 'center',
                marginTop: '4px'
              }}>
                Right-click to rename
              </div>
            </div>
          )}
        </div>
      )}

      <UnifiedNodeModal />
      <ConnectionModeHint isHoldingC={isHoldingC} selectedCount={selectedNodesForConnection.length} />
      {hasUniverse && <SectionNavigator />}
      <Canvas camera={{ position: [10, 8, 15], fov: 60 }}>
        <Scene isHoldingC={isHoldingC} />
        <CameraPositionManager />
      </Canvas>
    </div>
  );
}