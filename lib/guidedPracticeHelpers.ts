import { Node } from './types';

export type PracticeStepId =
  | 'intuition'
  | 'model'
  | 'imitate'
  | 'quiz'
  | 'scenario'
  | 'synthesis';

export interface DoctrinePracticeBundle {
  conceptNode?: Node;
  intuitionExampleNode?: Node;
  modelAnswerNode?: Node;
  imitateNode?: Node;
  quizMcNode?: Node;
  quizShortAnswerNode?: Node;
  scenarioNode?: Node;
  synthesisNode?: Node;
}

/**
 * Infer the practice role of a node based on its fields
 */
function inferNodeRole(node: Node): string | null {
  // Synthesis nodes
  if (node.isSynthesis || node.nodeType === 'synthesis') {
    return 'synthesis';
  }

  // Quiz nodes
  if (node.mcqQuestions && node.mcqQuestions.length > 0) {
    return 'quiz-mc';
  }
  if (node.shortAnswerQuestions && node.shortAnswerQuestions.length > 0) {
    return 'quiz-short-answer';
  }

  // Try to infer from title/content keywords
  const title = node.title?.toLowerCase() || '';
  const content = node.content?.toLowerCase() || '';

  if (title.includes('intuition') || title.includes('example') || content.startsWith('imagine') || content.startsWith('consider this')) {
    return 'intuition-example';
  }

  if (title.includes('model') || title.includes('pattern') || content.includes('here\'s how') || content.includes('model answer')) {
    return 'model-answer';
  }

  if (title.includes('imitate') || title.includes('try') || title.includes('your turn') || content.includes('now you try')) {
    return 'imitate';
  }

  if (title.includes('scenario') || title.includes('application') || content.includes('apply') || content.includes('situation:')) {
    return 'application-scenario';
  }

  return null;
}

/**
 * Build a DoctrinePracticeBundle from a doctrine node and its children
 */
export function buildDoctrinePracticeBundle(
  doctrineNode: Node,
  allNodes: Record<string, Node>
): DoctrinePracticeBundle | null {
  const bundle: DoctrinePracticeBundle = {
    conceptNode: doctrineNode,
  };

  // Get all direct children of the doctrine node
  const children = doctrineNode.children
    .map(childId => allNodes[childId])
    .filter(Boolean);

  if (children.length === 0) {
    return null; // No children, can't build bundle
  }

  // Categorize children by inferred role
  for (const child of children) {
    const role = inferNodeRole(child);

    switch (role) {
      case 'intuition-example':
        if (!bundle.intuitionExampleNode) bundle.intuitionExampleNode = child;
        break;
      case 'model-answer':
        if (!bundle.modelAnswerNode) bundle.modelAnswerNode = child;
        break;
      case 'imitate':
        if (!bundle.imitateNode) bundle.imitateNode = child;
        break;
      case 'quiz-mc':
        if (!bundle.quizMcNode) bundle.quizMcNode = child;
        break;
      case 'quiz-short-answer':
        if (!bundle.quizShortAnswerNode) bundle.quizShortAnswerNode = child;
        break;
      case 'application-scenario':
        if (!bundle.scenarioNode) bundle.scenarioNode = child;
        break;
      case 'synthesis':
        if (!bundle.synthesisNode) bundle.synthesisNode = child;
        break;
    }
  }

  // Check if we have enough nodes to make a meaningful bundle
  const hasMinimumNodes =
    (bundle.intuitionExampleNode !== undefined) ||
    (bundle.modelAnswerNode !== undefined) ||
    (bundle.quizMcNode !== undefined || bundle.quizShortAnswerNode !== undefined);

  return hasMinimumNodes ? bundle : null;
}

/**
 * Get available practice steps based on what's in the bundle
 */
export function getAvailablePracticeSteps(bundle: DoctrinePracticeBundle): PracticeStepId[] {
  const steps: PracticeStepId[] = [];

  if (bundle.intuitionExampleNode) steps.push('intuition');
  if (bundle.modelAnswerNode) steps.push('model');
  if (bundle.imitateNode) steps.push('imitate');
  if (bundle.quizMcNode || bundle.quizShortAnswerNode) steps.push('quiz');
  if (bundle.scenarioNode) steps.push('scenario');
  if (bundle.synthesisNode) steps.push('synthesis');

  return steps;
}
