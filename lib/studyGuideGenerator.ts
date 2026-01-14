/**
 * Study Guide Generator
 *
 * Generates comprehensive study guide write-ups from completed universe runs.
 * This module is pure - it takes data structures and returns a StudyGuideWriteUp.
 */

import {
  UniverseRun,
  StudyGuideWriteUp,
  DoctrineSummary,
  ModelPattern,
  MistakeProfile,
  PracticeScenario,
  QuizSnapshot,
  SynthesisSummary,
  Node,
  QuizResult,
  ImitationAttempt,
  SynthesisAnalysis,
  IntuitionResponse,
} from './types';

// Universe definition passed to the generator
export interface UniverseDefinition {
  id: string;
  title: string;
  nexuses: Array<{
    id: string;
    title: string;
    content: string;
  }>;
  nodes: { [id: string]: Node };
}

// Helper to extract doctrine nodes (L1 nodes - direct children of nexus)
function getDoctrineNodes(definition: UniverseDefinition): Node[] {
  const nexusIds = new Set(definition.nexuses.map(n => n.id));
  return Object.values(definition.nodes)
    .filter(node => nexusIds.has(node.parentId))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Helper to get performance rating for a doctrine
function getDoctrinePerformance(
  doctrineId: string,
  quizResults: QuizResult[],
  imitationAttempts: ImitationAttempt[]
): 'strong' | 'moderate' | 'needs-work' | 'no-data' {
  const doctrineQuizzes = quizResults.filter(r => r.nodeId === doctrineId);
  const doctrineImitations = imitationAttempts.filter(a => a.nodeId === doctrineId);

  if (doctrineQuizzes.length === 0 && doctrineImitations.length === 0) {
    return 'no-data';
  }

  const quizCorrect = doctrineQuizzes.filter(r => r.wasCorrect).length;
  const quizTotal = doctrineQuizzes.length;
  const quizRate = quizTotal > 0 ? quizCorrect / quizTotal : 0.5;

  // Simple heuristic based on quiz performance
  if (quizRate >= 0.8) return 'strong';
  if (quizRate >= 0.5) return 'moderate';
  return 'needs-work';
}

// Generate Doctrine Map section
function generateDoctrineMap(
  definition: UniverseDefinition,
  run: UniverseRun
): DoctrineSummary[] {
  const doctrines = getDoctrineNodes(definition);

  return doctrines.map(doctrine => {
    const performance = getDoctrinePerformance(
      doctrine.id,
      run.quizResults,
      run.imitationAttempts
    );

    // Extract key points from content (first 2-3 sentences or bullet points)
    const contentLines = doctrine.content.split('\n').filter(l => l.trim());
    const keyPoints = contentLines.slice(0, 3).map(l => l.trim().replace(/^[-*]\s*/, ''));

    // Determine strengths and areas to improve based on performance
    const userStrengths: string[] = [];
    const areasToImprove: string[] = [];

    if (performance === 'strong') {
      userStrengths.push('Demonstrated solid understanding in quizzes');
    } else if (performance === 'moderate') {
      userStrengths.push('Shows foundational understanding');
      areasToImprove.push('Review edge cases and exceptions');
    } else if (performance === 'needs-work') {
      areasToImprove.push('Revisit core concepts and rules');
      areasToImprove.push('Practice more application scenarios');
    }

    return {
      title: doctrine.title || `Doctrine ${doctrine.id}`,
      keyPoints,
      userStrengths,
      areasToImprove,
    };
  });
}

// Generate Model Patterns section
function generateModelPatterns(
  definition: UniverseDefinition,
  run: UniverseRun
): ModelPattern[] {
  const doctrines = getDoctrineNodes(definition);
  const patterns: ModelPattern[] = [];

  for (const doctrine of doctrines) {
    // Look for model-answer nodes in practice steps
    const practiceSteps = doctrine.practiceSteps || [];
    const modelStep = practiceSteps.find(s => s.nodeType === 'model-answer');

    if (modelStep) {
      // Extract pattern from model content
      const content = modelStep.content;

      // Try to identify the pattern type
      let patternName = 'Analytical Framework';
      let description = 'Structured approach to analyzing this doctrine';

      if (content.toLowerCase().includes('irac') || content.toLowerCase().includes('issue')) {
        patternName = 'IRAC Analysis';
        description = 'Issue-Rule-Application-Conclusion structure for legal analysis';
      } else if (content.toLowerCase().includes('test') || content.toLowerCase().includes('element')) {
        patternName = 'Multi-Element Test';
        description = 'Systematic evaluation of required elements';
      } else if (content.toLowerCase().includes('balance') || content.toLowerCase().includes('weigh')) {
        patternName = 'Balancing Test';
        description = 'Weighing competing factors or interests';
      }

      patterns.push({
        name: patternName,
        description,
        example: content.substring(0, 300) + (content.length > 300 ? '...' : ''),
      });
    }
  }

  // Add a default pattern if none found
  if (patterns.length === 0) {
    patterns.push({
      name: 'General Analysis',
      description: 'Apply the relevant rule to the facts, considering all elements',
      example: 'Identify the issue -> State the rule -> Apply to facts -> Conclude',
    });
  }

  return patterns;
}

// Analyze mistakes and generate profile
function generateMistakeProfile(run: UniverseRun): MistakeProfile[] {
  const profiles: MistakeProfile[] = [];

  // Analyze quiz results for error patterns
  const incorrectQuizzes = run.quizResults.filter(r => !r.wasCorrect);

  // Categorize errors (simplified heuristic)
  const errorCategories: { [key: string]: string[] } = {
    'Misstated Rule': [],
    'Misapplied Rule': [],
    'Missed Issue': [],
    'Superficial Analysis': [],
  };

  for (const quiz of incorrectQuizzes) {
    // Simple categorization based on explanation keywords
    const explanation = quiz.explanation.toLowerCase();

    if (explanation.includes('rule') && (explanation.includes('incorrect') || explanation.includes('wrong'))) {
      errorCategories['Misstated Rule'].push(quiz.question);
    } else if (explanation.includes('apply') || explanation.includes('application')) {
      errorCategories['Misapplied Rule'].push(quiz.question);
    } else if (explanation.includes('miss') || explanation.includes('overlook')) {
      errorCategories['Missed Issue'].push(quiz.question);
    } else {
      errorCategories['Superficial Analysis'].push(quiz.question);
    }
  }

  // Create profiles for error types with occurrences
  for (const [pattern, examples] of Object.entries(errorCategories)) {
    if (examples.length > 0) {
      let correction = '';
      switch (pattern) {
        case 'Misstated Rule':
          correction = 'Review the exact elements and requirements of each rule before applying';
          break;
        case 'Misapplied Rule':
          correction = 'Practice connecting specific facts to rule elements more carefully';
          break;
        case 'Missed Issue':
          correction = 'Use a checklist approach to identify all relevant issues in fact patterns';
          break;
        case 'Superficial Analysis':
          correction = 'Develop each point more fully with specific facts and reasoning';
          break;
      }

      profiles.push({
        pattern,
        frequency: examples.length,
        correction,
        examples: examples.slice(0, 3), // Limit to 3 examples
      });
    }
  }

  // Sort by frequency (most common errors first)
  profiles.sort((a, b) => b.frequency - a.frequency);

  return profiles;
}

// Generate practice scenarios summary
function generatePracticeScenarios(run: UniverseRun): PracticeScenario[] {
  const scenarios: PracticeScenario[] = [];

  // Include imitation attempts
  for (const attempt of run.imitationAttempts) {
    scenarios.push({
      scenario: attempt.prompt.substring(0, 200) + (attempt.prompt.length > 200 ? '...' : ''),
      focusArea: attempt.doctrineTitle,
      suggestedApproach: attempt.aiFeedback.substring(0, 300) + (attempt.aiFeedback.length > 300 ? '...' : ''),
    });
  }

  // Include synthesis analyses
  for (const synthesis of run.synthesisAnalyses) {
    scenarios.push({
      scenario: synthesis.scenario.substring(0, 200) + (synthesis.scenario.length > 200 ? '...' : ''),
      focusArea: synthesis.doctrineTitle,
      suggestedApproach: synthesis.aiFeedback
        ? synthesis.aiFeedback.substring(0, 300) + (synthesis.aiFeedback.length > 300 ? '...' : '')
        : 'Review your analysis and compare with model approaches',
    });
  }

  return scenarios;
}

// Generate quiz snapshot
function generateQuizSnapshot(run: UniverseRun): QuizSnapshot {
  const totalQuestions = run.quizResults.length;
  const correctAnswers = run.quizResults.filter(r => r.wasCorrect).length;
  const accuracyPercentage = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;

  // Identify strong and weak topics
  const topicPerformance: { [topic: string]: { correct: number; total: number } } = {};

  for (const result of run.quizResults) {
    if (!topicPerformance[result.doctrineTitle]) {
      topicPerformance[result.doctrineTitle] = { correct: 0, total: 0 };
    }
    topicPerformance[result.doctrineTitle].total++;
    if (result.wasCorrect) {
      topicPerformance[result.doctrineTitle].correct++;
    }
  }

  const strongTopics: string[] = [];
  const weakTopics: string[] = [];

  for (const [topic, perf] of Object.entries(topicPerformance)) {
    const rate = perf.correct / perf.total;
    if (rate >= 0.7) {
      strongTopics.push(topic);
    } else if (rate < 0.5) {
      weakTopics.push(topic);
    }
  }

  return {
    totalQuestions,
    correctAnswers,
    accuracyPercentage,
    strongTopics,
    weakTopics,
  };
}

// Generate synthesis summary
function generateSynthesisSummary(run: UniverseRun): SynthesisSummary {
  const analyses = run.synthesisAnalyses;

  // Extract common themes from synthesis analyses
  const keyInsights: string[] = [];

  for (const analysis of analyses.slice(0, 3)) {
    // Extract first substantive insight from user analysis
    const firstSentence = analysis.userAnalysis.split('.')[0];
    if (firstSentence && firstSentence.length > 20) {
      keyInsights.push(firstSentence.trim() + '.');
    }
  }

  // Determine application strength based on feedback
  let applicationStrength = 'Developing';
  if (analyses.length >= 3) {
    applicationStrength = 'Solid foundation with room for deeper analysis';
  } else if (analyses.length >= 1) {
    applicationStrength = 'Good start - continue practicing application scenarios';
  }

  // Generate next steps
  const nextSteps: string[] = [
    'Review weak areas identified in quiz snapshot',
    'Practice more fact patterns with time pressure',
    'Focus on connecting rules to specific facts',
  ];

  return {
    overallTheme: 'Legal Analysis and Application',
    keyInsights: keyInsights.length > 0 ? keyInsights : ['Continue building analytical skills through practice'],
    applicationStrength,
    nextSteps,
  };
}

// Generate markdown content for the write-up
function generateMarkdownContent(
  definition: UniverseDefinition,
  run: UniverseRun,
  doctrineSummaries: DoctrineSummary[],
  modelPatterns: ModelPattern[],
  mistakeProfiles: MistakeProfile[],
  practiceScenarios: PracticeScenario[],
  quizSnapshot: QuizSnapshot,
  synthesisSummary: SynthesisSummary
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Study Guide: ${definition.title}`);
  lines.push('');
  lines.push(`*Generated on ${new Date().toLocaleDateString()}*`);
  lines.push('');

  // Performance Summary
  lines.push('## Performance Summary');
  lines.push('');
  lines.push(`- **Quiz Accuracy**: ${quizSnapshot.accuracyPercentage}% (${quizSnapshot.correctAnswers}/${quizSnapshot.totalQuestions})`);
  if (run.metrics?.totalTimeSeconds) {
    const minutes = Math.floor(run.metrics.totalTimeSeconds / 60);
    lines.push(`- **Time Spent**: ${minutes} minutes`);
  }
  lines.push('');

  // Section 1: Doctrine Map
  lines.push('## 1. Doctrine Map');
  lines.push('');
  for (const doctrine of doctrineSummaries) {
    lines.push(`### ${doctrine.title}`);
    lines.push('');
    if (doctrine.keyPoints.length > 0) {
      lines.push('**Key Points:**');
      for (const point of doctrine.keyPoints) {
        lines.push(`- ${point}`);
      }
      lines.push('');
    }
    if (doctrine.userStrengths.length > 0) {
      lines.push(`**Strengths:** ${doctrine.userStrengths.join('; ')}`);
      lines.push('');
    }
    if (doctrine.areasToImprove.length > 0) {
      lines.push(`**Areas to Improve:** ${doctrine.areasToImprove.join('; ')}`);
      lines.push('');
    }
  }

  // Section 2: Model Patterns
  lines.push('## 2. Model Patterns (How to Think)');
  lines.push('');
  for (const pattern of modelPatterns) {
    lines.push(`### ${pattern.name}`);
    lines.push('');
    lines.push(pattern.description);
    lines.push('');
    lines.push('**Example:**');
    lines.push('```');
    lines.push(pattern.example);
    lines.push('```');
    lines.push('');
  }

  // Section 3: Mistake Profile
  lines.push('## 3. Mistake Profile');
  lines.push('');
  if (mistakeProfiles.length === 0) {
    lines.push('*No significant error patterns identified. Great work!*');
    lines.push('');
  } else {
    for (const profile of mistakeProfiles) {
      lines.push(`### ${profile.pattern} (${profile.frequency} occurrence${profile.frequency > 1 ? 's' : ''})`);
      lines.push('');
      lines.push(`**How to Improve:** ${profile.correction}`);
      lines.push('');
      if (profile.examples.length > 0) {
        lines.push('**Examples:**');
        for (const example of profile.examples) {
          lines.push(`- ${example.substring(0, 100)}${example.length > 100 ? '...' : ''}`);
        }
        lines.push('');
      }
    }
  }

  // Section 4: Practice Scenarios
  lines.push('## 4. Practice Scenarios Completed');
  lines.push('');
  if (practiceScenarios.length === 0) {
    lines.push('*No practice scenarios completed in this run.*');
    lines.push('');
  } else {
    for (let i = 0; i < practiceScenarios.length; i++) {
      const scenario = practiceScenarios[i];
      lines.push(`### Scenario ${i + 1}: ${scenario.focusArea}`);
      lines.push('');
      lines.push(`**Fact Pattern:** ${scenario.scenario}`);
      lines.push('');
      lines.push(`**Key Approach:** ${scenario.suggestedApproach}`);
      lines.push('');
    }
  }

  // Section 5: Quiz Snapshot
  lines.push('## 5. Quiz Snapshot');
  lines.push('');
  lines.push(`**Overall Score:** ${quizSnapshot.correctAnswers}/${quizSnapshot.totalQuestions} (${quizSnapshot.accuracyPercentage}%)`);
  lines.push('');
  if (quizSnapshot.strongTopics.length > 0) {
    lines.push(`**Strong Topics:** ${quizSnapshot.strongTopics.join(', ')}`);
    lines.push('');
  }
  if (quizSnapshot.weakTopics.length > 0) {
    lines.push(`**Topics Needing Review:** ${quizSnapshot.weakTopics.join(', ')}`);
    lines.push('');
  }

  // Individual quiz results
  if (run.quizResults.length > 0) {
    lines.push('### Question Details');
    lines.push('');
    for (let i = 0; i < run.quizResults.length; i++) {
      const result = run.quizResults[i];
      const icon = result.wasCorrect ? '✓' : '✗';
      lines.push(`${i + 1}. ${icon} **${result.question.substring(0, 100)}${result.question.length > 100 ? '...' : ''}**`);
      lines.push(`   - Your answer: ${result.userAnswer}`);
      if (!result.wasCorrect && result.correctAnswer) {
        lines.push(`   - Correct: ${result.correctAnswer}`);
      }
      lines.push(`   - ${result.explanation.substring(0, 150)}${result.explanation.length > 150 ? '...' : ''}`);
      lines.push('');
    }
  }

  // Section 6: Master Outline
  lines.push('## 6. Master Outline');
  lines.push('');
  lines.push('*A clean, exam-ready outline for quick review:*');
  lines.push('');

  for (const doctrine of doctrineSummaries) {
    lines.push(`### ${doctrine.title}`);
    for (const point of doctrine.keyPoints) {
      lines.push(`  - ${point}`);
    }
    lines.push('');
  }

  // Key patterns summary
  lines.push('### Key Analytical Patterns');
  for (const pattern of modelPatterns) {
    lines.push(`  - **${pattern.name}**: ${pattern.description}`);
  }
  lines.push('');

  // Next steps
  lines.push('### Next Steps');
  for (const step of synthesisSummary.nextSteps) {
    lines.push(`  - ${step}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Main generator function - creates a complete study guide from a universe run
 */
export function generateUniverseStudyGuide(
  universeRun: UniverseRun,
  universeDefinition: UniverseDefinition
): StudyGuideWriteUp {
  // Generate all sections
  const doctrineSummaries = generateDoctrineMap(universeDefinition, universeRun);
  const modelPatterns = generateModelPatterns(universeDefinition, universeRun);
  const mistakeProfiles = generateMistakeProfile(universeRun);
  const practiceScenarios = generatePracticeScenarios(universeRun);
  const quizSnapshot = generateQuizSnapshot(universeRun);
  const synthesisSummary = generateSynthesisSummary(universeRun);

  // Generate markdown content
  const content = generateMarkdownContent(
    universeDefinition,
    universeRun,
    doctrineSummaries,
    modelPatterns,
    mistakeProfiles,
    practiceScenarios,
    quizSnapshot,
    synthesisSummary
  );

  // Create the write-up object
  const writeUp: StudyGuideWriteUp = {
    id: `writeup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    universeId: universeDefinition.id,
    universeRunId: universeRun.id,
    createdAt: Date.now(),
    content,
    doctrineSummaries,
    modelPatterns,
    mistakeProfile: mistakeProfiles,
    practiceScenarios,
    quizSnapshot,
    synthesisSummary,
    universeTitle: universeDefinition.title,
    completionDate: universeRun.completedAt || Date.now(),
    totalTimeSpent: universeRun.metrics?.totalTimeSeconds,
  };

  return writeUp;
}
