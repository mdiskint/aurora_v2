import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useCanvasStore } from './store';
import { calculateCameraTarget } from './cameraUtils';
import * as THREE from 'three';

export function useCameraAnimation() {
  const { camera, controls } = useThree();
  const selectedId = useCanvasStore((state) => state.selectedId);
  const nexuses = useCanvasStore((state) => state.nexuses);
  const nodes = useCanvasStore((state) => state.nodes);
  const getNexusForNode = useCanvasStore((state) => state.getNexusForNode);
  const isAnimatingCamera = useCanvasStore((state) => state.isAnimatingCamera);
  const setIsAnimatingCamera = useCanvasStore((state) => state.setIsAnimatingCamera);
  const setShowContentOverlay = useCanvasStore((state) => state.setShowContentOverlay);
  const showContentOverlay = useCanvasStore((state) => state.showContentOverlay);
  
  const shouldShowOverlayRef = useRef(true);

  const getSelectedAndNextNode = () => {
    if (!selectedId) return { selected: null, next: null };

    let selectedNode = null;
    let nextNode = null;

    const selectedNexus = nexuses.find(n => n.id === selectedId);
    
    if (selectedNexus) {
      selectedNode = { position: selectedNexus.position };
      const allNodes = Object.values(nodes);
      const l1Nodes = allNodes.filter(n => n.parentId === selectedNexus.id);
      if (l1Nodes.length > 0) {
        nextNode = l1Nodes[0];
      }
    } else if (nodes[selectedId]) {
      selectedNode = nodes[selectedId];
      const allNodes = Object.values(nodes);
      
      const children = allNodes.filter(n => n.parentId === selectedId);
      
      if (children.length > 0) {
        nextNode = children[0];
      } else {
        const siblings = allNodes.filter(n => n.parentId === selectedNode!.parentId);
        const currentIndex = siblings.findIndex(n => n.id === selectedId);
        
        if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
          nextNode = siblings[currentIndex + 1];
        } else {
          const parentNexus = nexuses.find(n => n.id === selectedNode!.parentId);
          
          if (parentNexus) {
            const nexusIndex = nexuses.findIndex(n => n.id === parentNexus.id);
            if (nexusIndex >= 0 && nexusIndex < nexuses.length - 1) {
              nextNode = { position: nexuses[nexusIndex + 1].position };
            }
          } else {
            const nodeNexus = getNexusForNode(selectedId);
            if (nodeNexus) {
              nextNode = { position: nodeNexus.position };
            }
          }
        }
      }
    }

    return { selected: selectedNode, next: nextNode };
  };

  useEffect(() => {
    if (!setIsAnimatingCamera || !setShowContentOverlay) {
      console.log('Store not ready yet, skipping animation');
      return;
    }

    if (!selectedId) {
      if (controls) {
        (controls as any).enabled = true;
        console.log('Controls re-enabled (selection cleared)');
      }
      setIsAnimatingCamera(false);
      return;
    }
    
    if (nexuses.length === 0) return;

    shouldShowOverlayRef.current = showContentOverlay;
    setIsAnimatingCamera(true);
    setShowContentOverlay(false);

    if (controls) {
      (controls as any).enabled = false;
    }

    const { selected, next } = getSelectedAndNextNode();
    
    const selectedNexus = nexuses.find(n => n.id === selectedId);
    
    let arcCenterPosition: [number, number, number];
    
    if (selectedNexus) {
      arcCenterPosition = selectedNexus.position;
    } else if (nodes[selectedId]) {
      const nodeNexus = getNexusForNode(selectedId);
      arcCenterPosition = nodeNexus ? nodeNexus.position : nexuses[0].position;
    } else {
      arcCenterPosition = nexuses[0].position;
    }

    const target = calculateCameraTarget(
      selected ? { ...selected, id: selectedId } : null, 
      next, 
      arcCenterPosition,
      selectedNexus ? selectedId : undefined
    );

    console.log('Camera target calculated:', {
      selectedId,
      isNexus: !!selectedNexus,
      nexusPosition: selectedNexus ? selectedNexus.position : 'not a nexus',
      targetPosition: `[${target.position.x.toFixed(2)}, ${target.position.y.toFixed(2)}, ${target.position.z.toFixed(2)}]`,
      targetLookAt: `[${target.lookAt.x.toFixed(2)}, ${target.lookAt.y.toFixed(2)}, ${target.lookAt.z.toFixed(2)}]`
    });

    const startPos = camera.position.clone();
    const endPos = target.position;
    const startLookAt = new THREE.Vector3();
    if (controls) {
      startLookAt.copy((controls as any).target);
    }

    const midPoint = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5);
    
    const isJumpingToNexus = selectedNexus !== null;
    let controlPoint: THREE.Vector3;

    if (isJumpingToNexus) {
      controlPoint = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5);
      controlPoint.y += 8;
    } else {
      const centerPos = new THREE.Vector3(...arcCenterPosition);
      const toMid = midPoint.clone().sub(centerPos).normalize();
      const arcHeight = 8;
      controlPoint = midPoint.clone().add(toMid.multiplyScalar(arcHeight));
    }

    const curve = new THREE.QuadraticBezierCurve3(startPos, controlPoint, endPos);

    let progress = 0;
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);

      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const curvePoint = curve.getPoint(eased);
      camera.position.copy(curvePoint);

      if (controls) {
        const currentLookAt = new THREE.Vector3().lerpVectors(startLookAt, target.lookAt, eased);
        (controls as any).target.copy(currentLookAt);
        (controls as any).update();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        console.log('Camera animation complete');
        setIsAnimatingCamera(false);
        
        if (controls) {
          const selectedNexus = nexuses.find(n => n.id === selectedId);
          const isJumpingToNexus = selectedNexus !== null;
          const currentLookAt = isJumpingToNexus 
            ? target.lookAt.clone()
            : new THREE.Vector3().lerpVectors(startLookAt, target.lookAt, eased);
          (controls as any).target.copy(currentLookAt);
          (controls as any).update();
        }
        
        if (shouldShowOverlayRef.current) {
          setTimeout(() => {
            setShowContentOverlay(true);
          }, 100);
        }
        
        if (controls) {
          (controls as any).enabled = true;
        }
      }
    };

    animate();
}, [selectedId, setIsAnimatingCamera, setShowContentOverlay]);}