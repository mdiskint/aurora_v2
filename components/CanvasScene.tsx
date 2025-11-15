'use client';
import React from 'react';
import SectionNavigator from './SectionNavigator';
import UnifiedNodeModal from './UnifiedNodeModal';
import ApplicationLabScene from './ApplicationLabScene';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Text3D, Html, Points, PointMaterial, Text } from '@react-three/drei';
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

  return <OrbitControls ref={controlsRef} enabled={enabled} enableDamping dampingFactor={0.05} makeDefault />;
}

// 📸 Camera Position Manager - Resets camera when active universes change
function CameraPositionManager() {
  const { camera, controls } = useThree();
  const activeUniverseIds = useCanvasStore((state) => state.activeUniverseIds);
  const prevUniverseIds = useRef<string[]>([]);

  useEffect(() => {
    // Check if the active universes array has changed
    const hasChanged =
      prevUniverseIds.current.length !== activeUniverseIds.length ||
      !prevUniverseIds.current.every((id, index) => id === activeUniverseIds[index]);

    // Only act if universe array changed (not on initial mount)
    if (prevUniverseIds.current.length > 0 && hasChanged) {
      console.log('📷 ==========================================');
      console.log('📷 ACTIVE UNIVERSES CHANGED - Resetting camera');
      console.log('📷   From:', prevUniverseIds.current);
      console.log('📷   To:', activeUniverseIds);
      console.log('📷 ==========================================');

      // Get current position and target
      const startPos = camera.position.clone();
      const startTarget = controls ? (controls as any).target.clone() : new THREE.Vector3(0, 0, 0);

      // Calculate target position based on number of active universes
      let targetX, targetY, targetZ;

      if (activeUniverseIds.length === 0) {
        // No universes - default position
        targetX = 10;
        targetY = 8;
        targetZ = 15;
      } else if (activeUniverseIds.length === 1) {
        // Single universe - standard close view
        targetX = 10;
        targetY = 8;
        targetZ = 15;
      } else {
        // Multiple universes - pull back for wider view
        const pullbackFactor = Math.min(activeUniverseIds.length, 6) * 0.5;
        targetX = 10 + (pullbackFactor * 3);
        targetY = 15 + (pullbackFactor * 2);
        targetZ = 20 + (pullbackFactor * 4);
      }

      const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
      const targetLookAt = new THREE.Vector3(0, 0, 0);

      // Smooth animation
      const duration = 800; // 0.8 seconds
      const startTime = Date.now();

      const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        // Interpolate camera position
        camera.position.lerpVectors(startPos, targetPos, eased);

        // CRITICAL: Update controls target to origin
        if (controls) {
          (controls as any).target.lerpVectors(startTarget, targetLookAt, eased);
          (controls as any).update();
        }

        // Also directly set camera lookAt (belt and suspenders)
        camera.lookAt(0, 0, 0);

        if (progress < 1) {
          requestAnimationFrame(animateCamera);
        } else {
          // Final확인 - ensure everything is locked to origin
          camera.position.set(targetX, targetY, targetZ);
          camera.lookAt(0, 0, 0);

          if (controls) {
            (controls as any).target.set(0, 0, 0);
            (controls as any).update();
          }

          console.log('✅ Camera reset complete');
          console.log('   Position:', [targetX, targetY, targetZ]);
          console.log('   Looking at:', [0, 0, 0]);
          console.log('   Controls target:', controls ? (controls as any).target.toArray() : 'N/A');
        }
      };

      animateCamera();
    }

    prevUniverseIds.current = [...activeUniverseIds];
  }, [activeUniverseIds, camera, controls]);

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
  const glowMeshRef = useRef<THREE.Mesh>(null);

  // 🌱 EVOLVING NEXUS - Check evolution state
  const isApplicationLab = nexus.evolutionState === 'application-lab';
  const isGrowing = nexus.evolutionState === 'growing';

  // Rotate and pulse the mesh every frame
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0067; // Rotate on Y axis
      meshRef.current.rotation.x += 0.0033; // Slight X rotation for complexity

      // 🎓 Pulsing animation for Application Lab nexuses
      if (isApplicationLab) {
        const time = clock.getElapsedTime();
        const pulse = Math.sin(time * 1.5) * 0.05 + 1.0; // Oscillate between 0.95 and 1.05
        meshRef.current.scale.setScalar(pulse);
      }
    }

    // Pulse the glow for Application Lab nexuses
    if (glowMeshRef.current && isApplicationLab) {
      const time = clock.getElapsedTime();
      const glowPulse = Math.sin(time * 2) * 0.15 + 0.85; // Oscillate opacity
      (glowMeshRef.current.material as THREE.MeshBasicMaterial).opacity = glowPulse * 0.3;
    }
  });

  // Color based on evolution state
  const color = isApplicationLab
    ? "#FFD700" // Cyan-Gold for Application Lab (using gold as dominant)
    : isGrowing
    ? "#00CED1" // Cyan for growing (transitioning)
    : "#00FF9D"; // Original green for seed

  return (
    <group>
      {/* Main mesh */}
      <mesh ref={meshRef} position={nexus.position} onClick={onClick} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial
          color={color}
          wireframe={true}
          transparent={true}
          opacity={opacity}
        />
      </mesh>

      {/* 🎓 Glow effect for Application Lab nexuses */}
      {isApplicationLab && (
        <mesh ref={glowMeshRef} position={nexus.position}>
          <sphereGeometry args={[2.5, 32, 32]} />
          <meshBasicMaterial
            color="#FFD700"
            transparent={true}
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
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
                              opacity={0.5 * 1.2}
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
                      opacity={0.5 * 1.2}
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
                      opacity={0.5 * 1.2}
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
                  opacity={0.5 * 1.2}
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

function Scene({ isHoldingShift }: { isHoldingShift: boolean }) {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const universeLibrary = useCanvasStore((state) => state.universeLibrary);
  const activeUniverseId = useCanvasStore((state) => state.activeUniverseId);
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

  // 🎓 Helper function: Check if node is locked (DISABLED - all nodes are now unlocked)
  const isNodeLocked = (node: any) => {
    // Lock feature disabled - all nodes are immediately accessible
    return false;
  };

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
      <TrackedOrbitControls />
      <CameraLight />
      <ConnectionLines />

      {nexuses.map((nexus) => {
        const nexusOpacity = 1;

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

              if (isDoubleClick && !isHoldingShift && !connectionModeActive) {
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

              // 🔗 SHIFT+CLICK CONNECTION MODE DISABLED - Now handled by SectionNavigator
              // Old connection mode (connectionModeActive) kept for compatibility
              if (connectionModeActive) {
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

        // Calculate opacity based on locked state
        let nodeOpacity = 1;

        // 🔒 LOCKED STATE: Grey transparent appearance for locked nodes (course universes only)
        if (isNodeLocked(node)) {
          nodeOpacity = 0.3; // 30% opacity for locked nodes
        }

        const displayNode = node;

        let haloColor = null;
        let haloType = null;

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

// 🔒 Override color for locked nodes (grey) - course universes only
if (isNodeLocked(node)) {
  nodeColor = "#808080"; // Grey color for locked nodes
}

if (node.nodeType === 'synthesis') {
  // Synthesis nodes: Gem-like icosahedron (cyan)
  Geometry = <icosahedronGeometry args={[size * 1.2, 0]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#00FFFF";
} else if (node.nodeType === 'ai-response') {
  // AI responses: Deep burnt orange sphere (wireframe)
  Geometry = <sphereGeometry args={[size, 32, 32]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#D2691E"; // Deep burnt orange
} else if (node.nodeType === 'inspiration' || node.nodeType === 'socratic-question') {
  // Inspiration/Socratic questions: Dodecahedron star (gold)
  Geometry = <dodecahedronGeometry args={[size * 1.3, 0]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#FFD700";
} else if (node.nodeType === 'doctrine') {
  // 🎓 Doctrine nodes: Larger spheres (green)
  Geometry = <sphereGeometry args={[size * 1.2, 32, 32]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#10B981"; // Emerald green
} else if (node.nodeType === 'intuition-example') {
  // 💡 Intuition example nodes: Octahedron (yellow)
  Geometry = <octahedronGeometry args={[size, 0]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#EAB308"; // Yellow
} else if (node.nodeType === 'model-answer') {
  // 📐 Model answer nodes: Box (blue)
  Geometry = <boxGeometry args={[size * 1.5, size * 1.5, size * 1.5]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#3B82F6"; // Blue
} else if (node.nodeType === 'imitate') {
  // 🎯 Imitate nodes: Cone (orange)
  Geometry = <coneGeometry args={[size, size * 2, 8]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#F97316"; // Orange
} else if (node.nodeType === 'quiz-mc' || node.nodeType === 'quiz-short-answer') {
  // 📝 Quiz nodes: Tetrahedron (purple)
  Geometry = <tetrahedronGeometry args={[size * 1.1, 0]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#A855F7"; // Purple
} else if (node.nodeType === 'application-scenario') {
  // 🌍 Application scenario nodes: Torus (teal)
  Geometry = <torusGeometry args={[size * 0.7, size * 0.3, 16, 100]} />;
  nodeColor = isNodeLocked(node) ? "#808080" : "#14B8A6"; // Teal
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
        onPointerDown={undefined}
        onClick={(e: any) => {
          e.stopPropagation();

          // 🔒 Block locked nodes (course universes only)
          if (isNodeLocked(node)) {
            console.log('🔒 Node is locked:', node.id);
            return;
          }

          // 🔗 SHIFT+CLICK CONNECTION MODE DISABLED - Now handled by SectionNavigator
          if (connectionModeActive) {
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
        onPointerDown={undefined}
        onClick={(e: any) => {
          e.stopPropagation();

          // 🔒 Block locked nodes (course universes only)
          if (isNodeLocked(node)) {
            console.log('🔒 Node is locked:', node.id);
            return;
          }

          // 🔗 SHIFT+CLICK CONNECTION MODE DISABLED - Now handled by SectionNavigator
          if (connectionModeActive) {
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
        emissiveIntensity={
          node.nodeType === 'synthesis' ? 0.8 :
          node.nodeType === 'doctrine' ? 0.7 :
          node.nodeType === 'intuition-example' ? 0.7 :
          node.nodeType === 'model-answer' ? 0.7 :
          node.nodeType === 'imitate' ? 0.7 :
          node.nodeType === 'quiz-mc' ? 0.7 :
          node.nodeType === 'quiz-short-answer' ? 0.7 :
          node.nodeType === 'application-scenario' ? 0.7 :
          0.3
        }
        roughness={0.0}
        opacity={nodeOpacity}
        onPointerDown={undefined}
        onClick={(e: any) => {
          e.stopPropagation();

          // 🔒 Block locked nodes (course universes only)
          if (isNodeLocked(node)) {
            console.log('🔒 Node is locked:', node.id);
            return;
          }

          // 🔗 SHIFT+CLICK CONNECTION MODE DISABLED - Now handled by SectionNavigator
          if (connectionModeActive) {
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
    opacity={(haloType === 'selected' ? 0.8 : 0.9) * nodeOpacity}
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

            {/* ✅ Checkmark Icon for completed nodes (course universes only) */}
            {node.isCompleted && !isNodeLocked(node) && (
              <Text
                position={[
                  displayNode.position[0],
                  displayNode.position[1] + size * 1.8,
                  displayNode.position[2]
                ]}
                fontSize={0.4}
                color="#10b981"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#000000"
              >
                ✅
              </Text>
            )}

            {/* 🔒 Lock Icon for locked nodes (course universes only) */}
            {isNodeLocked(node) && (
              <Text
                position={[
                  displayNode.position[0],
                  displayNode.position[1] + size * 1.8,
                  displayNode.position[2]
                ]}
                fontSize={0.4}
                color="#FFFFFF"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#000000"
              >
                🔒
              </Text>
            )}
          </group>
        );
      })}

      <ambientLight intensity={0.02} />
      <pointLight position={[10, 10, 10]} intensity={0.1} />
    </>
  );
}

function ConnectionModeHint({ isHoldingShift, selectedCount }: { isHoldingShift: boolean; selectedCount: number }) {
  if (!isHoldingShift && selectedCount === 0) return null;

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
      {isHoldingShift && selectedCount === 0 && (
        <div>🔗 Hold Shift and click nodes to connect...</div>
      )}
      {isHoldingShift && selectedCount > 0 && (
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
  const activeUniverseIds = useCanvasStore((state) => state.activeUniverseIds);
  const universeLibrary = useCanvasStore((state) => state.universeLibrary);
  const renameUniverse = useCanvasStore((state) => state.renameUniverse);

  // 🔬 Application Lab Mode
  const isApplicationLabMode = useCanvasStore((state) => state.isApplicationLabMode);

  // 🔬 Monitor Application Lab Mode state changes
  useEffect(() => {
    console.log('🔬🔬🔬 APPLICATION LAB MODE STATE CHANGED:', isApplicationLabMode);
  }, [isApplicationLabMode]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // Show section navigator for any universe with nexuses
  const hasUniverse = nexuses.length > 0;

  // Get current universe data - only show title for single universe
  const currentUniverse = activeUniverseIds.length === 1 && activeUniverseIds[0]
    ? universeLibrary[activeUniverseIds[0]]
    : null;

  // Keyboard handling moved to parent component
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 🔗 SHIFT+CLICK CONNECTION MODE DISABLED - Now handled by SectionNavigator
      if (e.key === 'Escape') {
        console.log('❌ Cancelled connection mode');
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

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clearConnectionMode, selectedId, nexuses, nodes, deleteNode, deleteConversation]);

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

  // Debug logging
  console.log('🔬 CanvasScene render - isApplicationLabMode:', isApplicationLabMode);

  // 🔬 Main content (will be wrapped by ApplicationLabScene if in Application Lab mode)
  const mainContent = (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#050A1E' }}>
      <Controls />

      {/* Universe Title - editable on right-click (only for single universe) */}
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
                  if (activeUniverseIds[0]) {
                    renameUniverse(activeUniverseIds[0], editTitle);
                  }
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeUniverseIds[0]) {
                    renameUniverse(activeUniverseIds[0], editTitle);
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
      {/* 🔗 CONNECTION MODE HINT DISABLED - Now handled by SectionNavigator */}
      {hasUniverse && <SectionNavigator />}

      <Canvas camera={{ position: [10, 8, 15], fov: 60 }}>
        <Scene isHoldingShift={false} />
        <CameraPositionManager />
      </Canvas>
    </div>
  );

  // 🔬 Conditionally wrap with ApplicationLabScene if in Application Lab mode
  if (isApplicationLabMode) {
    console.log('🔬 Rendering WITH ApplicationLabScene wrapper');
    return <ApplicationLabScene>{mainContent}</ApplicationLabScene>;
  } else {
    console.log('🔬 Rendering WITHOUT ApplicationLabScene wrapper (normal mode)');
    return mainContent;
  }
}