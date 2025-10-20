'use client';
import SectionNavigator from './SectionNavigator';
import ContentOverlay from './ContentOverlay';
import { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Text3D, Html } from '@react-three/drei';
import { useCanvasStore } from '@/lib/store';
import ReplyModal from './ReplyModal';
import CreateNexusModal from './CreateNexusModal';
import * as THREE from 'three';
import { useCameraAnimation } from '@/lib/useCameraAnimation';
import { io } from 'socket.io-client';

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
        initialStates[node.id] = Math.random(); // Random start position
      });
      setPulseStates(initialStates);
      initializedRef.current = true;
    }
  }, [nodes]);
  
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    // Update all pulse positions
    const newPulseStates: { [key: string]: number } = {};
    Object.values(nodes).forEach((node) => {
      const currentPos = pulseStates[node.id] || Math.random();
      newPulseStates[node.id] = (currentPos + 0.01) % 1; // Slowed down speed
    });
    setPulseStates(newPulseStates);
  });
  
  if (nexuses.length === 0) return null;
  
  const nodeArray = Object.values(nodes);
  
  return (
    <>
      {nodeArray.map((node, idx) => {
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
        
        // Calculate pulse position along the line
        const pulseX = parentPosition[0] + (node.position[0] - parentPosition[0]) * pulseProgress;
        const pulseY = parentPosition[1] + (node.position[1] - parentPosition[1]) * pulseProgress;
        const pulseZ = parentPosition[2] + (node.position[2] - parentPosition[2]) * pulseProgress;
        
        // Rainbow color that changes over time and per line
        const hue = (pulseProgress + idx * 0.15) % 1;
        const rainbowColor = new THREE.Color().setHSL(hue, 1, 0.6);
        
        return (
          <group key={node.id}>
            {/* Main connection line with rainbow color */}
            <Line
              points={[parentPosition, node.position]}
              color={rainbowColor}
              lineWidth={2}
              transparent
              opacity={0.5}
            />
            
            {/* Single animated rainbow pulse */}
            <mesh position={[pulseX, pulseY, pulseZ]}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshBasicMaterial 
                color={rainbowColor}
                transparent
                opacity={1}
              />
            </mesh>
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
    
    // Additional spotlights angled from camera
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
    
    // Top-down lights from above-left and above-right
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
    
    // Fill lights follow camera at slight offsets
    if (fillLight1Ref.current) {
      const offset1 = new THREE.Vector3(5, 3, 0);
      fillLight1Ref.current.position.copy(camera.position).add(offset1);
    }
    
    if (fillLight2Ref.current) {
      const offset2 = new THREE.Vector3(-5, 3, 0);
      fillLight2Ref.current.position.copy(camera.position).add(offset2);
    }
  });
  
  // Create 4 equator ring lights - fewer but MUCH more powerful
  const equatorLights = Array.from({ length: 4 }).map((_, i) => {
    const angle = (i / 4) * Math.PI * 2; // 4 lights = 90° apart (N, E, S, W)
    const radius = 15; // Distance from center
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 0; // At equator level
    
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
      {/* Main spotlight from camera - WIDER & BRIGHTER */}
      <spotLight 
        ref={lightRef} 
        intensity={250} 
        angle={Math.PI / 1.5}
        penumbra={0.3}
        distance={400}
        decay={0.4}
      />
      
      {/* Additional spotlights for wider coverage */}
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
      
      {/* Fill lights for softer spread */}
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
      
      {/* ✨ NEW: Equator ring lights - 8 spotlights around the middle */}
      {equatorLights}
    </>
  );
}

function Scene() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const selectedId = useCanvasStore((state) => state.selectedId);
  const previousId = useCanvasStore((state) => state.previousId);
  const getNodeLevel = useCanvasStore((state) => state.getNodeLevel);
  const getNexusForNode = useCanvasStore((state) => state.getNexusForNode);
  
  useCameraAnimation();
  
  const selectedMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());
  const previousMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());
  const nextMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());
  const alternateMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());
  const sparkleMaterialsRef = useRef<Map<string, THREE.MeshBasicMaterial[]>>(new Map());
  
  const nodeArray = Object.values(nodes);
  
  const getGlowNodes = () => {
    const glowNodes = { 
      selected: null as string | null,
      previous: null as string | null,
      next: null as string | null,
      alternate: null as string | null 
    };
    
    if (!selectedId) return glowNodes;
    
    const allNodes = Object.values(nodes);
    glowNodes.selected = selectedId;
    glowNodes.previous = previousId;
    
    console.log(`🎨 Glow States - Selected: ${selectedId}, Previous: ${previousId}`);
    
    const selectedNexus = nexuses.find(n => n.id === selectedId);
    
    if (selectedNexus) {
      const l1Nodes = allNodes.filter(n => n.parentId === selectedNexus.id);
      if (l1Nodes.length >= 1) {
        glowNodes.next = l1Nodes[0].id !== previousId ? l1Nodes[0].id : (l1Nodes.length > 1 ? l1Nodes[1].id : null);
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
          {/* Main metallic sphere - pure chrome, no glow */}
          <mesh 
            position={nexus.position}
            onClick={() => selectNode(nexus.id)}
          >
            <sphereGeometry args={[2, 32, 32]} />
            <meshStandardMaterial 
              color="#00FF9D"
              metalness={1.0}
              roughness={0.0}
              emissive="#00FF9D"
              emissiveIntensity={0.2}
              envMapIntensity={3.0}
              clearcoat={1.0}
              clearcoatRoughness={0.0}
            />
          </mesh>
          
          {/* Halo ring for selected state */}
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
              
              {/* Sparkles around the halo - Saturn ring style */}
              {Array.from({ length: 30 }).map((_, i) => {
                // Random angle for scattered distribution
                const angle = (Math.random() * Math.PI * 2);
                // Slightly varied radius for depth
                const sparkleRadius = 2.4 + Math.random() * 0.3;
                const x = nexus.position[0] + Math.cos(angle) * sparkleRadius;
                const z = nexus.position[2] + Math.sin(angle) * sparkleRadius;
                // Slight vertical variation
                const y = nexus.position[1] + (Math.random() - 0.5) * 0.1;
                // Varied sizes for realism
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
          
          {/* Halo for previous state */}
          {glowNodes.previous === nexus.id && (
            <>
              <mesh position={nexus.position} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.15, 16, 32]} />
                <meshBasicMaterial 
                  ref={(mat) => {
                    if (mat) previousMaterialsRef.current.set(nexus.id, mat);
                  }}
                  color="#FFFFFF"
                  transparent
                  opacity={0.7}
                />
              </mesh>
              
              {/* Sparkles - Saturn style */}
              {Array.from({ length: 30 }).map((_, i) => {
                const angle = (Math.random() * Math.PI * 2);
                const sparkleRadius = 2.4 + Math.random() * 0.3;
                const x = nexus.position[0] + Math.cos(angle) * sparkleRadius;
                const z = nexus.position[2] + Math.sin(angle) * sparkleRadius;
                const y = nexus.position[1] + (Math.random() - 0.5) * 0.1;
                const size = 0.04 + Math.random() * 0.06;
                
                return (
                  <mesh key={`sparkle-prev-${i}`} position={[x, y, z]}>
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
                      color="#FFFFFF"
                      transparent
                      opacity={0.7}
                    />
                  </mesh>
                );
              })}
            </>
          )}
          
          {/* Halo for next state */}
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
              
              {/* Sparkles - Saturn style */}
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
          
          {/* Halo for alternate state */}
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
              
              {/* Sparkles - Saturn style */}
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
        
        // ALL diamonds are NEON purple
        const baseColor = "#E933FF";
        
        let haloColor = null;
        let haloType = null;
        
        if (glowNodes.selected === node.id) {
          haloColor = "#FFFF00";
          haloType = 'selected';
        } else if (glowNodes.previous === node.id) {
          haloColor = "#FFFFFF";
          haloType = 'previous';
        } else if (glowNodes.next === node.id) {
          haloColor = "#00FFFF";
          haloType = 'next';
        } else if (glowNodes.alternate === node.id) {
          haloColor = "#00FFFF";
          haloType = 'alternate';
        }
        
        // All nodes are diamonds (octahedrons)
        const Geometry = <octahedronGeometry args={[size, 0]} />;
        
        return (
          <group key={node.id}>
            {/* Main metallic shape - pure chrome, no glow */}
            <mesh 
              position={node.position} 
              onClick={() => selectNode(node.id)}
            >
              {Geometry}
              <meshStandardMaterial 
                color={baseColor}
                metalness={1.0}
                roughness={0.0}
                emissive={baseColor}
                emissiveIntensity={0.3}
                envMapIntensity={3.0}
                clearcoat={1.0}
                clearcoatRoughness={0.0}
              />
            </mesh>
            
            {/* Halo ring around diamond */}
            {haloColor && (
              <>
                <mesh position={node.position} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[size * 1.5, 0.08, 16, 32]} />
                  <meshBasicMaterial 
                    ref={(mat) => {
                      if (mat && haloType) {
                        if (haloType === 'selected') {
                          selectedMaterialsRef.current.set(node.id, mat);
                        } else if (haloType === 'previous') {
                          previousMaterialsRef.current.set(node.id, mat);
                        } else if (haloType === 'next') {
                          nextMaterialsRef.current.set(node.id, mat);
                        } else if (haloType === 'alternate') {
                          alternateMaterialsRef.current.set(node.id, mat);
                        }
                      }
                    }}
                    color={haloColor}
                    transparent
                    opacity={haloType === 'selected' ? 0.8 : haloType === 'previous' ? 0.7 : 0.9}
                  />
                </mesh>
                
                {/* Sparkles around node halo - Saturn style */}
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
                        opacity={haloType === 'selected' ? 0.8 : haloType === 'previous' ? 0.7 : 0.9}
                      />
                    </mesh>
                  );
                })}
              </>
            )}
          </group>
        );
      })}
      
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} intensity={0.3} />
    </>
  );
}

function Controls() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const nexuses = useCanvasStore((state) => state.nexuses);
  
  return (
    <>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000 }}>
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
  const addNodeFromWebSocket = useCanvasStore((state) => state.addNodeFromWebSocket);
  const addNexusFromWebSocket = useCanvasStore((state) => state.addNexusFromWebSocket);
  
  const hasAcademicPaper = nexuses.some(n => n.type === 'academic');
  
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
  
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#050A1E' }}>
      <Controls />
      <ReplyModal />
      <ContentOverlay />
      {hasAcademicPaper && <SectionNavigator />}
      <Canvas camera={{ position: [10, 8, 15], fov: 60 }}>
        <Scene />
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}