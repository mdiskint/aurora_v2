import { Node, NodeType } from './types';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  index: number;
}

interface ConversationData {
  source: string;
  title: string;
  messages: ConversationMessage[];
  highlightText?: string | null;
}

interface Nexus {
  id: string;
  position: [number, number, number];
  content: string;
  title: string;
  type?: 'academic' | 'social';
}

export interface TransformResult {
  nexuses: Nexus[];
  nodes: { [id: string]: Node };
  highlightNodeId?: string | null;
}

// ── Smart title generation ──────────────────────────────────────

const GREETING_PREFIXES = /^(sure!?|of course!?|here'?s|i'?ll|let me|absolutely!?|great!?|certainly!?|okay,?|yes,?)\s*/i;

function generateSmartTitle(content: string, role: 'user' | 'assistant'): string {
  const emoji = role === 'user' ? '\u{1F464}' : '\u{1F916}'; // 👤 🤖

  let text = content;

  if (role === 'user') {
    // Strip any remaining boilerplate prefixes that survived content.js filtering
    text = text.replace(/^HEARTH-ENABLED:[\s\S]*?\n\n/, '');
    text = text.replace(/^\[AFFECT COMPLEMENT\][\s\S]*?\[END AFFECT COMPLEMENT\]\s*/, '');
  }

  if (role === 'assistant') {
    // Skip greeting/filler prefixes to find the first substantive sentence
    text = text.replace(GREETING_PREFIXES, '');
  }

  // For short messages, use as-is
  text = text.trim();
  if (text.length <= 100 && role === 'user') {
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length <= 60) {
      return `${emoji} ${firstLine}`;
    }
    return `${emoji} ${firstLine.slice(0, 57)}...`;
  }

  // Find the first sentence that looks like a question or instruction (for user)
  // or the first substantive sentence (for assistant)
  const sentences = text.split(/(?<=[.!?])\s+/);
  let best = '';

  if (role === 'user') {
    // Prefer questions first, then first sentence
    best = sentences.find(s => s.includes('?')) || sentences[0] || '';
  } else {
    // First non-trivial sentence
    best = sentences.find(s => s.length > 10) || sentences[0] || '';
  }

  // Fall back to first line if sentence splitting didn't help
  if (!best) {
    best = text.split('\n')[0];
  }

  best = best.trim();
  if (best.length > 60) {
    best = best.slice(0, 57) + '...';
  }

  return `${emoji} ${best}`;
}

// ── Pair messages into prompt+response turns ────────────────────

interface Turn {
  userContent: string;
  assistantContent: string | null;
}

function pairMessages(messages: ConversationMessage[]): Turn[] {
  const turns: Turn[] = [];
  let pendingUser: string | null = null;

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Flush any previous user message that never got a response
      if (pendingUser !== null) {
        turns.push({ userContent: pendingUser, assistantContent: null });
      }
      pendingUser = msg.content;
    } else {
      // Assistant message
      if (pendingUser !== null) {
        turns.push({ userContent: pendingUser, assistantContent: msg.content });
        pendingUser = null;
      } else {
        // Orphan assistant message (conversation starts with assistant)
        turns.push({ userContent: '', assistantContent: msg.content });
      }
    }
  }

  // Flush trailing user message with no response
  if (pendingUser !== null) {
    turns.push({ userContent: pendingUser, assistantContent: null });
  }

  return turns;
}

// ── Main transformer ────────────────────────────────────────────

export function transformConversation(data: ConversationData): TransformResult {
  const nexusId = `conversation-${Date.now()}`;

  const nexus: Nexus = {
    id: nexusId,
    position: [0, 0, 0],
    title: data.title,
    content: `Imported ${data.source} conversation: ${data.title}`,
    type: 'social',
  };

  const nodes: { [id: string]: Node } = {};
  let highlightNodeId: string | null = null;

  const turns = pairMessages(data.messages);

  turns.forEach((turn, index) => {
    const nodeId = `${nexusId}-turn-${index}`;

    // Combine user prompt + AI response in a single content string
    let content: string;
    if (turn.assistantContent !== null) {
      content = turn.userContent + '\n---\n' + turn.assistantContent;
    } else {
      content = turn.userContent;
    }

    // Title derived from the user prompt portion
    const titleSource = turn.userContent || turn.assistantContent || '';
    const title = generateSmartTitle(titleSource, 'user');

    // Golden angle spiral positioning
    const baseRadius = 6;
    const radiusIncrement = 0.4;
    const radius = baseRadius + index * radiusIncrement;

    const nodesPerRing = 6;
    const ringIndex = Math.floor(index / nodesPerRing);
    const positionInRing = index % nodesPerRing;

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const ringRotationOffset = ringIndex * goldenAngle;
    const angle = (positionInRing * 2 * Math.PI) / nodesPerRing + ringRotationOffset;

    let y = 0;
    if (ringIndex > 0) {
      const step = Math.ceil(ringIndex / 2);
      const direction = ringIndex % 2 === 1 ? 1 : -1;
      y = step * 2.5 * direction;
    }

    const x = -radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    nodes[nodeId] = {
      id: nodeId,
      position: [x, y, z],
      title,
      content,
      parentId: nexusId,
      children: [],
      isAI: false,
      nodeType: 'user-reply' as NodeType,
    };

    // Highlight detection
    if (data.highlightText && !highlightNodeId && content.includes(data.highlightText)) {
      highlightNodeId = nodeId;
    }
  });

  return { nexuses: [nexus], nodes, highlightNodeId };
}
