'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCanvasStore } from '@/lib/store';

interface ParticleData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  color: string;
  size: number;
}

// Scatter effect for a single node
function NodeScatterEffect({ position, color }: { position: [number, number, number]; color: string }) {
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    // Create particles that scatter outward from the node
    const particleCount = 30;
    const newParticles: ParticleData[] = [];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 3 + Math.random() * 5;

      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      );

      newParticles.push({
        position: new THREE.Vector3(...position),
        velocity,
        life: 1.0,
        color,
        size: 0.1 + Math.random() * 0.2
      });
    }

    setParticles(newParticles);
  }, [position, color]);

  useFrame((state, delta) => {
    if (!particles.length) return;

    setParticles(prevParticles =>
      prevParticles.map(p => {
        const newPos = p.position.clone().add(p.velocity.clone().multiplyScalar(delta));
        const newLife = Math.max(0, p.life - delta * 0.5);

        // Add gravity
        p.velocity.y -= 9.8 * delta * 0.5;

        return {
          ...p,
          position: newPos,
          life: newLife
        };
      }).filter(p => p.life > 0)
    );
  });

  return (
    <group ref={groupRef}>
      {particles.map((particle, i) => (
        <mesh key={i} position={particle.position}>
          <sphereGeometry args={[particle.size, 8, 8]} />
          <meshBasicMaterial
            color={particle.color}
            transparent
            opacity={particle.life * 0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

// Main scatter node that explodes into particles
function ScatteringNode({ node, delay }: { node: any; delay: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hasExploded, setHasExploded] = useState(false);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const startTime = useRef(0);

  useFrame((state) => {
    if (startTime.current === 0) {
      startTime.current = state.clock.elapsedTime;
      return;
    }

    const elapsed = state.clock.elapsedTime - startTime.current;

    if (elapsed < delay) return;

    const animTime = elapsed - delay;

    if (animTime < 0.5) {
      // Pulse and grow before exploding
      const pulse = 1 + Math.sin(animTime * 20) * 0.2;
      setScale(pulse * (1 + animTime * 0.5));
      setOpacity(1);
    } else if (animTime < 0.7) {
      // Quick flash before explosion
      setOpacity(1 - (animTime - 0.5) * 5);
    } else {
      if (!hasExploded) {
        setHasExploded(true);
      }
      setOpacity(0);
    }
  });

  const color = node.isAI ? '#00FFD4' : '#8B5CF6';

  return (
    <>
      {!hasExploded && (
        <mesh ref={meshRef} position={node.position} scale={scale}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.8}
            transparent
            opacity={opacity}
          />
        </mesh>
      )}
      {hasExploded && (
        <NodeScatterEffect position={node.position} color={color} />
      )}
    </>
  );
}

// Full transition effect showing all nodes scattering
export function TransitionAnimation() {
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const { camera } = useThree();

  // Camera shake effect
  const originalPosition = useRef(camera.position.clone());
  const shakeIntensity = useRef(0);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;

    // Increase shake intensity over time
    if (elapsed < 1.5) {
      shakeIntensity.current = elapsed * 0.3;
    } else {
      shakeIntensity.current = Math.max(0, 1.5 - (elapsed - 1.5));
    }

    if (shakeIntensity.current > 0) {
      camera.position.x = originalPosition.current.x + (Math.random() - 0.5) * shakeIntensity.current;
      camera.position.y = originalPosition.current.y + (Math.random() - 0.5) * shakeIntensity.current;
      camera.position.z = originalPosition.current.z + (Math.random() - 0.5) * shakeIntensity.current;
    }
  });

  const allNodes = [
    ...nexuses.map(n => ({ ...n, isNexus: true })),
    ...Object.values(nodes)
  ];

  return (
    <>
      {allNodes.map((node, i) => (
        <ScatteringNode
          key={node.id}
          node={node}
          delay={i * 0.05} // Stagger the explosions
        />
      ))}

      {/* Flash effect overlay */}
      <mesh position={[0, 0, -50]} scale={100}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

// Overlay message during transition
export function TransitionOverlay() {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Fade in
    const fadeIn = setTimeout(() => setOpacity(1), 300);
    return () => clearTimeout(fadeIn);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      zIndex: 1000,
      opacity,
      transition: 'opacity 0.5s ease'
    }}>
      <div style={{
        fontSize: '48px',
        color: '#00FFD4',
        fontWeight: 'bold',
        marginBottom: '20px',
        textShadow: '0 0 20px rgba(0, 255, 212, 0.8)'
      }}>
        🏛️ Entering Memory Palace
      </div>
      <div style={{
        fontSize: '20px',
        color: '#8B5CF6',
        fontWeight: 'normal'
      }}>
        Transforming conversation into walkable space...
      </div>
    </div>
  );
}
