import type { Node } from './types';

type NexusLike = {
  id: string;
  title?: string;
  content?: string;
};

type ContextNode = Pick<Node, 'id' | 'parentId' | 'title' | 'content'>;

export type SelectionActionKind = 'node-thread' | 'nexus-child' | 'none';

export function getSelectionActionKind(
  node: Pick<Node, 'id'> | null | undefined,
  nexus: NexusLike | null | undefined
): SelectionActionKind {
  if (node) return 'node-thread';
  if (nexus) return 'nexus-child';
  return 'none';
}

export function buildNexusContext(
  nexus: NexusLike,
  nodes: Record<string, ContextNode>
): string {
  const parts: string[] = [];
  const visited = new Set<string>();
  const childrenByParent = new Map<string, ContextNode[]>();

  Object.values(nodes).forEach(node => {
    const siblings = childrenByParent.get(node.parentId) || [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  });

  const nexusContent = nexus.content?.trim();
  if (nexusContent) {
    parts.push(`[Nexus: ${nexus.title || nexus.id}]\n${nexusContent}`);
  }

  const collectChildren = (parentId: string, depth: number) => {
    const children = childrenByParent.get(parentId) || [];

    children.forEach(child => {
      if (visited.has(child.id)) return;
      visited.add(child.id);

      const content = child.content?.trim();
      if (content) {
        const indent = '  '.repeat(depth);
        parts.push(`${indent}[Node: ${child.title || child.id}]\n${indent}${content}`);
      }

      collectChildren(child.id, depth + 1);
    });
  };

  collectChildren(nexus.id, 1);
  return parts.join('\n\n---\n\n');
}

export function buildUniverseContext(
  nexuses: NexusLike[],
  nodes: Record<string, ContextNode>
): string {
  return nexuses
    .map(nexus => buildNexusContext(nexus, nodes))
    .filter(Boolean)
    .join('\n\n===== NEXT UNIVERSE =====\n\n');
}
