'use client';

import { useEffect, useRef } from 'react';
import { useCanvasStore } from './store';

/**
 * 🎓 APPLICATION LAB EVOLUTION - Hook to watch for completed nexuses and generate Application Labs
 *
 * This hook:
 * 1. Monitors all nexuses in the current universe
 * 2. Detects when a nexus is marked with needsApplicationLab=true (completed but not yet evolved)
 * 3. Calls the /api/chat endpoint with 'nexus-application-lab' mode
 * 4. Parses the JSON response containing doctrine summary, scenarios, essay prompt, and rubric
 * 5. Updates the nexus with the generated Application Lab configuration
 */
export function useNexusApplicationLabEvolution() {
  const nexuses = useCanvasStore(state => state.nexuses);
  const nodes = useCanvasStore(state => state.nodes);
  const getNodesForNexus = useCanvasStore(state => state.getNodesForNexus);
  const setNexusApplicationLab = useCanvasStore(state => state.setNexusApplicationLab);

  // Track which nexuses we're currently processing to avoid duplicate requests
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Find nexuses that need Application Lab generation
    const nexusesNeedingLab = nexuses.filter(nexus =>
      nexus.needsApplicationLab === true &&
      !nexus.applicationLabConfig &&
      !processingRef.current.has(nexus.id)
    );

    if (nexusesNeedingLab.length === 0) return;

    // Process each nexus that needs an Application Lab
    nexusesNeedingLab.forEach(async (nexus) => {
      console.log(`🎓 [useNexusApplicationLabEvolution] Generating Application Lab for nexus: ${nexus.id} - "${nexus.title}"`);

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

        console.log(`🎓 [useNexusApplicationLabEvolution] Sending ${nexusNodes.length} nodes to API for Application Lab generation`);

        // Call API to generate Application Lab
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
        const response = await fetch(`${serverUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Generate Application Lab for the following learning conversation.

NEXUS: ${nexus.title}
ORIGINAL CONTENT: ${nexus.originalContent || nexus.content}

CONVERSATION NODES (${nexusNodes.length} total):
${nodeContents.map((n, i) => `
${i + 1}. [${n.type}] ${n.title}
${n.content.substring(0, 500)}${n.content.length > 500 ? '...' : ''}
`).join('\n')}

Please create a comprehensive Application Lab that helps the student apply what they've learned. Return your response as valid JSON matching this exact structure:

{
  "doctrineSummary": "A 2-4 paragraph summary using second person ('You now understand...') that explains the core concepts, frameworks, and mental models the student has developed. Focus on learning outcomes and capabilities gained.",
  "scenarios": [
    {
      "id": "scenario-1",
      "prompt": "A concrete scenario that tests application of the concepts in a realistic situation",
      "guidance": "Optional hints or framework for thinking through this scenario"
    }
  ],
  "finalEssayPrompt": "A capstone application essay prompt that requires synthesizing multiple concepts and applying them to a complex, realistic challenge. Should be open-ended and require thoughtful analysis.",
  "rubric": "Optional grading rubric that explains what excellent, good, and weak responses would demonstrate"
}

Requirements:
- Generate 2-5 scenarios that progressively increase in complexity
- Each scenario should test different aspects or combinations of what was learned
- The final essay prompt should be the most challenging and comprehensive
- Write in a warm, encouraging tone
- Be specific and concrete, not generic
- The questions and scenarios MUST ONLY cover content explicitly discussed in the provided conversation nodes
- Do NOT ask questions that require outside knowledge not present in the conversation
- Ensure all scenarios are solvable using ONLY the mental models and concepts developed in this specific conversation

IMPORTANT: Return ONLY valid JSON, no additional text before or after.`
            }],
            mode: 'nexus-application-lab'
          }),
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const labResponse = data.message || data.response || '';

        if (!labResponse) {
          throw new Error('API returned empty response');
        }

        console.log(`🎓 [useNexusApplicationLabEvolution] Received Application Lab response (${labResponse.length} chars)`);

        // Parse the JSON response
        let applicationLabConfig;
        try {
          // Try to extract JSON from the response (in case there's extra text)
          const jsonMatch = labResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in response');
          }
          applicationLabConfig = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error(`❌ [useNexusApplicationLabEvolution] Failed to parse JSON:`, parseError);
          throw new Error(`Failed to parse Application Lab JSON: ${parseError}`);
        }

        // Validate the structure
        if (!applicationLabConfig.doctrineSummary || !Array.isArray(applicationLabConfig.scenarios) || !applicationLabConfig.finalEssayPrompt) {
          throw new Error('Application Lab response missing required fields');
        }

        // Ensure scenario IDs are unique
        interface ScenarioType {
          id?: string;
          prompt: string;
          guidance?: string;
        }
        applicationLabConfig.scenarios = applicationLabConfig.scenarios.map((scenario: ScenarioType, index: number) => ({
          ...scenario,
          id: scenario.id || `scenario-${index + 1}`
        }));

        console.log(`✨ [useNexusApplicationLabEvolution] Parsed Application Lab with ${applicationLabConfig.scenarios.length} scenarios`);

        // Update nexus with Application Lab configuration
        setNexusApplicationLab(nexus.id, applicationLabConfig);

        console.log(`🎉 [useNexusApplicationLabEvolution] Nexus ${nexus.id} evolved to 'application-lab' state!`);

      } catch (error) {
        console.error(`❌ [useNexusApplicationLabEvolution] Failed to generate Application Lab for ${nexus.id}:`, error);
        // Remove from processing set so it can be retried
        processingRef.current.delete(nexus.id);
      }
    });

  }, [nexuses, nodes, getNodesForNexus, setNexusApplicationLab]);
}
