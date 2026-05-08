// Centralized node positioning functions
// Used by store.ts for calculating node positions and repositioning siblings

/**
 * Calculate position for L1 nodes (direct children of nexuses).
 * Golden-angle spiral with scaling that expands as siblings increase.
 */
export function calculateL1Position(
  siblingIndex: number,
  totalSiblings: number,
  nexusPos: [number, number, number]
): [number, number, number] {
  const baseRadius = 6 + Math.max(0, totalSiblings - 6) * 0.15;
  const radiusIncrement = 0.4;
  const radius = baseRadius + (siblingIndex * radiusIncrement);

  const nodesPerRing = Math.max(6, Math.floor(6 + (totalSiblings - 6) / 6));
  const ringIndex = Math.floor(siblingIndex / nodesPerRing);
  const positionInRing = siblingIndex % nodesPerRing;

  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 137.5 degrees
  const ringRotationOffset = ringIndex * goldenAngle;
  const angle = (positionInRing * 2 * Math.PI) / nodesPerRing + ringRotationOffset;

  let y = 0;
  if (ringIndex > 0) {
    const step = Math.ceil(ringIndex / 2);
    const direction = ringIndex % 2 === 1 ? 1 : -1;
    y = step * 2.5 * direction;
  }

  const x = nexusPos[0] - radius * Math.cos(angle); // Flipped: first node on left
  const z = nexusPos[2] + radius * Math.sin(angle);

  return [x, y, z];
}

/**
 * Calculate position for L2+ nodes (children of other nodes).
 * Helix along the parent-to-nexus direction with scaling.
 */
export function calculateL2Position(
  siblingIndex: number,
  totalSiblings: number,
  parentPos: [number, number, number],
  nexusPos: [number, number, number]
): [number, number, number] {
  const directionX = parentPos[0] - nexusPos[0];
  const directionY = parentPos[1] - nexusPos[1];
  const directionZ = parentPos[2] - nexusPos[2];

  const dirLength = Math.sqrt(directionX * directionX + directionY * directionY + directionZ * directionZ);

  // Guard against zero-length direction vector
  if (dirLength < 0.001) {
    return [
      parentPos[0] + 2,
      parentPos[1] + 1,
      parentPos[2] + 2
    ];
  }

  const normDirX = directionX / dirLength;
  const normDirY = directionY / dirLength;
  const normDirZ = directionZ / dirLength;

  const baseDistance = 3 + Math.max(0, totalSiblings - 3) * 0.15;
  const distanceIncrement = 0.8;
  const distance = baseDistance + (siblingIndex * distanceIncrement);

  const turnsPerNode = 0.3;
  const helixRadius = 1.5 + totalSiblings * 0.08;
  const angle = siblingIndex * turnsPerNode * 2 * Math.PI;

  const upX = 0, upY = 1, upZ = 0;

  // Calculate right vector (perpendicular to direction)
  let rightX = normDirY * upZ - normDirZ * upY;
  let rightY = normDirZ * upX - normDirX * upZ;
  let rightZ = normDirX * upY - normDirY * upX;
  const rightLength = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ);

  // Guard against zero-length right vector (happens with vertical directions)
  if (rightLength < 0.001) {
    rightX = 1; rightY = 0; rightZ = 0;
  } else {
    rightX /= rightLength;
    rightY /= rightLength;
    rightZ /= rightLength;
  }

  // Calculate up-perpendicular vector
  const upPerpX = normDirY * rightZ - normDirZ * rightY;
  const upPerpY = normDirZ * rightX - normDirX * rightZ;
  const upPerpZ = normDirX * rightY - normDirY * rightX;

  // Helix offset (circle in plane perpendicular to direction)
  const helixOffsetX = helixRadius * (Math.cos(angle) * rightX + Math.sin(angle) * upPerpX);
  const helixOffsetY = helixRadius * (Math.cos(angle) * rightY + Math.sin(angle) * upPerpY);
  const helixOffsetZ = helixRadius * (Math.cos(angle) * rightZ + Math.sin(angle) * upPerpZ);

  const x = parentPos[0] + (normDirX * distance) + helixOffsetX;
  const y = parentPos[1] + (normDirY * distance) + helixOffsetY;
  const z = parentPos[2] + (normDirZ * distance) + helixOffsetZ;

  return [x, y, z];
}

/**
 * Calculate position for meta-inspiration node children.
 * Vertical spiral above the meta-inspiration node with scaling.
 */
export function calculateMetaPosition(
  siblingIndex: number,
  totalSiblings: number,
  parentPos: [number, number, number]
): [number, number, number] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 137.5 degrees

  const baseRadius = 2.0 + totalSiblings * 0.05;
  const radiusIncrement = 0.3;
  const radius = baseRadius + (siblingIndex * radiusIncrement);

  // Vertical spacing
  const yIncrement = 1.5;
  const y = parentPos[1] + (siblingIndex * yIncrement);

  // Spiral angle
  const angle = siblingIndex * goldenAngle;

  // Position in horizontal plane around the meta-star
  const x = parentPos[0] - Math.cos(angle) * radius; // Flipped: first node on left
  const z = parentPos[2] + Math.sin(angle) * radius;

  return [x, y, z];
}

/**
 * Validate a position for NaN values, returning a fallback if invalid.
 */
export function validatePosition(
  position: [number, number, number],
  fallbackParentPos?: [number, number, number]
): [number, number, number] {
  if (isNaN(position[0]) || isNaN(position[1]) || isNaN(position[2])) {
    if (fallbackParentPos && !isNaN(fallbackParentPos[0])) {
      return [
        fallbackParentPos[0] + 2,
        fallbackParentPos[1] + 1,
        fallbackParentPos[2] + 2
      ];
    }
    return [0, 1, 0];
  }
  return position;
}
