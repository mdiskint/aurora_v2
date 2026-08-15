'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/lib/store';
import { CartographerEvidence, CartographerOverlay as CartographerOverlayData, ProposedBranch, UniverseBlueprint } from '@/lib/types';

function EvidenceLine({ evidence }: { evidence?: CartographerEvidence[] | any[] }) {
  if (!evidence || evidence.length === 0) return null;
  const first = evidence[0];
  const source = first.source || first;
  const label = source?.kind === 'video'
    ? `${source.sourceTitle || first.nodeTitle || 'Video'}${source.timestampStart !== undefined ? ` @ ${Math.floor(source.timestampStart / 60)}:${String(source.timestampStart % 60).padStart(2, '0')}` : ''}`
    : source?.fileName || source?.sourceTitle || first.nodeTitle || first.nodeId || source?.kind || 'Source';

  return (
    <div style={{ marginTop: 8, color: 'rgba(203, 213, 225, 0.72)', fontSize: 12, lineHeight: 1.4 }}>
      Evidence: {label}
      {(first.excerpt || source?.quotedText) && <span> - {(first.excerpt || source.quotedText).slice(0, 140)}</span>}
    </div>
  );
}

export default function CartographerOverlay() {
  const overlay = useCanvasStore(state => state.cartographerOverlay);
  const blueprint = useCanvasStore(state => state.cartographerBlueprint);
  const isOpen = useCanvasStore(state => state.isCartographerOpen);
  const isMapping = useCanvasStore(state => state.isMappingUniverse);
  const error = useCanvasStore(state => state.cartographerError);
  const closeCartographer = useCanvasStore(state => state.closeCartographer);
  const clearCartographerOverlay = useCanvasStore(state => state.clearCartographerOverlay);
  const mapActiveUniverse = useCanvasStore(state => state.mapActiveUniverse);
  const unfoldActiveNexus = useCanvasStore(state => state.unfoldActiveNexus);
  const createNodesFromBlueprint = useCanvasStore(state => state.createNodesFromBlueprint);
  const createBridgeFromCartographer = useCanvasStore(state => state.createBridgeFromCartographer);
  const createGapNodeFromCartographer = useCanvasStore(state => state.createGapNodeFromCartographer);
  const createNextMoveNodeFromCartographer = useCanvasStore(state => state.createNextMoveNodeFromCartographer);
  const selectNode = useCanvasStore(state => state.selectNode);
  const nodes = useCanvasStore(state => state.nodes);
  const nexuses = useCanvasStore(state => state.nexuses);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [analysisLens, setAnalysisLens] = useState('');

  useEffect(() => {
    if (!blueprint) {
      setSelectedBranchIds([]);
      return;
    }

    setSelectedBranchIds(
      blueprint.branches
        .filter(branch => branch.selectedByDefault)
        .map(branch => branch.id)
    );
  }, [blueprint]);

  if (!isOpen && !overlay && !blueprint && !isMapping && !error) return null;

  const rootNexus = nexuses[0];
  const childCount = rootNexus ? Object.values(nodes).filter(node => node.parentId === rootNexus.id).length : 0;
  const denseNexus = !!rootNexus && rootNexus.content.trim().length > 700;
  const recommendUnfold = denseNexus && childCount < 4;

  const openFirstNode = (nodeIds: string[]) => {
    const nodeId = nodeIds.find(id => nodes[id]);
    if (nodeId) selectNode(nodeId, true);
  };

  return (
    <aside style={panelStyle} aria-label="AI Cartographer">
      <div style={headerStyle}>
        <div>
          <div style={{ color: '#d8b4fe', fontWeight: 800, fontSize: 18 }}>Cartographer</div>
          <div style={{ color: 'rgba(203, 213, 225, 0.72)', fontSize: 12, marginTop: 4 }}>
            {blueprint ? 'Unfolded nexus blueprint' : overlay ? overlay.universeTitle : 'Choose how Astryon should read this space'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(overlay || blueprint) && (
            <button onClick={clearCartographerOverlay} style={secondaryButtonStyle}>Clear</button>
          )}
          <button onClick={closeCartographer} style={secondaryButtonStyle}>Close</button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 18 }}>
        {isMapping && (
          <div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
            Astryon is reading the structure...
          </div>
        )}

        {error && <div style={errorStyle}>{error}</div>}

        {!isMapping && !overlay && !blueprint && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={introBoxStyle}>
              <div style={{ color: '#f8fafc', fontWeight: 800, marginBottom: 6 }}>
                {recommendUnfold ? 'This nexus can become a fuller universe.' : 'This universe already has structure.'}
              </div>
              <div style={{ color: '#cbd5e1', lineHeight: 1.5, fontSize: 14 }}>
                {recommendUnfold
                  ? 'Astryon can identify major branches, examples, tensions, and missing questions before creating any nodes.'
                  : 'Astryon can map its clusters, gaps, bridges, and next expansions without changing the graph.'}
              </div>
            </div>

            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: '#d8b4fe', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0 }}>
                Optional Lens
              </span>
              <textarea
                value={analysisLens}
                onChange={(event) => setAnalysisLens(event.target.value)}
                placeholder="Question, theme, or angle to read through. Leave blank for broad coverage."
                rows={3}
                style={lensInputStyle}
              />
            </label>

            <ActionButton primary={recommendUnfold} onClick={() => unfoldActiveNexus(analysisLens)} title="Unfold Nexus">
              Turn dense source material into a proposed universe blueprint.
            </ActionButton>
            <ActionButton primary={!recommendUnfold} onClick={() => mapActiveUniverse(analysisLens)} title="Map Universe">
              Analyze the current graph for clusters, bridges, gaps, and next moves.
            </ActionButton>
          </div>
        )}

        {!isMapping && blueprint && (
          <BlueprintView
            blueprint={blueprint}
            selectedBranchIds={selectedBranchIds}
            onToggleBranch={(branchId) => {
              setSelectedBranchIds(current => current.includes(branchId)
                ? current.filter(id => id !== branchId)
                : [...current, branchId]
              );
            }}
            onCreateSelected={() => createNodesFromBlueprint(selectedBranchIds)}
            onCreateAll={() => createNodesFromBlueprint()}
          />
        )}
        {!isMapping && overlay && (
          <MapView
            overlay={overlay}
            openFirstNode={openFirstNode}
            createBridge={createBridgeFromCartographer}
            createGapNode={createGapNodeFromCartographer}
            createNextMove={createNextMoveNodeFromCartographer}
          />
        )}
      </div>
    </aside>
  );
}

function BlueprintView({
  blueprint,
  selectedBranchIds,
  onToggleBranch,
  onCreateSelected,
  onCreateAll,
}: {
  blueprint: UniverseBlueprint;
  selectedBranchIds: string[];
  onToggleBranch: (branchId: string) => void;
  onCreateSelected: () => void;
  onCreateAll: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}>
        <button onClick={onCreateSelected} style={primaryActionStyle} disabled={selectedBranchIds.length === 0}>
          Create Selected
        </button>
        <button onClick={onCreateAll} style={secondaryActionStyle}>
          Create Full Universe
        </button>
      </div>

      <Section title="Proposed Universe Structure">
        <div style={resultItemStyle}>
          <div style={{ color: '#f8fafc', fontWeight: 800 }}>{blueprint.proposedTitle || 'Untitled Blueprint'}</div>
          <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 7 }}>
            Review this blueprint, select the branches worth spatializing, then create them as nodes.
          </div>
        </div>
        {blueprint.branches.map(branch => (
          <BranchItem
            key={branch.id}
            branch={branch}
            selected={selectedBranchIds.includes(branch.id)}
            onToggle={() => onToggleBranch(branch.id)}
          />
        ))}
      </Section>

      <Section title="Suggested Connections">
        {blueprint.suggestedConnections.map(connection => (
          <article key={connection.id} style={resultItemStyle}>
            <div style={{ color: '#f8fafc', fontWeight: 700 }}>{connection.title}</div>
            <p>{connection.rationale}</p>
            <div style={mutedSmallStyle}>Branches: {connection.branchIds.join(', ')}</div>
            <EvidenceLine evidence={connection.sourceEvidence} />
          </article>
        ))}
      </Section>

      <Section title="Unresolved Questions">
        {blueprint.unresolvedQuestions.map(gap => (
          <article key={gap.id} style={resultItemStyle}>
            <div style={{ color: '#f8fafc', fontWeight: 700 }}>{gap.title}</div>
            <p>{gap.rationale}</p>
            <EvidenceLine evidence={gap.sourceEvidence} />
          </article>
        ))}
      </Section>

      <div style={footerNoteStyle}>Nothing is added to the universe until you choose Create Selected or Create Full Universe.</div>
    </div>
  );
}

function BranchItem({
  branch,
  depth = 0,
  selected,
  onToggle,
}: {
  branch: ProposedBranch;
  depth?: number;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <article style={{ ...resultItemStyle, marginLeft: depth ? 12 : 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {depth === 0 && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggle}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: '#a855f7' }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#f8fafc', fontWeight: 700 }}>{branch.title}</div>
          <p>{branch.rationale}</p>
          {branch.sourceText && (
            <div style={sourceChunkPreviewStyle}>
              {branch.sourceText.slice(0, 320)}{branch.sourceText.length > 320 ? '...' : ''}
            </div>
          )}
        </div>
      </div>
      <div style={mutedSmallStyle}>
        {branch.kind === 'source-chunk' ? 'Source chunk' : 'Concept'} · {branch.selectedByDefault ? 'Selected by default' : 'Optional'}
      </div>
      <EvidenceLine evidence={branch.sourceEvidence} />
      {branch.childNodes && branch.childNodes.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {branch.childNodes.map(child => <BranchItem key={child.id} branch={child} depth={depth + 1} />)}
        </div>
      )}
    </article>
  );
}

function MapView({
  overlay,
  openFirstNode,
  createBridge,
  createGapNode,
  createNextMove,
}: {
  overlay: CartographerOverlayData;
  openFirstNode: (nodeIds: string[]) => void;
  createBridge: (bridgeId: string) => string | null;
  createGapNode: (gapId: string) => string | null;
  createNextMove: (moveId: string) => string | null;
}) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Section title="Clusters">
        {overlay.clusters.map(cluster => (
          <ResultItem key={cluster.id} title={cluster.name} nodeIds={cluster.nodeIds} actionLabel="Open" onAction={() => openFirstNode(cluster.nodeIds)}>
            <p>{cluster.summary}</p>
            <EvidenceLine evidence={cluster.evidence} />
          </ResultItem>
        ))}
      </Section>
      <Section title="Bridges">
        {overlay.bridges.map(bridge => (
          <ResultItem key={bridge.id} title={bridge.title} nodeIds={bridge.nodeIds} actionLabel="Create Bridge" onAction={() => createBridge(bridge.id)}>
            <p>{bridge.summary}</p>
            <EvidenceLine evidence={bridge.evidence} />
          </ResultItem>
        ))}
      </Section>
      <Section title="Gaps">
        {overlay.gaps.map(gap => (
          <ResultItem key={gap.id} title={gap.title} nodeIds={gap.nodeIds} actionLabel="Create Node" onAction={() => createGapNode(gap.id)}>
            <p>{gap.summary}</p>
            <div style={{ color: '#fbbf24', fontSize: 12, marginTop: 6 }}>{gap.type}</div>
            <EvidenceLine evidence={gap.evidence} />
          </ResultItem>
        ))}
      </Section>
      <Section title="Next Moves">
        {overlay.nextMoves.map(move => (
          <ResultItem
            key={move.id}
            title={move.title}
            nodeIds={move.nodeIds}
            actionLabel={move.action === 'connect-nodes' ? 'Create Bridge' : 'Create Node'}
            onAction={() => createNextMove(move.id)}
          >
            <p>{move.rationale}</p>
            <div style={{ color: '#a7f3d0', fontSize: 12, marginTop: 6 }}>{move.action}</div>
            {move.suggestedContent && <div style={suggestedContentStyle}>{move.suggestedContent}</div>}
            <EvidenceLine evidence={move.evidence} />
          </ResultItem>
        ))}
      </Section>
    </div>
  );
}

function ActionButton({ title, children, onClick, primary }: { title: string; children: React.ReactNode; onClick: () => void; primary: boolean }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left',
      border: primary ? '1px solid rgba(168, 85, 247, 0.85)' : '1px solid rgba(96, 239, 255, 0.28)',
      background: primary ? 'rgba(88, 28, 135, 0.46)' : 'rgba(15, 23, 42, 0.58)',
      color: '#f8fafc',
      borderRadius: 8,
      padding: 14,
      cursor: 'pointer',
      boxShadow: primary ? '0 0 18px rgba(168, 85, 247, 0.24)' : 'none',
    }}>
      <div style={{ fontWeight: 800, marginBottom: 5 }}>{title}</div>
      <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.45 }}>{children}</div>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ color: '#c084fc', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 10 }}>{title}</h2>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </section>
  );
}

function ResultItem({
  title,
  nodeIds,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  nodeIds: string[];
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <article style={resultItemStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ color: '#f8fafc', fontWeight: 700, lineHeight: 1.3 }}>{title}</div>
        <button onClick={onAction} style={openButtonStyle}>{actionLabel}</button>
      </div>
      <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5, marginTop: 7 }}>{children}</div>
      {nodeIds.length > 0 && <div style={mutedSmallStyle}>Nodes: {nodeIds.slice(0, 4).join(', ')}{nodeIds.length > 4 ? ` +${nodeIds.length - 4}` : ''}</div>}
    </article>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 96,
  right: 24,
  bottom: 24,
  width: 'min(500px, calc(100vw - 48px))',
  zIndex: 1200,
  background: 'rgba(8, 14, 32, 0.94)',
  border: '1px solid rgba(168, 85, 247, 0.52)',
  borderRadius: 8,
  boxShadow: '0 0 32px rgba(168, 85, 247, 0.22)',
  color: '#e5f7ff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '18px 20px',
  borderBottom: '1px solid rgba(168, 85, 247, 0.28)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.75)',
  color: '#cbd5e1',
  borderRadius: 6,
  padding: '7px 10px',
  cursor: 'pointer',
};

const resultItemStyle: React.CSSProperties = {
  border: '1px solid rgba(168, 85, 247, 0.2)',
  background: 'rgba(15, 23, 42, 0.56)',
  borderRadius: 8,
  padding: 12,
};

const openButtonStyle: React.CSSProperties = {
  flex: '0 0 auto',
  border: '1px solid rgba(168, 85, 247, 0.45)',
  background: 'rgba(88, 28, 135, 0.4)',
  color: '#f3e8ff',
  borderRadius: 6,
  padding: '5px 8px',
  cursor: 'pointer',
  fontSize: 12,
};

const mutedSmallStyle: React.CSSProperties = {
  color: 'rgba(148, 163, 184, 0.74)',
  fontSize: 11,
  marginTop: 8,
};

const errorStyle: React.CSSProperties = {
  border: '1px solid rgba(248, 113, 113, 0.45)',
  background: 'rgba(127, 29, 29, 0.3)',
  color: '#fecaca',
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
};

const introBoxStyle: React.CSSProperties = {
  border: '1px solid rgba(168, 85, 247, 0.32)',
  background: 'rgba(88, 28, 135, 0.22)',
  borderRadius: 8,
  padding: 14,
};

const suggestedContentStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  borderRadius: 6,
  background: 'rgba(15, 23, 42, 0.74)',
  color: '#dbeafe',
  fontSize: 13,
  lineHeight: 1.45,
};

const lensInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 82,
  border: '1px solid rgba(168, 85, 247, 0.32)',
  background: 'rgba(2, 6, 23, 0.62)',
  color: '#e5e7eb',
  borderRadius: 8,
  padding: 11,
  resize: 'vertical',
  outline: 'none',
  fontSize: 13,
  lineHeight: 1.45,
};

const footerNoteStyle: React.CSSProperties = {
  color: '#c4b5fd',
  border: '1px solid rgba(168, 85, 247, 0.24)',
  background: 'rgba(88, 28, 135, 0.18)',
  borderRadius: 8,
  padding: 12,
  fontSize: 13,
  lineHeight: 1.45,
};

const sourceChunkPreviewStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  borderRadius: 6,
  background: 'rgba(2, 6, 23, 0.58)',
  color: '#cbd5e1',
  fontSize: 12,
  lineHeight: 1.45,
  border: '1px solid rgba(148, 163, 184, 0.18)',
};

const primaryActionStyle: React.CSSProperties = {
  border: '1px solid rgba(168, 85, 247, 0.9)',
  background: 'linear-gradient(135deg, rgba(126, 34, 206, 0.78), rgba(168, 85, 247, 0.42))',
  color: '#f8fafc',
  borderRadius: 8,
  padding: '11px 12px',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 0 18px rgba(168, 85, 247, 0.3)',
};

const secondaryActionStyle: React.CSSProperties = {
  border: '1px solid rgba(168, 85, 247, 0.42)',
  background: 'rgba(15, 23, 42, 0.72)',
  color: '#e9d5ff',
  borderRadius: 8,
  padding: '11px 12px',
  fontWeight: 800,
  cursor: 'pointer',
};
