import assert from 'node:assert/strict';
import {
  buildNexusContext,
  buildUniverseContext,
  getSelectionActionKind,
} from '../nexusActionHelpers';

function run() {
  console.log('\n=== Nexus Action Tests ===\n');

  assert.equal(getSelectionActionKind({ id: 'node-1' }, { id: 'nexus-1' }), 'node-thread');
  assert.equal(getSelectionActionKind(null, { id: 'nexus-1' }), 'nexus-child');
  assert.equal(getSelectionActionKind(null, null), 'none');
  console.log('✓ Nexus actions create children while node actions stay in-thread');

  const nodes = {
    'node-1': {
      id: 'node-1',
      parentId: 'nexus-1',
      title: 'First idea',
      content: 'First-level content',
    },
    'node-2': {
      id: 'node-2',
      parentId: 'node-1',
      title: 'Nested idea',
      content: 'Nested content',
    },
    'other-node': {
      id: 'other-node',
      parentId: 'nexus-2',
      title: 'Other universe',
      content: 'Must not leak into nexus one',
    },
  };

  const nexusOneContext = buildNexusContext(
    { id: 'nexus-1', title: 'Nexus One', content: 'Root nexus content' },
    nodes
  );

  assert.match(nexusOneContext, /Root nexus content/);
  assert.match(nexusOneContext, /First-level content/);
  assert.match(nexusOneContext, /Nested content/);
  assert.doesNotMatch(nexusOneContext, /Must not leak/);
  console.log('✓ Nexus quiz context includes the root and every descendant');

  const universeContext = buildUniverseContext(
    [
      { id: 'nexus-1', title: 'Nexus One', content: 'Root nexus content' },
      { id: 'nexus-2', title: 'Nexus Two', content: 'Second root content' },
    ],
    nodes
  );

  assert.match(universeContext, /Root nexus content/);
  assert.match(universeContext, /Second root content/);
  assert.match(universeContext, /Must not leak into nexus one/);
  console.log('✓ Ask AI context covers every universe without cross-link leakage');

  console.log('\n=== All nexus action tests passed! ===\n');
}

run();
