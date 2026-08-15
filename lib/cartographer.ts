import type {
  CartographerOverlay,
  ProposedBranch,
  UniverseBlueprint,
} from './types';
import { isRecord } from './ai/json';

const ALLOWED_GAP_TYPES = new Set([
  'missing-distinction',
  'missing-example',
  'missing-counterargument',
  'missing-synthesis',
  'orphaned-branch',
  'other',
]);

const ALLOWED_ACTIONS = new Set(['create-node', 'connect-nodes', 'revisit-node']);

export function normalizeCartographerOverlay(
  rawOverlay: Omit<CartographerOverlay, 'universeId' | 'universeTitle' | 'generatedAt'>,
  universeId: string,
  universeTitle: string
): CartographerOverlay {
  return {
    universeId,
    universeTitle,
    generatedAt: Date.now(),
    clusters: rawOverlay.clusters.map((cluster, index) => ({
      ...cluster,
      id: cluster.id || `cluster-${index + 1}`,
    })),
    bridges: rawOverlay.bridges.map((bridge, index) => ({
      ...bridge,
      id: bridge.id || `bridge-${index + 1}`,
    })),
    gaps: rawOverlay.gaps.map((gap, index) => ({
      ...gap,
      id: gap.id || `gap-${index + 1}`,
      type: ALLOWED_GAP_TYPES.has(gap.type) ? gap.type : 'other',
    })),
    nextMoves: rawOverlay.nextMoves.slice(0, 3).map((move, index) => ({
      ...move,
      id: move.id || `move-${index + 1}`,
      action: ALLOWED_ACTIONS.has(move.action) ? move.action : 'revisit-node',
    })),
  };
}

function normalizeProposedBranches(branches: unknown[], prefix = 'branch'): ProposedBranch[] {
  return branches.filter(isRecord).map((branch, index) => {
    const id = typeof branch.id === 'string' && branch.id ? branch.id : `${prefix}-${index + 1}`;
    const sourceChunkId = typeof branch.sourceChunkId === 'string' ? branch.sourceChunkId : undefined;
    const sourceText = typeof branch.sourceText === 'string' ? branch.sourceText : undefined;

    return {
      id,
      title: typeof branch.title === 'string' ? branch.title : 'Untitled branch',
      rationale: typeof branch.rationale === 'string' ? branch.rationale : '',
      kind: branch.kind === 'concept' || branch.kind === 'source-chunk'
        ? branch.kind
        : sourceChunkId || sourceText
          ? 'source-chunk'
          : 'concept',
      sourceChunkId,
      sourceText,
      sourceEvidence: Array.isArray(branch.sourceEvidence) ? branch.sourceEvidence : [],
      selectedByDefault: branch.selectedByDefault !== false,
      childNodes: Array.isArray(branch.childNodes)
        ? normalizeProposedBranches(branch.childNodes, `${id}-child`)
        : [],
    } as ProposedBranch;
  });
}

export function normalizeUniverseBlueprint(
  rawBlueprint: Record<string, unknown>,
  nexusId: string
): UniverseBlueprint {
  return {
    nexusId,
    proposedTitle: typeof rawBlueprint.proposedTitle === 'string' ? rawBlueprint.proposedTitle : undefined,
    generatedAt: Date.now(),
    branches: normalizeProposedBranches(Array.isArray(rawBlueprint.branches) ? rawBlueprint.branches : []),
    suggestedConnections: (Array.isArray(rawBlueprint.suggestedConnections) ? rawBlueprint.suggestedConnections : [])
      .filter(isRecord)
      .map((connection, index) => ({
        id: typeof connection.id === 'string' && connection.id ? connection.id : `connection-${index + 1}`,
        title: typeof connection.title === 'string' ? connection.title : 'Untitled connection',
        rationale: typeof connection.rationale === 'string' ? connection.rationale : '',
        branchIds: Array.isArray(connection.branchIds)
          ? connection.branchIds.filter((id): id is string => typeof id === 'string')
          : [],
        sourceEvidence: Array.isArray(connection.sourceEvidence) ? connection.sourceEvidence : [],
      })),
    unresolvedQuestions: (Array.isArray(rawBlueprint.unresolvedQuestions) ? rawBlueprint.unresolvedQuestions : [])
      .filter(isRecord)
      .map((gap, index) => ({
        id: typeof gap.id === 'string' && gap.id ? gap.id : `gap-${index + 1}`,
        title: typeof gap.title === 'string' ? gap.title : 'Untitled question',
        rationale: typeof gap.rationale === 'string' ? gap.rationale : '',
        sourceEvidence: Array.isArray(gap.sourceEvidence) ? gap.sourceEvidence : [],
      })),
    sourceReferences: Array.isArray(rawBlueprint.sourceReferences) ? rawBlueprint.sourceReferences : [],
  };
}

export type CartographerValidationResult =
  | { valid: true; operation: 'analyze-universe' | 'unfold-nexus'; payload: Record<string, unknown> }
  | { valid: false; error: string; status: 400 | 413 };

export function validateCartographerPayload(value: unknown): CartographerValidationResult {
  if (!isRecord(value)) {
    return { valid: false, error: 'Cartographer payload must be a JSON object.', status: 400 };
  }

  const operation = value.operation;
  if (operation !== 'analyze-universe' && operation !== 'unfold-nexus') {
    return { valid: false, error: 'Unsupported Cartographer operation.', status: 400 };
  }

  if (value.analysisLens !== undefined && typeof value.analysisLens !== 'string') {
    return { valid: false, error: 'Analysis lens must be text.', status: 400 };
  }
  if (typeof value.analysisLens === 'string' && value.analysisLens.length > 500) {
    return { valid: false, error: 'Analysis lens is too long.', status: 413 };
  }

  if (operation === 'unfold-nexus') {
    if (!isRecord(value.nexus) || typeof value.nexus.content !== 'string') {
      return { valid: false, error: 'A nexus with source content is required.', status: 400 };
    }
    if (value.nexus.content.trim().length < 80) {
      return { valid: false, error: 'The nexus needs more source content before it can be unfolded.', status: 400 };
    }
    if (value.nexus.content.length > 120_000) {
      return { valid: false, error: 'The nexus is too large to unfold in one request.', status: 413 };
    }
  } else {
    if (!Array.isArray(value.nexuses) || value.nexuses.length === 0) {
      return { valid: false, error: 'At least one nexus is required.', status: 400 };
    }
    if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
      return { valid: false, error: 'At least one node is required.', status: 400 };
    }
    if (value.nexuses.length > 25 || value.nodes.length > 250) {
      return { valid: false, error: 'This universe is too large to map in one request.', status: 413 };
    }

    const contentLength = value.nodes.reduce((total, node) =>
      total + (isRecord(node) && typeof node.content === 'string' ? node.content.length : 0), 0);
    if (contentLength > 200_000) {
      return { valid: false, error: 'The universe content is too large to map in one request.', status: 413 };
    }
  }

  return { valid: true, operation, payload: value };
}
