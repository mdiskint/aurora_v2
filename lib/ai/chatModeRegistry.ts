import { hasArray, hasString, isRecord, makeObjectSchema } from './json';

export type ChatMode =
  | 'spatial'
  | 'break-off'
  | 'deep-thinking'
  | 'quiz'
  | 'quiz-mc'
  | 'quiz-short-answer'
  | 'analyze-universe'
  | 'application-scenario'
  | 'application-grade'
  | 'application-essay'
  | 'grade-application-essay'
  | 'grade-essay-basic'
  | 'essay-question'
  | 'intuition-question'
  | 'nexus-summarize'
  | 'nexus-application-lab'
  | 'doctrine'
  | 'ask-with-search'
  | 'cartographer'
  | 'standard'
  | 'synthesis'
  | 'connection'
  | 'atomize-content';

type ChatModeDefinition = {
  mode: ChatMode;
  description: string;
  responseShape: 'text' | 'json' | 'markdown';
  implemented: boolean;
};

export const CHAT_MODE_REGISTRY: Record<ChatMode, ChatModeDefinition> = {
  spatial: {
    mode: 'spatial',
    description: 'Generate or parse a spatial universe structure.',
    responseShape: 'json',
    implemented: true,
  },
  'break-off': {
    mode: 'break-off',
    description: 'Generate a new universe from one source node.',
    responseShape: 'json',
    implemented: true,
  },
  'deep-thinking': {
    mode: 'deep-thinking',
    description: 'Run progressive Socratic exploration.',
    responseShape: 'text',
    implemented: true,
  },
  quiz: {
    mode: 'quiz',
    description: 'Generate and grade free-form quiz questions.',
    responseShape: 'text',
    implemented: true,
  },
  'quiz-mc': {
    mode: 'quiz-mc',
    description: 'Generate a UWorld-style multiple-choice question.',
    responseShape: 'markdown',
    implemented: true,
  },
  'quiz-short-answer': {
    mode: 'quiz-short-answer',
    description: 'Generate a short-answer question and sample answer.',
    responseShape: 'markdown',
    implemented: true,
  },
  'analyze-universe': {
    mode: 'analyze-universe',
    description: 'Extract topics, examples, and principles from a universe.',
    responseShape: 'json',
    implemented: true,
  },
  'application-scenario': {
    mode: 'application-scenario',
    description: 'Generate an application scenario.',
    responseShape: 'text',
    implemented: true,
  },
  'application-grade': {
    mode: 'application-grade',
    description: 'Grade an application scenario response.',
    responseShape: 'text',
    implemented: true,
  },
  'application-essay': {
    mode: 'application-essay',
    description: 'Generate an application essay prompt and rubric.',
    responseShape: 'json',
    implemented: true,
  },
  'grade-application-essay': {
    mode: 'grade-application-essay',
    description: 'Grade a structured application essay.',
    responseShape: 'text',
    implemented: true,
  },
  'grade-essay-basic': {
    mode: 'grade-essay-basic',
    description: 'Grade a basic essay answer.',
    responseShape: 'text',
    implemented: true,
  },
  'essay-question': {
    mode: 'essay-question',
    description: 'Generate an essay question from analysis context.',
    responseShape: 'text',
    implemented: true,
  },
  'intuition-question': {
    mode: 'intuition-question',
    description: 'Generate an intuition-building MC question.',
    responseShape: 'json',
    implemented: true,
  },
  'nexus-summarize': {
    mode: 'nexus-summarize',
    description: 'Summarize a completed nexus into mastery outcomes.',
    responseShape: 'text',
    implemented: true,
  },
  'nexus-application-lab': {
    mode: 'nexus-application-lab',
    description: 'Generate an Application Lab config for a nexus.',
    responseShape: 'json',
    implemented: true,
  },
  doctrine: {
    mode: 'doctrine',
    description: 'Generate doctrine explanation.',
    responseShape: 'text',
    implemented: true,
  },
  'ask-with-search': {
    mode: 'ask-with-search',
    description: 'Answer using universe context plus Tavily web search.',
    responseShape: 'text',
    implemented: true,
  },
  cartographer: {
    mode: 'cartographer',
    description: 'Read one universe and propose clusters, bridges, gaps, and next moves.',
    responseShape: 'json',
    implemented: true,
  },
  standard: {
    mode: 'standard',
    description: 'Standard chat fallback used by some frontend flows.',
    responseShape: 'text',
    implemented: false,
  },
  synthesis: {
    mode: 'synthesis',
    description: 'Frontend-referenced synthesis mode; currently falls through unless handled elsewhere.',
    responseShape: 'text',
    implemented: false,
  },
  connection: {
    mode: 'connection',
    description: 'Frontend-referenced connection mode; currently falls through unless handled elsewhere.',
    responseShape: 'text',
    implemented: false,
  },
  'atomize-content': {
    mode: 'atomize-content',
    description: 'Frontend-referenced course atomization mode; explicit route handler not yet present.',
    responseShape: 'json',
    implemented: false,
  },
};

export function getChatModeDefinition(mode: unknown) {
  if (typeof mode !== 'string') return null;
  return CHAT_MODE_REGISTRY[mode as ChatMode] || null;
}

export type SpatialNode = {
  content: string;
  depth?: number;
  parentIndex?: number;
  nodeType?: string;
  children?: SpatialNode[];
};

export type SpatialData = {
  nexusTitle: string;
  nexusContent: string;
  nodes: SpatialNode[];
};

export const spatialDataSchema = makeObjectSchema<SpatialData>('SpatialData', (value): value is SpatialData =>
  hasString(value, 'nexusTitle') &&
  hasString(value, 'nexusContent') &&
  hasArray(value, 'nodes') &&
  (value.nodes as unknown[]).every((node) => isRecord(node) && hasString(node, 'content'))
);

export type BreakOffUniverse = {
  nexusTitle: string;
  nexusContent: string;
  nodes: Array<{ content: string }>;
};

export const breakOffUniverseSchema = makeObjectSchema<BreakOffUniverse>('BreakOffUniverse', (value): value is BreakOffUniverse =>
  hasString(value, 'nexusTitle') &&
  hasString(value, 'nexusContent') &&
  hasArray(value, 'nodes') &&
  (value.nodes as unknown[]).every((node) => isRecord(node) && hasString(node, 'content'))
);

export type IntuitionQuestion = {
  question: string;
  options: string[];
  preferredAnswer?: string;
  explanation?: string;
};

export const intuitionQuestionSchema = makeObjectSchema<IntuitionQuestion>('IntuitionQuestion', (value): value is IntuitionQuestion =>
  hasString(value, 'question') &&
  hasArray(value, 'options') &&
  (value.options as unknown[]).every((option) => typeof option === 'string')
);

export type ApplicationLabConfigJson = {
  doctrineSummary: string;
  scenarios: Array<{ id?: string; prompt: string; guidance?: string }>;
  finalEssayPrompt: string;
  rubric?: string;
};

export const applicationLabSchema = makeObjectSchema<ApplicationLabConfigJson>('ApplicationLabConfig', (value): value is ApplicationLabConfigJson =>
  hasString(value, 'doctrineSummary') &&
  hasArray(value, 'scenarios') &&
  (value.scenarios as unknown[]).every((scenario) => isRecord(scenario) && hasString(scenario, 'prompt')) &&
  hasString(value, 'finalEssayPrompt')
);

export type UniverseAnalysisJson = {
  topics?: unknown[];
  examples?: unknown[];
  principles?: unknown[];
};

export const universeAnalysisSchema = makeObjectSchema<UniverseAnalysisJson>('UniverseAnalysis', (value): value is UniverseAnalysisJson =>
  (!('topics' in value) || Array.isArray(value.topics)) &&
  (!('examples' in value) || Array.isArray(value.examples)) &&
  (!('principles' in value) || Array.isArray(value.principles))
);

export type ApplicationEssayJson = {
  question: string;
  rubric: string;
};

export const applicationEssaySchema = makeObjectSchema<ApplicationEssayJson>('ApplicationEssay', (value): value is ApplicationEssayJson =>
  hasString(value, 'question') && hasString(value, 'rubric')
);

export type CartographerJson = {
  clusters: Array<{ id?: string; name: string; summary: string; nodeIds: string[]; evidence?: unknown[] }>;
  bridges: Array<{ id?: string; title: string; summary: string; nodeIds: string[]; evidence?: unknown[] }>;
  gaps: Array<{ id?: string; title: string; summary: string; type?: string; nodeIds: string[]; evidence?: unknown[] }>;
  nextMoves: Array<{ id?: string; action: string; title: string; rationale: string; nodeIds: string[]; suggestedContent?: string; evidence?: unknown[] }>;
};

export type UniverseBlueprintJson = {
  proposedTitle?: string;
  branches: Array<{
    id?: string;
    title: string;
    rationale: string;
    sourceEvidence?: unknown[];
    childNodes?: unknown[];
    selectedByDefault?: boolean;
  }>;
  suggestedConnections: Array<{
    id?: string;
    title: string;
    rationale: string;
    branchIds: string[];
    sourceEvidence?: unknown[];
  }>;
  unresolvedQuestions: Array<{
    id?: string;
    title: string;
    rationale: string;
    sourceEvidence?: unknown[];
  }>;
  sourceReferences?: unknown[];
};

const hasStringArray = (value: Record<string, unknown>, key: string) =>
  Array.isArray(value[key]) && (value[key] as unknown[]).every((item) => typeof item === 'string');

export const cartographerSchema = makeObjectSchema<CartographerJson>('CartographerOverlay', (value): value is CartographerJson =>
  hasArray(value, 'clusters') &&
  hasArray(value, 'bridges') &&
  hasArray(value, 'gaps') &&
  hasArray(value, 'nextMoves') &&
  (value.clusters as unknown[]).every((item) => isRecord(item) && hasString(item, 'name') && hasString(item, 'summary') && hasStringArray(item, 'nodeIds')) &&
  (value.bridges as unknown[]).every((item) => isRecord(item) && hasString(item, 'title') && hasString(item, 'summary') && hasStringArray(item, 'nodeIds')) &&
  (value.gaps as unknown[]).every((item) => isRecord(item) && hasString(item, 'title') && hasString(item, 'summary') && hasStringArray(item, 'nodeIds')) &&
  (value.nextMoves as unknown[]).every((item) => isRecord(item) && hasString(item, 'action') && hasString(item, 'title') && hasString(item, 'rationale') && hasStringArray(item, 'nodeIds'))
);

function isBranchLike(item: unknown): item is Record<string, unknown> {
  return isRecord(item) &&
    hasString(item, 'title') &&
    hasString(item, 'rationale') &&
    (!('childNodes' in item) || (Array.isArray(item.childNodes) && item.childNodes.every(isBranchLike)));
}

export const universeBlueprintSchema = makeObjectSchema<UniverseBlueprintJson>('UniverseBlueprint', (value): value is UniverseBlueprintJson =>
  hasArray(value, 'branches') &&
  hasArray(value, 'suggestedConnections') &&
  hasArray(value, 'unresolvedQuestions') &&
  (value.branches as unknown[]).every(isBranchLike) &&
  (value.suggestedConnections as unknown[]).every((item) => isRecord(item) && hasString(item, 'title') && hasString(item, 'rationale') && hasStringArray(item, 'branchIds')) &&
  (value.unresolvedQuestions as unknown[]).every((item) => isRecord(item) && hasString(item, 'title') && hasString(item, 'rationale'))
);
