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

function ConnectionLines() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const materialsRef = useRef<THREE.LineBasicMaterial[]>([]);
  
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    materialsRef.current.forEach((material, index) => {
      if (material) {
        const hue = ((time * 0.5 + index * 0.2) % 1);
        material.color.setHSL(hue, 1, 0.7);
        material.opacity = 0.5 + Math.sin(time * 3 + index) * 0.4;
      }
    });
  });
  
  if (nexuses.length === 0) return null;
  
  const nodeArray = Object.values(nodes);
  let lineIndex = 0;
  
  return (
    <>
      {nodeArray.map((node) => {
        if (!materialsRef.current[lineIndex]) {
          materialsRef.current[lineIndex] = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
          });
        }
        
        let parentPosition: [number, number, number];
        
        const parentNexus = nexuses.find(n => n.id === node.parentId);
        if (parentNexus) {
          parentPosition = parentNexus.position;
        } else if (node.parentId && nodes[node.parentId]) {
          parentPosition = nodes[node.parentId].position;
        } else {
          return null;
        }
        
        const material = materialsRef.current[lineIndex];
        lineIndex++;
        
        return (
          <Line
            key={node.id}
            points={[parentPosition, node.position]}
            color="#ffffff"
            lineWidth={2}
            material={material}
          />
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

function Scene() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const selectedId = useCanvasStore((state) => state.selectedId);
  const getNodeLevel = useCanvasStore((state) => state.getNodeLevel);
  const getNexusForNode = useCanvasStore((state) => state.getNexusForNode);
  
  useCameraAnimation();
  
  const selectedMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const nextMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const alternateMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  
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
    
    const selectedNexus = nexuses.find(n => n.id === selectedId);
    
    if (selectedNexus) {
      // Clicked a nexus - highlight first L1 child
      const l1Nodes = allNodes.filter(n => n.parentId === selectedNexus.id);
      if (l1Nodes.length >= 1) {
        glowNodes.next = l1Nodes[0].id;
      }
    } else if (nodes[selectedId]) {
      const currentNode = nodes[selectedId];
      const children = allNodes.filter(n => n.parentId === selectedId);
      const nodeNexus = getNexusForNode(selectedId);
      
      if (children.length >= 1) {
        // Has children - highlight first child as "next"
        glowNodes.next = children[0].id;
        
        // Also check if current node has siblings (for L1 nodes)
        const parentNexus = nexuses.find(n => n.id === currentNode.parentId);
        if (parentNexus) {
          // This is an L1 node - highlight next L1 sibling as "alternate"
          const l1Siblings = allNodes.filter(n => n.parentId === parentNexus.id);
          const currentIndex = l1Siblings.findIndex(n => n.id === selectedId);
          if (currentIndex >= 0 && currentIndex < l1Siblings.length - 1) {
            glowNodes.alternate = l1Siblings[currentIndex + 1].id;
          }
        }
      } else {
        // Leaf node (no children) - need to suggest next steps
        
        // First, check if this node has siblings (L2, L3, L4, etc.)
        const siblings = allNodes.filter(n => n.parentId === currentNode.parentId);
        const currentIndex = siblings.findIndex(n => n.id === selectedId);
        
        if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
          // Has a next sibling - highlight it as "next"
          glowNodes.next = siblings[currentIndex + 1].id;
        }
        
        // ALSO find and highlight the next L1 branch as "alternate"
        if (nodeNexus) {
          // Find which L1 branch this leaf belongs to
          let l1Ancestor = currentNode;
          while (l1Ancestor.parentId !== nodeNexus.id && nodes[l1Ancestor.parentId]) {
            l1Ancestor = nodes[l1Ancestor.parentId];
          }
          
          // Get all L1 children of this nexus
          const l1Siblings = allNodes.filter(n => n.parentId === nodeNexus.id);
          const l1Index = l1Siblings.findIndex(n => n.id === l1Ancestor.id);
          
          if (l1Index >= 0 && l1Index < l1Siblings.length - 1) {
            // There's a next L1 sibling - highlight it as alternate
            glowNodes.alternate = l1Siblings[l1Index + 1].id;
          } else if (l1Siblings.length > 0) {
            // We're at the last L1 branch - loop back to first L1
            glowNodes.alternate = l1Siblings[0].id;
          }
        }
      }
    }
    
    return glowNodes;
  };
  
  const glowNodes = getGlowNodes();
  
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    if (glowNodes.selected) {
      const material = selectedMaterialsRef.current.get(glowNodes.selected);
      if (material) {
        material.emissiveIntensity = 2.0 + Math.sin(time * 2) * 0.5;
      }
    }
    
    if (glowNodes.next) {
      const material = nextMaterialsRef.current.get(glowNodes.next);
      if (material) {
        material.emissiveIntensity = 3.5 + Math.sin(time * 3) * 1.5;
      }
    }
    
    if (glowNodes.alternate) {
      const material = alternateMaterialsRef.current.get(glowNodes.alternate);
      if (material) {
        material.emissiveIntensity = 2.5 + Math.sin(time * 3) * 1.0;
      }
    }
  });
  
  return (
    <>
      <ConnectionLines />
      
      {nexuses.map((nexus) => (
        <group key={nexus.id}>
          <mesh 
            position={nexus.position}
            onClick={() => selectNode(nexus.id)}
          >
            <sphereGeometry args={[2, 16, 16]} />
            <meshStandardMaterial 
              ref={(mat) => {
                if (mat) {
                  if (glowNodes.selected === nexus.id) {
                    selectedMaterialsRef.current.set(nexus.id, mat);
                  } else if (glowNodes.next === nexus.id) {
                    nextMaterialsRef.current.set(nexus.id, mat);
                  } else if (glowNodes.alternate === nexus.id) {
                    alternateMaterialsRef.current.set(nexus.id, mat);
                  }
                }
              }}
              color="#00FFD4"
              wireframe 
              emissive={
                glowNodes.selected === nexus.id ? "#FFD700" : 
                glowNodes.next === nexus.id ? "#00E5FF" :
                glowNodes.alternate === nexus.id ? "#00E5FF" :
                "#00FFD4"
              }
              emissiveIntensity={
                glowNodes.selected === nexus.id ? 2.0 :
                glowNodes.next === nexus.id || glowNodes.alternate === nexus.id ? 3.5 : 
                0.3
              }
              wireframeLinewidth={3}
            />
          </mesh>
          
          {nexus.videoUrl && (
            <VideoThumbnail videoUrl={nexus.videoUrl} position={nexus.position} />
          )}
          <NexusTitle title={nexus.title} position={nexus.position} />
        </group>
      ))}
      
      {nodeArray.map((node) => {
        const level = getNodeLevel(node.id);
        const size = level === 1 ? 0.75 : 0.5;
        
        const baseColor = node.isAI ? "#FF8C00" : "#9333EA";
        
        let emissiveColor = baseColor;
        let emissiveIntensity = 0.5;
        let glowType = null;
        
        if (glowNodes.selected === node.id) {
          emissiveColor = "#FFD700";
          emissiveIntensity = 2.0;
          glowType = 'selected';
        } else if (glowNodes.next === node.id) {
          emissiveColor = "#00E5FF";
          emissiveIntensity = 3.5;
          glowType = 'next';
        } else if (glowNodes.alternate === node.id) {
          emissiveColor = "#00E5FF";
          emissiveIntensity = 2.5;
          glowType = 'alternate';
        }
        
        const Geometry = node.isAI ? (
          <boxGeometry args={[size * 1.5, size * 1.5, size * 1.5]} />
        ) : (
          <octahedronGeometry args={[size]} />
        );
        
        const WireframeGeometry = node.isAI ? (
          <boxGeometry args={[size * 1.52, size * 1.52, size * 1.52]} />
        ) : (
          <octahedronGeometry args={[size * 1.01]} />
        );
        
        return (
          <group key={node.id}>
            <mesh 
              position={node.position} 
              onClick={() => selectNode(node.id)}
            >
              {Geometry}
              <meshStandardMaterial 
                ref={(mat) => {
                  if (mat && glowType) {
                    if (glowType === 'selected') {
                      selectedMaterialsRef.current.set(node.id, mat);
                    } else if (glowType === 'next') {
                      nextMaterialsRef.current.set(node.id, mat);
                    } else if (glowType === 'alternate') {
                      alternateMaterialsRef.current.set(node.id, mat);
                    }
                  }
                }}
                color={baseColor}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntensity}
              />
            </mesh>
            
            <mesh position={node.position}>
              {WireframeGeometry}
              <meshBasicMaterial 
                color="#00FFD4"
                wireframe
                transparent
                opacity={0.4}
              />
            </mesh>
          </group>
        );
      })}
      
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={2} />
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
  
  // Check if academic paper is loaded by checking the type flag
  const hasAcademicPaper = nexuses.some(n => n.type === 'academic');
  
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