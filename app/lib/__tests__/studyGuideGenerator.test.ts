/**
 * Unit tests for Study Guide Generator
 *
 * Run with: npx ts-node lib/__tests__/studyGuideGenerator.test.ts
 */

import { generateUniverseStudyGuide, UniverseDefinition } from '../studyGuideGenerator';
import { UniverseRun, Node } from '../types';

// Simple assertion helper
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertNonEmpty(value: string | unknown[], message: string): void {
  if (typeof value === 'string') {
    assert(value.length > 0, `${message} should be non-empty string`);
  } else {
    assert(value.length > 0, `${message} should be non-empty array`);
  }
}

// Create mock data
function createMockUniverseRun(): UniverseRun {
  return {
    id: 'run-test-123',
    universeId: 'universe-test-456',
    startedAt: Date.now() - 3600000, // 1 hour ago
    completedAt: Date.now(),
    status: 'completed',

    intuitionResponses: [
      {
        nodeId: 'node-doctrine-1',
        doctrineTitle: 'Standing Doctrine',
        question: 'What is your gut reaction to the standing requirement?',
        selectedOption: 'It seems like a reasonable barrier',
        elaboration: 'I think it prevents courts from being overloaded with cases',
        aiFeedback: 'Good intuition! Standing does serve as a gatekeeping function.',
        timestamp: Date.now() - 3500000,
      },
      {
        nodeId: 'node-doctrine-2',
        doctrineTitle: 'Ripeness',
        question: 'How do you feel about the ripeness requirement?',
        selectedOption: 'It can be frustrating for plaintiffs',
        elaboration: 'Sometimes you need to wait for harm that might never come',
        aiFeedback: 'This tension is real - ripeness balances judicial resources against access to courts.',
        timestamp: Date.now() - 3000000,
      },
    ],

    imitationAttempts: [
      {
        nodeId: 'node-doctrine-1',
        doctrineTitle: 'Standing Doctrine',
        prompt: 'A taxpayer wants to challenge federal spending on a religious monument. Apply the standing analysis.',
        userAnswer: 'The taxpayer must show injury in fact, causation, and redressability. Here, the injury is too generalized...',
        aiFeedback: 'Good structure! You correctly identified the three-part test. Consider also discussing the taxpayer standing exception.',
        timestamp: Date.now() - 2500000,
      },
      {
        nodeId: 'node-doctrine-2',
        doctrineTitle: 'Ripeness',
        prompt: 'A company fears a new regulation might harm them. Is this case ripe?',
        userAnswer: 'The case may not be ripe because the harm is speculative. We need to analyze fitness for judicial decision and hardship.',
        aiFeedback: 'Excellent! You correctly identified the two-part ripeness test.',
        timestamp: Date.now() - 2000000,
      },
    ],

    quizResults: [
      {
        nodeId: 'node-doctrine-1',
        doctrineTitle: 'Standing Doctrine',
        questionType: 'mcq',
        question: 'Which of the following is NOT a requirement for Article III standing?',
        userAnswer: 'C',
        correctAnswer: 'C',
        wasCorrect: true,
        explanation: 'Correct! Mootness is a separate justiciability doctrine, not part of the standing analysis.',
        timestamp: Date.now() - 1500000,
      },
      {
        nodeId: 'node-doctrine-1',
        doctrineTitle: 'Standing Doctrine',
        questionType: 'mcq',
        question: 'Under Lujan v. Defenders of Wildlife, what must a plaintiff demonstrate for injury in fact?',
        userAnswer: 'B',
        correctAnswer: 'A',
        wasCorrect: false,
        explanation: 'The rule requires concrete and particularized injury, not just any injury. You misapplied the specificity requirement.',
        timestamp: Date.now() - 1400000,
      },
      {
        nodeId: 'node-doctrine-2',
        doctrineTitle: 'Ripeness',
        questionType: 'mcq',
        question: 'The Abbott Laboratories test for ripeness includes which factors?',
        userAnswer: 'A',
        correctAnswer: 'A',
        wasCorrect: true,
        explanation: 'Correct! The test evaluates fitness for judicial decision and hardship to the parties.',
        timestamp: Date.now() - 1300000,
      },
      {
        nodeId: 'node-doctrine-2',
        doctrineTitle: 'Ripeness',
        questionType: 'mcq',
        question: 'A pre-enforcement challenge is typically ripe when:',
        userAnswer: 'D',
        correctAnswer: 'B',
        wasCorrect: false,
        explanation: 'You missed the issue that credible threat of prosecution is needed, not just passage of time.',
        timestamp: Date.now() - 1200000,
      },
    ],

    synthesisAnalyses: [
      {
        nodeId: 'node-synthesis-1',
        doctrineTitle: 'Justiciability Synthesis',
        scenario: 'Environmental group wants to challenge agency decision before final rule is issued.',
        userAnalysis: 'This raises both standing and ripeness issues. For standing, the group needs to show concrete injury to members. For ripeness, we analyze Abbott Labs factors - the legal question is fit for review but hardship may be minimal before final rule.',
        aiFeedback: 'Strong analysis connecting multiple doctrines. Consider also whether the case might become moot if the rule is finalized.',
        timestamp: Date.now() - 1000000,
      },
    ],

    metrics: {
      totalQuestions: 4,
      correctAnswers: 2,
      totalTimeSeconds: 3600,
      doctrinesCompleted: 2,
      totalDoctrines: 2,
    },
  };
}

function createMockUniverseDefinition(): UniverseDefinition {
  const nodes: { [id: string]: Node } = {
    'node-doctrine-1': {
      id: 'node-doctrine-1',
      position: [0, 0, 5],
      title: 'Standing Doctrine',
      content: 'Article III standing requires three elements: injury in fact, causation, and redressability.\n\nInjury in fact must be concrete and particularized.\n\nThe injury must be fairly traceable to the defendant\'s conduct.\n\nIt must be likely that a favorable decision will redress the injury.',
      parentId: 'nexus-main',
      children: [],
      nodeType: 'doctrine',
      practiceSteps: [
        {
          content: 'Think about why courts require standing. What purpose does it serve?',
          nodeType: 'intuition-example',
        },
        {
          content: 'IRAC Analysis for Standing:\n\n1. Issue: Does plaintiff have standing?\n2. Rule: Three-part test from Lujan\n3. Application: Apply each element to facts\n4. Conclusion: Standing exists or not',
          nodeType: 'model-answer',
        },
        {
          content: 'Apply the standing analysis to this scenario...',
          nodeType: 'imitate',
        },
      ],
    },
    'node-doctrine-2': {
      id: 'node-doctrine-2',
      position: [5, 0, 0],
      title: 'Ripeness',
      content: 'Ripeness ensures cases are ready for judicial review.\n\nAbbott Laboratories test:\n- Fitness for judicial decision\n- Hardship to parties of withholding review\n\nPre-enforcement challenges require credible threat.',
      parentId: 'nexus-main',
      children: [],
      nodeType: 'doctrine',
      practiceSteps: [
        {
          content: 'Consider the timing aspect - why not let courts decide everything immediately?',
          nodeType: 'intuition-example',
        },
        {
          content: 'Balancing Test for Ripeness:\n\nWeigh fitness (legal question vs factual development needed) against hardship (cost of waiting vs benefit of more complete record)',
          nodeType: 'model-answer',
        },
        {
          content: 'Apply the ripeness test to this scenario...',
          nodeType: 'imitate',
        },
      ],
    },
  };

  return {
    id: 'universe-test-456',
    title: 'Justiciability and Standing',
    nexuses: [
      {
        id: 'nexus-main',
        title: 'Justiciability Doctrines',
        content: 'This universe covers the key justiciability requirements including standing, ripeness, and mootness.',
      },
    ],
    nodes,
  };
}

// Test functions
function testGeneratorProducesValidWriteUp(): void {
  console.log('Test: Generator produces valid write-up...');

  const run = createMockUniverseRun();
  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(run, definition);

  // Basic structure assertions
  assert(writeUp.id.startsWith('writeup-'), 'Write-up ID should start with "writeup-"');
  assert(writeUp.universeId === definition.id, 'Universe ID should match');
  assert(writeUp.universeRunId === run.id, 'Run ID should match');
  assert(writeUp.createdAt > 0, 'Created timestamp should be set');
  assertNonEmpty(writeUp.content, 'Content');
  assert(writeUp.universeTitle === definition.title, 'Universe title should match');

  console.log('  ✓ Basic structure valid');
}

function testDoctrineMapSection(): void {
  console.log('Test: Doctrine Map section is present and complete...');

  const run = createMockUniverseRun();
  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(run, definition);

  // Check doctrine summaries
  assert(writeUp.doctrineSummaries !== undefined, 'Doctrine summaries should exist');
  assert(writeUp.doctrineSummaries!.length === 2, 'Should have 2 doctrine summaries');

  for (const doctrine of writeUp.doctrineSummaries!) {
    assertNonEmpty(doctrine.title, 'Doctrine title');
    assert(doctrine.keyPoints.length > 0, `Doctrine "${doctrine.title}" should have key points`);
  }

  // Check content includes section
  assert(writeUp.content.includes('## 1. Doctrine Map'), 'Content should include Doctrine Map section');
  assert(writeUp.content.includes('Standing Doctrine'), 'Content should include Standing Doctrine');
  assert(writeUp.content.includes('Ripeness'), 'Content should include Ripeness');

  console.log('  ✓ Doctrine Map section valid');
}

function testModelPatternsSection(): void {
  console.log('Test: Model Patterns section is present and complete...');

  const run = createMockUniverseRun();
  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(run, definition);

  // Check model patterns
  assert(writeUp.modelPatterns !== undefined, 'Model patterns should exist');
  assert(writeUp.modelPatterns!.length > 0, 'Should have at least 1 model pattern');

  for (const pattern of writeUp.modelPatterns!) {
    assertNonEmpty(pattern.name, 'Pattern name');
    assertNonEmpty(pattern.description, 'Pattern description');
    assertNonEmpty(pattern.example, 'Pattern example');
  }

  // Check content includes section
  assert(writeUp.content.includes('## 2. Model Patterns'), 'Content should include Model Patterns section');

  console.log('  ✓ Model Patterns section valid');
}

function testMistakeProfileSection(): void {
  console.log('Test: Mistake Profile section is present...');

  const run = createMockUniverseRun();
  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(run, definition);

  // Check mistake profile exists (may be empty if all correct)
  assert(writeUp.mistakeProfile !== undefined, 'Mistake profile should exist');

  // Since our mock has 2 incorrect answers, should have some profiles
  assert(writeUp.mistakeProfile!.length > 0, 'Should have identified some error patterns');

  for (const profile of writeUp.mistakeProfile!) {
    assertNonEmpty(profile.pattern, 'Error pattern');
    assert(profile.frequency > 0, 'Frequency should be positive');
    assertNonEmpty(profile.correction, 'Correction suggestion');
  }

  // Check content includes section
  assert(writeUp.content.includes('## 3. Mistake Profile'), 'Content should include Mistake Profile section');

  console.log('  ✓ Mistake Profile section valid');
}

function testPracticeScenariosSection(): void {
  console.log('Test: Practice Scenarios section is present and complete...');

  const run = createMockUniverseRun();
  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(run, definition);

  // Check practice scenarios
  assert(writeUp.practiceScenarios !== undefined, 'Practice scenarios should exist');
  // Should have imitation attempts + synthesis = 3 scenarios
  assert(writeUp.practiceScenarios!.length >= 2, 'Should have at least 2 practice scenarios');

  for (const scenario of writeUp.practiceScenarios!) {
    assertNonEmpty(scenario.scenario, 'Scenario description');
    assertNonEmpty(scenario.focusArea, 'Focus area');
    assertNonEmpty(scenario.suggestedApproach, 'Suggested approach');
  }

  // Check content includes section
  assert(writeUp.content.includes('## 4. Practice Scenarios'), 'Content should include Practice Scenarios section');

  console.log('  ✓ Practice Scenarios section valid');
}

function testQuizSnapshotSection(): void {
  console.log('Test: Quiz Snapshot section is present and complete...');

  const run = createMockUniverseRun();
  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(run, definition);

  // Check quiz snapshot
  assert(writeUp.quizSnapshot !== undefined, 'Quiz snapshot should exist');
  assert(writeUp.quizSnapshot!.totalQuestions === 4, 'Should have 4 total questions');
  assert(writeUp.quizSnapshot!.correctAnswers === 2, 'Should have 2 correct answers');
  assert(writeUp.quizSnapshot!.accuracyPercentage === 50, 'Accuracy should be 50%');

  // Check content includes section
  assert(writeUp.content.includes('## 5. Quiz Snapshot'), 'Content should include Quiz Snapshot section');
  assert(writeUp.content.includes('2/4'), 'Content should show score');

  console.log('  ✓ Quiz Snapshot section valid');
}

function testMasterOutlineSection(): void {
  console.log('Test: Master Outline section is present...');

  const run = createMockUniverseRun();
  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(run, definition);

  // Check content includes section
  assert(writeUp.content.includes('## 6. Master Outline'), 'Content should include Master Outline section');
  assert(writeUp.content.includes('exam-ready'), 'Content should mention exam-ready');

  console.log('  ✓ Master Outline section valid');
}

function testSynthesisSummary(): void {
  console.log('Test: Synthesis Summary is present...');

  const run = createMockUniverseRun();
  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(run, definition);

  // Check synthesis summary
  assert(writeUp.synthesisSummary !== undefined, 'Synthesis summary should exist');
  assertNonEmpty(writeUp.synthesisSummary!.overallTheme, 'Overall theme');
  assert(writeUp.synthesisSummary!.keyInsights.length > 0, 'Should have key insights');
  assertNonEmpty(writeUp.synthesisSummary!.applicationStrength, 'Application strength');
  assert(writeUp.synthesisSummary!.nextSteps.length > 0, 'Should have next steps');

  console.log('  ✓ Synthesis Summary valid');
}

function testEmptyRun(): void {
  console.log('Test: Generator handles empty run gracefully...');

  const emptyRun: UniverseRun = {
    id: 'run-empty',
    universeId: 'universe-test-456',
    startedAt: Date.now(),
    status: 'completed',
    intuitionResponses: [],
    imitationAttempts: [],
    quizResults: [],
    synthesisAnalyses: [],
  };

  const definition = createMockUniverseDefinition();

  const writeUp = generateUniverseStudyGuide(emptyRun, definition);

  // Should still produce valid write-up
  assertNonEmpty(writeUp.content, 'Content');
  assert(writeUp.quizSnapshot!.totalQuestions === 0, 'Should have 0 questions');
  assert(writeUp.quizSnapshot!.accuracyPercentage === 0, 'Accuracy should be 0%');

  console.log('  ✓ Empty run handled gracefully');
}

// Run all tests
function runAllTests(): void {
  console.log('\n=== Study Guide Generator Tests ===\n');

  try {
    testGeneratorProducesValidWriteUp();
    testDoctrineMapSection();
    testModelPatternsSection();
    testMistakeProfileSection();
    testPracticeScenariosSection();
    testQuizSnapshotSection();
    testMasterOutlineSection();
    testSynthesisSummary();
    testEmptyRun();

    console.log('\n=== All tests passed! ===\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
runAllTests();
