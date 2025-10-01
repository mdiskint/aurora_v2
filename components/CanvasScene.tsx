'use client';

import ContentOverlay from './ContentOverlay.tsx';
import { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import { useCanvasStore } from '@/lib/store';
import ReplyModal from './ReplyModal';
import CreateNexusModal from './CreateNexusModal';
import * as THREE from 'three';

function ConnectionLines() {
  const nexus = useCanvasStore((state) => state.nexus);
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
  
  if (!nexus) return null;
  
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
        
        // Determine parent position
        let parentPosition: [number, number, number];
        if (node.parentId === nexus.id) {
          parentPosition = nexus.position;
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

function Scene() {
  const nexus = useCanvasStore((state) => state.nexus);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const getNodeLevel = useCanvasStore((state) => state.getNodeLevel);
  
  const nodeArray = Object.values(nodes);
  
  console.log(`🎨 Scene rendering - Nexus: ${nexus ? 'Yes' : 'No'}, Nodes: ${nodeArray.length}`);
  
  return (
    <>
      <Grid args={[20, 20]} cellColor="#6b7280" sectionColor="#3b82f6" />
      
      <ConnectionLines />
      
      {nexus && (
        <mesh 
          position={nexus.position}
          onClick={() => selectNode(nexus.id)}
        >
          <sphereGeometry args={[2, 16, 16]} />
          <meshStandardMaterial 
            color="#10b981"
            wireframe 
            emissive="#10b981"
            emissiveIntensity={0.3}
            wireframeLinewidth={3}
          />
        </mesh>
      )}
      
      {nodeArray.map((node) => {
        const level = getNodeLevel(node.id);
        // L1 = 0.75, L2+ = 0.5 (1/3 smaller)
        const size = level === 1 ? 0.75 : 0.5;
        
        return (
          <mesh 
            key={node.id}
            position={node.position} 
            onClick={() => selectNode(node.id)}
          >
            <octahedronGeometry args={[size]} />
            <meshStandardMaterial 
              color="#d946ef" 
              wireframe 
              emissive="#d946ef"
              emissiveIntensity={0.5}
              wireframeLinewidth={3}
            />
          </mesh>
        );
      })}
      
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={2} />
    </>
  );
}

function Controls() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const nexus = useCanvasStore((state) => state.nexus);
  
  return (
    <>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000 }}>
        {!nexus && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#10b981',
              color: 'white',
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
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Controls />
      <ReplyModal /><ContentOverlay />
      <Canvas camera={{ position: [10, 8, 15], fov: 60 }}>
        <Scene />
        <OrbitControls />
      </Canvas>
    </div>
  );
}