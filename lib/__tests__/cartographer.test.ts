import assert from 'node:assert/strict';
import {
  normalizeCartographerOverlay,
  normalizeUniverseBlueprint,
  validateCartographerPayload,
} from '../cartographer';

function run() {
  console.log('\n=== Cartographer Tests ===\n');

  const overlay = normalizeCartographerOverlay({
    clusters: [{ id: '', name: 'Cluster', summary: 'Summary', nodeIds: ['node-1'] }],
    bridges: [{ id: '', title: 'Bridge', summary: 'Summary', nodeIds: ['node-1', 'node-2'] }],
    gaps: [{ id: '', title: 'Gap', summary: 'Summary', type: 'unsupported', nodeIds: ['node-1'] }],
    nextMoves: [
      { id: '', action: 'unsupported', title: 'One', rationale: 'Reason', nodeIds: ['node-1'] },
      { id: '', action: 'create-node', title: 'Two', rationale: 'Reason', nodeIds: ['node-1'] },
      { id: '', action: 'connect-nodes', title: 'Three', rationale: 'Reason', nodeIds: ['node-1', 'node-2'] },
      { id: '', action: 'create-node', title: 'Four', rationale: 'Reason', nodeIds: ['node-1'] },
    ],
  } as never, 'universe-1', 'Universe');

  assert.equal(overlay.clusters[0].id, 'cluster-1');
  assert.equal(overlay.bridges[0].id, 'bridge-1');
  assert.equal(overlay.gaps[0].type, 'other');
  assert.equal(overlay.nextMoves[0].action, 'revisit-node');
  assert.equal(overlay.nextMoves.length, 3);
  console.log('✓ Overlay normalization and safe enum fallbacks');

  const blueprint = normalizeUniverseBlueprint({
    proposedTitle: 'Mapped source',
    branches: [{
      title: 'First branch',
      rationale: 'Explanation',
      sourceChunkId: 'chunk-1',
      selectedByDefault: false,
      childNodes: [{ title: 'Child', rationale: 'Child explanation' }],
    }],
    suggestedConnections: [{ title: 'Connection', rationale: 'Related', branchIds: ['branch-1'] }],
    unresolvedQuestions: [{ title: 'Question', rationale: 'Missing' }],
  }, 'nexus-1');

  assert.equal(blueprint.branches[0].id, 'branch-1');
  assert.equal(blueprint.branches[0].kind, 'source-chunk');
  assert.equal(blueprint.branches[0].selectedByDefault, false);
  assert.equal(blueprint.branches[0].childNodes?.[0].id, 'branch-1-child-1');
  assert.equal(blueprint.suggestedConnections[0].id, 'connection-1');
  console.log('✓ Blueprint normalization and nested branch identity');

  assert.equal(validateCartographerPayload(null).valid, false);
  assert.equal(validateCartographerPayload({ operation: 'unknown' }).valid, false);
  assert.equal(validateCartographerPayload({
    operation: 'unfold-nexus',
    nexus: { content: 'too short' },
  }).valid, false);
  assert.equal(validateCartographerPayload({
    operation: 'unfold-nexus',
    nexus: { content: 'source '.repeat(20) },
  }).valid, true);
  assert.equal(validateCartographerPayload({
    operation: 'analyze-universe',
    nexuses: [{ id: 'nexus-1' }],
    nodes: [{ id: 'node-1', content: 'Content' }],
  }).valid, true);

  const oversized = validateCartographerPayload({
    operation: 'analyze-universe',
    nexuses: [{ id: 'nexus-1' }],
    nodes: Array.from({ length: 251 }, (_, index) => ({ id: `node-${index}`, content: 'Content' })),
  });
  assert.equal(oversized.valid, false);
  if (!oversized.valid) assert.equal(oversized.status, 413);
  console.log('✓ Request validation and size limits');

  console.log('\n=== All Cartographer tests passed! ===\n');
}

run();
