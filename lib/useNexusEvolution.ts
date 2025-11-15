'use client';

import { useEffect, useRef } from 'react';
import { useCanvasStore } from './store';

/**
 * 🌱 EVOLVING NEXUS - Hook to watch for completed nexuses and generate mastery summaries
 *
 * This hook:
 * 1. Monitors all nexuses in the current universe
 * 2. Detects when a nexus transitions to 'growing' state (completed but not yet summarized)
 * 3. Calls the /api/chat endpoint with 'nexus-summarize' mode
 * 4. Updates the nexus with the generated mastery summary
 */
export function useNexusEvolution() {
  const nexuses = useCanvasStore(state => state.nexuses);
  const nodes = useCanvasStore(state => state.nodes);
  const getNodesForNexus = useCanvasStore(state => state.getNodesForNexus);
  const setNexusMasterySummary = useCanvasStore(state => state.setNexusMasterySummary);

  // Track which nexuses we're currently processing to avoid duplicate requests
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Find nexuses that need mastery summaries
    const nexusesNeedingSummary = nexuses.filter(nexus =>
      nexus.evolutionState === 'growing' &&
      !nexus.masterySummary &&
      !processingRef.current.has(nexus.id)
    );

    if (nexusesNeedingSummary.length === 0) return;

    // Process each nexus that needs a summary
    nexusesNeedingSummary.forEach(async (nexus) => {
      console.log(`🌱 [useNexusEvolution] Generating mastery summary for nexus: ${nexus.id}`);

      // Mark as processing
      processingRef.current.add(nexus.id);

      try {
        // Get all nodes for this nexus
        const nexusNodes = getNodesForNexus(nexus.id);

        // Build context for AI
        const nodeContents = nexusNodes.map(node => ({
          id: node.id,
          title: node.title,
          content: node.content,
          type: node.nodeType || 'unknown',
          isCompleted: node.isCompleted || false,
        }));

        console.log(`🌱 [useNexusEvolution] Sending ${nexusNodes.length} nodes to API for summarization`);

        // Call API to generate mastery summary
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Generate mastery summary for the following learning conversation.

NEXUS: ${nexus.title}
ORIGINAL CONTENT: ${nexus.originalContent || nexus.content}

CONVERSATION NODES (${nexusNodes.length} total):
${nodeContents.map((n, i) => `
${i + 1}. [${n.type}] ${n.title}
${n.content.substring(0, 500)}${n.content.length > 500 ? '...' : ''}
`).join('\n')}

Please create a comprehensive "What You've Learned" summary that:
- Uses second person ("You now understand...")
- Explains the core concepts and frameworks covered
- Shows how sub-issues and examples connect
- Describes what kinds of scenarios the student can now handle
- Highlights 1-2 key pitfalls to watch out for
- Is 3-5 paragraphs in length

Focus on synthesizing the LEARNING OUTCOMES, not just summarizing what was discussed.`
            }],
            mode: 'nexus-summarize'
          }),
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const summary = data.message || data.response || '';

        if (!summary) {
          throw new Error('API returned empty summary');
        }

        console.log(`✨ [useNexusEvolution] Received mastery summary (${summary.length} chars)`);

        // Update nexus with mastery summary
        setNexusMasterySummary(nexus.id, summary);

        console.log(`🎉 [useNexusEvolution] Nexus ${nexus.id} evolved to 'mastered' state!`);

      } catch (error) {
        console.error(`❌ [useNexusEvolution] Failed to generate mastery summary for ${nexus.id}:`, error);
        // Remove from processing set so it can be retried
        processingRef.current.delete(nexus.id);
      }
    });

  }, [nexuses, nodes, getNodesForNexus, setNexusMasterySummary]);
}
