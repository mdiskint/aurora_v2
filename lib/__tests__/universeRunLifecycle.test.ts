/**
 * Unit tests for Universe Run Lifecycle
 *
 * Tests the complete lifecycle: create → track artifacts → complete → reset → new run
 *
 * Run with: npx tsx lib/__tests__/universeRunLifecycle.test.ts
 */

import { UniverseRun, StudyGuideWriteUp, Node, QuizResult, IntuitionResponse, ImitationAttempt, SynthesisAnalysis } from '../types';
import { generateUniverseStudyGuide, UniverseDefinition } from '../studyGuideGenerator';

// Simple assertion helpers
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// ============================================
// MOCK DATA FACTORIES
// ============================================

function createMockNode(id: string, title: string, parentId: string, nodeType: string = 'doctrine'): Node {
  return {
    id,
    position: [0, 0, 0] as [number, number, number],
    title,
    content: `Content for ${title}. This is a doctrine about important legal concepts.`,
    parentId,
    children: [],
    nodeType: nodeType as any,
    isLocked: false,
    isCompleted: false,
    practiceSteps: [
      { content: 'Intuition example content', nodeType: 'intuition-example' as any },
      { content: 'Model answer content', nodeType: 'model-answer' as any },
      { content: 'Imitation prompt content', nodeType: 'imitate' as any },
      { content: 'Quiz question', nodeType: 'quiz-mc' as any, options: ['A', 'B', 'C', 'D'], correctOption: 'B' },
    ],
  };
}

function createMockUniverseDefinition(): UniverseDefinition {
  const nodes: { [id: string]: Node } = {
    'doctrine-1': createMockNode('doctrine-1', 'Contract Formation', 'nexus-main'),
    'doctrine-2': createMockNode('doctrine-2', 'Consideration', 'nexus-main'),
    'doctrine-3': createMockNode('doctrine-3', 'Breach of Contract', 'nexus-main'),
  };

  return {
    id: 'universe-contracts-101',
    title: 'Contract Law Fundamentals',
    nexuses: [{
      id: 'nexus-main',
      title: 'Contract Law',
      content: 'Introduction to contract law principles.',
    }],
    nodes,
  };
}

function createEmptyRun(universeId: string): UniverseRun {
  return {
    id: `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    universeId,
    startedAt: Date.now(),
    status: 'in_progress',
    intuitionResponses: [],
    imitationAttempts: [],
    quizResults: [],
    synthesisAnalyses: [],
  };
}

function addIntuitionResponse(run: UniverseRun, nodeId: string, doctrineTitle: string): void {
  run.intuitionResponses.push({
    nodeId,
    doctrineTitle,
    question: 'What is your initial reaction to this concept?',
    selectedOption: 'It seems reasonable',
    elaboration: 'I think this makes sense because it protects both parties.',
    aiFeedback: 'Good insight! You identified the key protective function.',
    timestamp: Date.now(),
  });
}

function addImitationAttempt(run: UniverseRun, nodeId: string, doctrineTitle: string): void {
  run.imitationAttempts.push({
    nodeId,
    doctrineTitle,
    prompt: 'Apply this concept to a hypothetical scenario.',
    userAnswer: 'In this case, I would analyze the elements...',
    aiFeedback: 'Excellent application of the framework!',
    timestamp: Date.now(),
  });
}

function addQuizResult(run: UniverseRun, nodeId: string, doctrineTitle: string, wasCorrect: boolean): void {
  run.quizResults.push({
    nodeId,
    doctrineTitle,
    questionType: 'mcq',
    question: `Question about ${doctrineTitle}`,
    userAnswer: wasCorrect ? 'B' : 'A',
    correctAnswer: 'B',
    wasCorrect,
    explanation: wasCorrect ? 'Correct!' : 'The correct answer was B because...',
    timestamp: Date.now(),
  });
}

function addSynthesisAnalysis(run: UniverseRun, nodeId: string, doctrineTitle: string): void {
  run.synthesisAnalyses.push({
    nodeId,
    doctrineTitle,
    scenario: 'Complex scenario combining multiple concepts.',
    userAnalysis: 'This scenario implicates both formation and consideration...',
    aiFeedback: 'Strong synthesis showing how these concepts interconnect.',
    timestamp: Date.now(),
  });
}

function completeRun(run: UniverseRun, definition: UniverseDefinition): void {
  run.status = 'completed';
  run.completedAt = Date.now();

  const totalQuestions = run.quizResults.length;
  const correctAnswers = run.quizResults.filter(r => r.wasCorrect).length;

  const doctrineIds = new Set([
    ...run.intuitionResponses.map(r => r.nodeId),
    ...run.quizResults.map(r => r.nodeId),
  ]);

  run.metrics = {
    totalQuestions,
    correctAnswers,
    totalTimeSeconds: Math.round((run.completedAt - run.startedAt) / 1000),
    doctrinesCompleted: doctrineIds.size,
    totalDoctrines: Object.values(definition.nodes).filter(n => n.parentId === definition.nexuses[0]?.id).length,
  };
}

// ============================================
// TESTS
// ============================================

function testRunCreation(): void {
  console.log('Test: Run creation...');

  const definition = createMockUniverseDefinition();
  const run = createEmptyRun(definition.id);

  assert(run.id.startsWith('run-'), 'Run ID should start with "run-"');
  assertEqual(run.universeId, definition.id, 'Universe ID should match');
  assertEqual(run.status, 'in_progress', 'Status should be in_progress');
  assert(run.startedAt > 0, 'Start timestamp should be set');
  assertEqual(run.intuitionResponses.length, 0, 'Initial intuition responses');
  assertEqual(run.imitationAttempts.length, 0, 'Initial imitation attempts');
  assertEqual(run.quizResults.length, 0, 'Initial quiz results');
  assertEqual(run.synthesisAnalyses.length, 0, 'Initial synthesis analyses');

  console.log('  ✓ Run creation valid');
}

function testArtifactTracking(): void {
  console.log('Test: Artifact tracking...');

  const definition = createMockUniverseDefinition();
  const run = createEmptyRun(definition.id);

  // Add artifacts for doctrine 1
  addIntuitionResponse(run, 'doctrine-1', 'Contract Formation');
  addImitationAttempt(run, 'doctrine-1', 'Contract Formation');
  addQuizResult(run, 'doctrine-1', 'Contract Formation', true);
  addQuizResult(run, 'doctrine-1', 'Contract Formation', false);

  // Add artifacts for doctrine 2
  addIntuitionResponse(run, 'doctrine-2', 'Consideration');
  addImitationAttempt(run, 'doctrine-2', 'Consideration');
  addQuizResult(run, 'doctrine-2', 'Consideration', true);

  // Add synthesis
  addSynthesisAnalysis(run, 'synthesis-1', 'Contract Synthesis');

  assertEqual(run.intuitionResponses.length, 2, 'Intuition responses count');
  assertEqual(run.imitationAttempts.length, 2, 'Imitation attempts count');
  assertEqual(run.quizResults.length, 3, 'Quiz results count');
  assertEqual(run.synthesisAnalyses.length, 1, 'Synthesis analyses count');

  // Verify artifact content
  assert(run.intuitionResponses[0].doctrineTitle === 'Contract Formation', 'First intuition doctrine');
  assert(run.quizResults[0].wasCorrect === true, 'First quiz correct');
  assert(run.quizResults[1].wasCorrect === false, 'Second quiz incorrect');

  console.log('  ✓ Artifact tracking valid');
}

function testRunCompletion(): void {
  console.log('Test: Run completion with metrics...');

  const definition = createMockUniverseDefinition();
  const run = createEmptyRun(definition.id);

  // Simulate a realistic run
  addIntuitionResponse(run, 'doctrine-1', 'Contract Formation');
  addImitationAttempt(run, 'doctrine-1', 'Contract Formation');
  addQuizResult(run, 'doctrine-1', 'Contract Formation', true);
  addQuizResult(run, 'doctrine-1', 'Contract Formation', true);

  addIntuitionResponse(run, 'doctrine-2', 'Consideration');
  addImitationAttempt(run, 'doctrine-2', 'Consideration');
  addQuizResult(run, 'doctrine-2', 'Consideration', true);
  addQuizResult(run, 'doctrine-2', 'Consideration', false);

  addIntuitionResponse(run, 'doctrine-3', 'Breach of Contract');
  addImitationAttempt(run, 'doctrine-3', 'Breach of Contract');
  addQuizResult(run, 'doctrine-3', 'Breach of Contract', false);

  addSynthesisAnalysis(run, 'synthesis-1', 'Contract Law Synthesis');

  // Complete the run
  completeRun(run, definition);

  assertEqual(run.status, 'completed', 'Status should be completed');
  assert(run.completedAt !== undefined && run.completedAt > 0, 'Completion timestamp should be set');
  assert(run.metrics !== undefined, 'Metrics should be calculated');

  assertEqual(run.metrics!.totalQuestions, 5, 'Total questions');
  assertEqual(run.metrics!.correctAnswers, 3, 'Correct answers');
  assertEqual(run.metrics!.doctrinesCompleted, 3, 'Doctrines completed');
  assertEqual(run.metrics!.totalDoctrines, 3, 'Total doctrines');
  assert(run.metrics!.totalTimeSeconds !== undefined && run.metrics!.totalTimeSeconds >= 0, 'Time should be calculated');

  console.log('  ✓ Run completion with metrics valid');
}

function testStudyGuideGenerationFromRun(): void {
  console.log('Test: Study guide generation from completed run...');

  const definition = createMockUniverseDefinition();
  const run = createEmptyRun(definition.id);

  // Simulate a full run through all doctrines
  ['doctrine-1', 'doctrine-2', 'doctrine-3'].forEach((nodeId, index) => {
    const titles = ['Contract Formation', 'Consideration', 'Breach of Contract'];
    addIntuitionResponse(run, nodeId, titles[index]);
    addImitationAttempt(run, nodeId, titles[index]);
    addQuizResult(run, nodeId, titles[index], index < 2); // First 2 correct
  });

  addSynthesisAnalysis(run, 'synthesis-1', 'Contract Law Synthesis');

  completeRun(run, definition);

  // Generate study guide
  const studyGuide = generateUniverseStudyGuide(run, definition);

  // Verify study guide structure
  assert(studyGuide.id.startsWith('writeup-'), 'Write-up ID format');
  assertEqual(studyGuide.universeId, definition.id, 'Universe ID');
  assertEqual(studyGuide.universeRunId, run.id, 'Run ID');
  assertEqual(studyGuide.universeTitle, definition.title, 'Universe title');
  assert(studyGuide.content.length > 0, 'Content should not be empty');

  // Verify sections
  assert(studyGuide.doctrineSummaries !== undefined, 'Doctrine summaries should exist');
  assertEqual(studyGuide.doctrineSummaries!.length, 3, 'Should have 3 doctrine summaries');

  assert(studyGuide.quizSnapshot !== undefined, 'Quiz snapshot should exist');
  assertEqual(studyGuide.quizSnapshot!.totalQuestions, 3, 'Quiz total');
  assertEqual(studyGuide.quizSnapshot!.correctAnswers, 2, 'Quiz correct');
  assert(Math.abs(studyGuide.quizSnapshot!.accuracyPercentage - 66.67) < 1, 'Accuracy percentage');

  assert(studyGuide.practiceScenarios !== undefined, 'Practice scenarios should exist');
  assert(studyGuide.practiceScenarios!.length >= 3, 'Should have imitation scenarios');

  assert(studyGuide.synthesisSummary !== undefined, 'Synthesis summary should exist');
  assert(studyGuide.synthesisSummary!.keyInsights.length > 0, 'Should have key insights');

  // Verify content sections
  assert(studyGuide.content.includes('Doctrine Map'), 'Content includes Doctrine Map');
  assert(studyGuide.content.includes('Model Patterns'), 'Content includes Model Patterns');
  assert(studyGuide.content.includes('Mistake Profile'), 'Content includes Mistake Profile');
  assert(studyGuide.content.includes('Practice Scenarios'), 'Content includes Practice Scenarios');
  assert(studyGuide.content.includes('Quiz Snapshot'), 'Content includes Quiz Snapshot');
  assert(studyGuide.content.includes('Master Outline'), 'Content includes Master Outline');

  console.log('  ✓ Study guide generation from completed run valid');
}

function testMultipleRunsPreserved(): void {
  console.log('Test: Multiple runs preserved independently...');

  const definition = createMockUniverseDefinition();
  const runs: UniverseRun[] = [];

  // Create first run
  const run1 = createEmptyRun(definition.id);
  addIntuitionResponse(run1, 'doctrine-1', 'Contract Formation');
  addQuizResult(run1, 'doctrine-1', 'Contract Formation', true);
  completeRun(run1, definition);
  runs.push(run1);

  // Create second run with different results
  const run2 = createEmptyRun(definition.id);
  addIntuitionResponse(run2, 'doctrine-1', 'Contract Formation');
  addQuizResult(run2, 'doctrine-1', 'Contract Formation', false);
  addQuizResult(run2, 'doctrine-2', 'Consideration', true);
  completeRun(run2, definition);
  runs.push(run2);

  // Verify runs are independent
  assert(run1.id !== run2.id, 'Run IDs should be unique');
  assertEqual(run1.quizResults.length, 1, 'Run 1 quiz count');
  assertEqual(run2.quizResults.length, 2, 'Run 2 quiz count');
  assertEqual(run1.metrics!.correctAnswers, 1, 'Run 1 correct');
  assertEqual(run2.metrics!.correctAnswers, 1, 'Run 2 correct');

  // Both runs should generate valid study guides
  const guide1 = generateUniverseStudyGuide(run1, definition);
  const guide2 = generateUniverseStudyGuide(run2, definition);

  assert(guide1.id !== guide2.id, 'Guide IDs should be unique');
  assertEqual(guide1.quizSnapshot!.totalQuestions, 1, 'Guide 1 questions');
  assertEqual(guide2.quizSnapshot!.totalQuestions, 2, 'Guide 2 questions');

  console.log('  ✓ Multiple runs preserved independently');
}

function testResetPreservesDoctrineStructure(): void {
  console.log('Test: Reset preserves doctrine structure...');

  const definition = createMockUniverseDefinition();

  // First run
  const run1 = createEmptyRun(definition.id);
  addIntuitionResponse(run1, 'doctrine-1', 'Contract Formation');
  addQuizResult(run1, 'doctrine-1', 'Contract Formation', false);
  completeRun(run1, definition);

  // Simulate reset by creating new run
  const run2 = createEmptyRun(definition.id);

  // Same doctrines should be available
  addIntuitionResponse(run2, 'doctrine-1', 'Contract Formation');
  addIntuitionResponse(run2, 'doctrine-2', 'Consideration');
  addIntuitionResponse(run2, 'doctrine-3', 'Breach of Contract');

  // User can now get correct answers they missed before
  addQuizResult(run2, 'doctrine-1', 'Contract Formation', true);
  addQuizResult(run2, 'doctrine-2', 'Consideration', true);
  addQuizResult(run2, 'doctrine-3', 'Breach of Contract', true);

  completeRun(run2, definition);

  // Verify improvement
  assertEqual(run1.metrics!.correctAnswers, 0, 'Run 1 had 0 correct');
  assertEqual(run2.metrics!.correctAnswers, 3, 'Run 2 has 3 correct');
  assertEqual(run2.metrics!.doctrinesCompleted, 3, 'All doctrines completed');

  console.log('  ✓ Reset preserves doctrine structure');
}

function testDifferentContentPerRun(): void {
  console.log('Test: Different intuition responses per run...');

  const definition = createMockUniverseDefinition();

  // First run - user selects option A
  const run1 = createEmptyRun(definition.id);
  run1.intuitionResponses.push({
    nodeId: 'doctrine-1',
    doctrineTitle: 'Contract Formation',
    question: 'What is your reaction?',
    selectedOption: 'Option A - protective',
    elaboration: 'First run elaboration',
    aiFeedback: 'Feedback for first run',
    timestamp: Date.now(),
  });

  // Second run - user selects different option
  const run2 = createEmptyRun(definition.id);
  run2.intuitionResponses.push({
    nodeId: 'doctrine-1',
    doctrineTitle: 'Contract Formation',
    question: 'What is your reaction?', // Same question (regenerated by AI)
    selectedOption: 'Option B - restrictive', // Different choice
    elaboration: 'Second run elaboration - different perspective',
    aiFeedback: 'Feedback for second run',
    timestamp: Date.now(),
  });

  // Verify different responses tracked
  assert(
    run1.intuitionResponses[0].selectedOption !== run2.intuitionResponses[0].selectedOption,
    'Different options selected'
  );
  assert(
    run1.intuitionResponses[0].elaboration !== run2.intuitionResponses[0].elaboration,
    'Different elaborations'
  );

  // Both generate valid guides
  completeRun(run1, definition);
  completeRun(run2, definition);

  const guide1 = generateUniverseStudyGuide(run1, definition);
  const guide2 = generateUniverseStudyGuide(run2, definition);

  // Both guides should be valid
  assert(guide1.id !== guide2.id, 'Guide IDs should be unique');
  assert(guide1.content.length > 0, 'Guide 1 has content');
  assert(guide2.content.length > 0, 'Guide 2 has content');

  // Runs are independent - different timestamps at minimum
  assert(guide1.universeRunId !== guide2.universeRunId, 'Different run IDs');

  console.log('  ✓ Different content per run tracked');
}

function testEmptyRunHandling(): void {
  console.log('Test: Empty run handling...');

  const definition = createMockUniverseDefinition();
  const run = createEmptyRun(definition.id);

  // Complete without any activity
  completeRun(run, definition);

  assertEqual(run.metrics!.totalQuestions, 0, 'Zero questions');
  assertEqual(run.metrics!.correctAnswers, 0, 'Zero correct');
  assertEqual(run.metrics!.doctrinesCompleted, 0, 'Zero doctrines');

  // Should still generate valid study guide
  const guide = generateUniverseStudyGuide(run, definition);

  assert(guide.content.length > 0, 'Guide content exists');
  assertEqual(guide.quizSnapshot!.accuracyPercentage, 0, 'Zero accuracy');

  console.log('  ✓ Empty run handling valid');
}

function testRunWithPartialCompletion(): void {
  console.log('Test: Run with partial completion...');

  const definition = createMockUniverseDefinition();
  const run = createEmptyRun(definition.id);

  // Only complete 2 of 3 doctrines
  addIntuitionResponse(run, 'doctrine-1', 'Contract Formation');
  addQuizResult(run, 'doctrine-1', 'Contract Formation', true);

  addIntuitionResponse(run, 'doctrine-2', 'Consideration');
  addQuizResult(run, 'doctrine-2', 'Consideration', false);

  // doctrine-3 not started

  completeRun(run, definition);

  assertEqual(run.metrics!.doctrinesCompleted, 2, 'Only 2 doctrines completed');
  assertEqual(run.metrics!.totalDoctrines, 3, 'Total is still 3');
  assertEqual(run.metrics!.totalQuestions, 2, '2 quiz questions');

  const guide = generateUniverseStudyGuide(run, definition);
  assert(guide.doctrineSummaries!.length === 3, 'All doctrines listed (even incomplete)');

  console.log('  ✓ Partial completion handling valid');
}

// ============================================
// RUN ALL TESTS
// ============================================

function runAllTests(): void {
  console.log('\n=== Universe Run Lifecycle Tests ===\n');

  try {
    testRunCreation();
    testArtifactTracking();
    testRunCompletion();
    testStudyGuideGenerationFromRun();
    testMultipleRunsPreserved();
    testResetPreservesDoctrineStructure();
    testDifferentContentPerRun();
    testEmptyRunHandling();
    testRunWithPartialCompletion();

    console.log('\n=== All tests passed! ===\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
