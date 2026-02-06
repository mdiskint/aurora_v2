// Fibonacci spiral positioning for L1 nodes around the nexus

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function fibonacciSpiralPosition(
  index: number,
  baseRadius = 4
): [number, number, number] {
  const angle = index * GOLDEN_ANGLE;
  const radius = baseRadius * Math.sqrt(index + 1);

  const x = Math.cos(angle) * radius;
  const y = 0;
  const z = Math.sin(angle) * radius;

  return [x, y, z];
}
