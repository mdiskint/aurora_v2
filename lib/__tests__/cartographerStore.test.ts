import assert from 'node:assert/strict';
import { useCanvasStore } from '../store';
import type { CartographerOverlay, UniverseBlueprint } from '../types';

async function run() {
  console.log('\n=== Cartographer Store Tests ===\n');

  const originalSaveCurrentUniverse = useCanvasStore.getState().saveCurrentUniverse;
  const originalSaveToLocalStorage = useCanvasStore.getState().saveToLocalStorage;
  const originalAddNode = useCanvasStore.getState().addNode;
  let testNodeCounter = 0;

  useCanvasStore.setState({
    saveCurrentUniverse: () => undefined,
    saveToLocalStorage: async () => undefined,
    addNode: ((content: string, parentId: string) => {
      const id = `test-node-${++testNodeCounter}`;
      useCanvasStore.setState(state => ({
        nodes: {
          ...state.nodes,
          [id]: {
            id,
            position: [testNodeCounter, 0, 0],
            title: content.split('\n')[0],
            content,
            parentId,
            children: [],
          },
        },
      }));
      return id;
    }) as typeof originalAddNode,
    activeUniverseId: 'universe-1',
    activeUniverseIds: ['universe-1'],
    nexuses: [{
      id: 'nexus-1',
      position: [0, 0, 0],
      title: 'Source nexus',
      content: 'A sufficiently detailed source nexus for Cartographer testing.',
      children: [],
    } as never],
    nodes: {},
    universeLibrary: {
      'universe-1': {
        title: 'Test universe',
        nexuses: [],
        nodes: {},
        cameraPosition: [0, 20, 30],
        createdAt: 1,
        lastModified: 1,
      },
    },
    isCartographerOpen: false,
    cartographerError: null,
  });

  try {
    useCanvasStore.getState().openCartographer();
    assert.equal(useCanvasStore.getState().isCartographerOpen, true);
    useCanvasStore.getState().closeCartographer();
    assert.equal(useCanvasStore.getState().isCartographerOpen, false);
    console.log('✓ Open and close preserve Cartographer state');

    const blueprint: UniverseBlueprint = {
      nexusId: 'nexus-1',
      proposedTitle: 'Blueprint',
      generatedAt: Date.now(),
      branches: [{
        id: 'branch-1',
        title: 'Selected branch',
        rationale: 'A grounded explanation.',
        selectedByDefault: true,
        childNodes: [{
          id: 'branch-1-child-1',
          title: 'Child branch',
          rationale: 'A deeper explanation.',
          selectedByDefault: true,
        }],
      }, {
        id: 'branch-2',
        title: 'Unselected branch',
        rationale: 'Should not be created.',
        selectedByDefault: false,
      }],
      suggestedConnections: [],
      unresolvedQuestions: [],
      sourceReferences: [],
    };
    useCanvasStore.setState({ cartographerBlueprint: blueprint });

    const created = useCanvasStore.getState().createNodesFromBlueprint(['branch-1']);
    assert.equal(created.length, 2);
    assert.equal(Object.keys(useCanvasStore.getState().nodes).length, 2);
    assert.equal(useCanvasStore.getState().nodes[created[1]].parentId, created[0]);
    console.log('✓ Explicit blueprint selection creates only the chosen branch tree');

    useCanvasStore.setState({
      nodes: {
        'node-a': {
          id: 'node-a',
          position: [-2, 0, 0],
          title: 'A',
          content: 'First concept',
          parentId: 'nexus-1',
          children: [],
        },
        'node-b': {
          id: 'node-b',
          position: [2, 0, 0],
          title: 'B',
          content: 'Second concept',
          parentId: 'nexus-1',
          children: [],
        },
      },
    });

    const overlay: CartographerOverlay = {
      universeId: 'universe-1',
      universeTitle: 'Test universe',
      generatedAt: Date.now(),
      clusters: [],
      gaps: [],
      nextMoves: [],
      bridges: [{
        id: 'bridge-1',
        title: 'A meets B',
        summary: 'The concepts reinforce one another.',
        nodeIds: ['node-a', 'node-b'],
      }],
    };
    useCanvasStore.setState({ cartographerOverlay: overlay });

    const bridgeId = useCanvasStore.getState().createBridgeFromCartographer('bridge-1');
    assert.ok(bridgeId);
    assert.deepEqual(useCanvasStore.getState().nodes[bridgeId!].connectionNodes, ['node-a', 'node-b']);
    assert.equal(useCanvasStore.getState().nodes[bridgeId!].isConnectionNode, true);
    console.log('✓ Confirmed bridge action creates a connection node');
  } finally {
    useCanvasStore.setState({
      saveCurrentUniverse: originalSaveCurrentUniverse,
      saveToLocalStorage: originalSaveToLocalStorage,
      addNode: originalAddNode,
    });
  }

  console.log('\n=== All Cartographer store tests passed! ===\n');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
