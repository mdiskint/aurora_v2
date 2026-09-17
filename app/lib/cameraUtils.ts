import { Node } from './types';
import * as THREE from 'three';

interface CameraTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export function calculateCameraTarget(
  selectedNode: { position: [number, number, number]; id?: string } | null,
  nextNode: { position: [number, number, number] } | null,
  nexusPosition: [number, number, number],
  nexusId?: string
): CameraTarget {
  if (!selectedNode) {
    return {
      position: new THREE.Vector3(10, 8, 15),
      lookAt: new THREE.Vector3(0, 0, 0),
    };
  }

  const selectedPos = new THREE.Vector3(...selectedNode.position);
  const isViewingNexus = selectedNode.id === nexusId;
  const nexusPos = isViewingNexus ? selectedPos.clone() : new THREE.Vector3(...nexusPosition);
  
  const direction = selectedPos.clone().sub(nexusPos).normalize();
  
  const clampedDirection = direction.clone();
  clampedDirection.y = THREE.MathUtils.clamp(clampedDirection.y, -0.4, 0.4);
  clampedDirection.normalize();
  
  let objectRadius = 0.75;
  let distanceFromSurface = 12;

  if (isViewingNexus) {
    objectRadius = 2;
    distanceFromSurface = 8;
  } else {
    const distanceFromNexus = selectedPos.distanceTo(nexusPos);
    if (distanceFromNexus > 10) {
      objectRadius = 0.5;
      distanceFromSurface = 10;
    } else {
      objectRadius = 0.75;
      distanceFromSurface = 12;
    }
  }
  
  const totalDistance = distanceFromSurface + objectRadius;
  
  let cameraPosition: THREE.Vector3;
  
  if (isViewingNexus) {
    // Position camera VERY close to fill frame with just this Nexus
    const distance = 6;  // Close distance
    const angle = Math.PI / 4;  // 45 degrees
    
    cameraPosition = selectedPos.clone().add(new THREE.Vector3(
      distance * Math.cos(angle),
      distance * 0.8,  // Higher up to look down at Nexus
      distance * Math.sin(angle)
    ));
  } else if (nextNode) {
    const nextPos = new THREE.Vector3(...nextNode.position);
    const distance = selectedPos.distanceTo(nextPos);
    
    if (distance > 15) {
      const toNext = nextPos.clone().sub(selectedPos).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const perpendicular = new THREE.Vector3().crossVectors(toNext, up).normalize();
      
      const offsetAngle = Math.PI / 6;
      const backDirection = toNext.clone().negate();
      const offsetDirection = backDirection.clone().applyAxisAngle(up, offsetAngle);
      
      cameraPosition = selectedPos.clone().add(offsetDirection.multiplyScalar(12));
    } else {
      const lineDirection = nextPos.clone().sub(selectedPos).normalize();
      const offsetAngle = Math.PI / 6;
      
      const up = new THREE.Vector3(0, 1, 0);
      const perpendicular = new THREE.Vector3().crossVectors(lineDirection, up).normalize();
      
      const rotatedDirection = clampedDirection.clone();
      rotatedDirection.applyAxisAngle(perpendicular, offsetAngle);
      
      cameraPosition = selectedPos.clone().add(rotatedDirection.multiplyScalar(totalDistance));
    }
  } else {
    const up = new THREE.Vector3(0, 1, 0);
    const perpendicular = new THREE.Vector3().crossVectors(clampedDirection, up).normalize();
    
    const offsetAngle = Math.PI / 6;
    const offsetDirection = clampedDirection.clone().applyAxisAngle(perpendicular, offsetAngle);
    
    cameraPosition = selectedPos.clone().add(offsetDirection.multiplyScalar(totalDistance));
  }
  
  let lookAtPoint = selectedPos.clone();

  if (isViewingNexus) {
    lookAtPoint = selectedPos.clone();
  } else if (nextNode) {
    const nextPos = new THREE.Vector3(...nextNode.position);
    const midpoint = selectedPos.clone().lerp(nextPos, 0.5);
    lookAtPoint = midpoint.clone().lerp(selectedPos, 0.3);
  }

  return {
    position: cameraPosition,
    lookAt: lookAtPoint,
  };
}