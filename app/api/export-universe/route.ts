import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

interface ExportRequest {
  exportType: 'full' | 'analysis';
  nexus: {
    id: string;
    title: string;
    content: string;
  };
  nodes: Array<{
    id: string;
    title: string;
    content: string;
    semanticTitle?: string;
    nodeType?: string;
    isConnectionNode?: boolean;
    isSynthesis?: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY is not defined');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const { exportType, nexus, nodes }: ExportRequest = await request.json();

    if (!exportType || !nexus || !nodes) {
      return NextResponse.json(
        { error: 'Missing required fields: exportType, nexus, nodes' },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Prepare node data with semantic titles
    const nodeDescriptions = nodes.map(node => {
      const title = node.semanticTitle || node.content.slice(0, 50) + '...';
      const typeLabel = node.isConnectionNode ? '[CONNECTION]' :
                       node.isSynthesis ? '[SYNTHESIS]' :
                       node.nodeType === 'ai-response' ? '[AI]' :
                       node.nodeType === 'user-reply' ? '[USER]' :
                       node.nodeType === 'socratic-question' ? '[SOCRATIC]' :
                       '[NODE]';

      return `${typeLabel} ${title}\nContent: ${node.content.slice(0, 500)}${node.content.length > 500 ? '...' : ''}`;
    });

    // Filter specific node types for analysis mode
    const synthesisNodes = nodes.filter(n => n.isSynthesis);
    const connectionNodes = nodes.filter(n => n.isConnectionNode);
    const aiInsights = nodes.filter(n => n.nodeType === 'ai-response');

    // Build the prompt based on export type
    const prompt = exportType === 'full'
      ? buildFullHistoryPrompt(nexus, nodeDescriptions)
      : buildAnalysisOnlyPrompt(nexus, synthesisNodes, connectionNodes, aiInsights);

    console.log('📝 Generating', exportType, 'export for universe:', nexus.title);

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const textContent = message.content.find((block) => block.type === 'text');
    const markdown = textContent && 'text' in textContent
      ? textContent.text.trim()
      : '# Export Failed\n\nUnable to generate document.';

    console.log('✅ Generated document:', markdown.slice(0, 100) + '...');

    // Parse markdown into structured data for Word/PDF export
    const structuredData = parseMarkdownToStructured(markdown, nexus.title);

    return NextResponse.json({
      markdown, // Keep for backward compatibility
      structured: structuredData
    });

  } catch (error: any) {
    console.error('❌ Error exporting universe:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export universe' },
      { status: 500 }
    );
  }
}

function buildFullHistoryPrompt(
  nexus: { title: string; content: string },
  nodeDescriptions: string[]
): string {
  return `Create a comprehensive conversation transcript document in markdown format.

Universe Title: "${nexus.title}"
Universe Context: ${nexus.content}

Format each exchange with clear labels and indentation to show conversation structure:

**[USER REPLY]**
[User's actual content]

**[AI RESPONSE]**
[AI's actual content]

**[SOCRATIC QUESTION]**
[AI's question]

**[USER ANSWER]**
[User's answer to Socratic question]

  **[FOLLOW-UP QUESTION]** (indented when it's a continuation)
  [AI's follow-up]

  **[USER ANSWER]**
  [User's answer]

**[CONNECTION NODE - Connecting: Topic A + Topic B + Topic C]**
[Content from inspiration node showing synthesis]

**[SYNTHESIS]**
[Content from synthesis node]

Show the full conversation tree with proper indentation:
- Main threads at left margin
- Replies indented 2 spaces
- Sub-replies indented 4 spaces
- Clearly label each exchange type

Do NOT add commentary - just present the conversation as it happened.

Structure:
# ${nexus.title} - Full Conversation

## Conversation Transcript

[Full conversation with labels and indentation]

---

All Nodes in Universe:
${nodeDescriptions.join('\n\n')}

---

Present the conversation chronologically as it unfolded. Use the node types and parent-child relationships to build the conversation tree. Label each exchange based on its type (USER REPLY, AI RESPONSE, SOCRATIC QUESTION, USER ANSWER, CONNECTION NODE, SYNTHESIS).

Generate the complete conversation transcript now:`;
}

function buildAnalysisOnlyPrompt(
  nexus: { title: string; content: string },
  synthesisNodes: Array<{ content: string; semanticTitle?: string }>,
  connectionNodes: Array<{ content: string; semanticTitle?: string }>,
  aiInsights: Array<{ content: string; semanticTitle?: string }>
): string {
  const synthesisList = synthesisNodes.map(n =>
    `- ${n.semanticTitle || 'Synthesis'}: ${n.content.slice(0, 300)}`
  ).join('\n');

  const connectionsList = connectionNodes.map(n =>
    `- ${n.semanticTitle || 'Connection'}: ${n.content.slice(0, 300)}`
  ).join('\n');

  const insightsList = aiInsights.slice(0, 5).map(n =>
    `- ${n.semanticTitle || 'Insight'}: ${n.content.slice(0, 300)}`
  ).join('\n');

  return `Create a comprehensive strategic consulting memo analyzing this conversation universe. Write in the style of McKinsey, Bain, or BCG - professional, confident, action-oriented, with a "so what?" focus.

Universe Title: "${nexus.title}"
Universe Context: ${nexus.content}

Write COMPREHENSIVE PARAGRAPHS (5-10 sentences each) - NO bullet points. Use full prose to develop ideas thoroughly.

Structure:

# ${nexus.title} - Strategic Analysis

## Executive Summary

Write 3-4 comprehensive paragraphs that synthesize the most critical insights, patterns, and recommendations from this conversation universe. This should be compelling enough to stand alone - a busy executive should understand the key findings and implications without reading further. Lead with the headline insight, then build out the strategic context, and conclude with the primary call to action. Each paragraph should be 5-7 sentences that flow naturally.

## Key Insights Discovered

Identify and deeply analyze 3-5 of the most significant insights from the conversation. For each insight:

### [Insight Title - Compelling & Specific]

Write 2-3 full paragraphs (5-7 sentences each) that:
- Establish what was discovered and why it matters
- Provide the evidence and reasoning behind this insight
- Explore the implications and "so what?" factor
- Connect to broader themes or strategic opportunities

Do this for each major insight. Give each its own ### heading.

## Emergent Patterns & Connections

Write 3-5 comprehensive paragraphs analyzing how different ideas, themes, or concepts interconnected throughout the conversation. Identify patterns that weren't explicitly stated but emerged from the synthesis. Explain what these connections reveal about the underlying dynamics, opportunities, or challenges. Each paragraph should explore a distinct pattern or connection cluster with full development of the idea.

## Strategic Recommendations

Provide 3-5 key recommendations. For each recommendation:

### [Recommendation Title - Clear & Action-Oriented]

Write 2-3 full paragraphs (5-7 sentences each) that:
- Present the recommendation with compelling rationale
- Explain the expected impact and why this matters strategically
- Detail specific implementation approaches or next steps
- Address potential challenges or considerations
- Connect back to the insights that support this recommendation

Do this for each major recommendation. Give each its own ### heading.

## Implementation Considerations

Write 2-4 comprehensive paragraphs discussing the practical realities of moving forward. Address timing, sequencing, resource requirements, potential obstacles, and critical success factors. Be realistic about challenges while maintaining an action-oriented tone. Provide strategic guidance on how to prioritize and sequence the work.

## Conclusion

Write 2 comprehensive paragraphs that:
- Synthesize the core message and strategic imperative
- Reinforce the key opportunities and path forward
- End with a compelling call to action

---

Synthesis Nodes:
${synthesisList || 'None'}

Connection Insights:
${connectionsList || 'None'}

Key AI Insights:
${insightsList || 'None'}

---

Writing Guidelines:
- Use ONLY comprehensive paragraphs - absolutely NO bullet points
- Each paragraph should be 5-10 sentences with full development of ideas
- Write in confident, professional consulting language
- Focus on "so what?" - always explain why insights matter
- Be specific and actionable in recommendations
- Use proper markdown: # for title, ## for main sections, ### for subsections
- Let paragraphs breathe - use line breaks between them for readability
- Avoid jargon unless it adds precision
- Be direct and action-oriented throughout

Generate the complete strategic consulting memo now:`;
}

function parseMarkdownToStructured(markdown: string, title: string) {
  // Extract title from first # heading if present
  const titleMatch = markdown.match(/^#\s+(.+?)$/m);
  const extractedTitle = titleMatch ? titleMatch[1] : title;

  // Split into sections by ## headings
  const sections: Array<{ heading: string; content: string }> = [];
  const sectionRegex = /^##\s+(.+?)$/gm;

  let match;
  let summary = '';

  while ((match = sectionRegex.exec(markdown)) !== null) {
    const heading = match[1];
    const startIndex = match.index + match[0].length;

    // Get content from this heading to next heading (or end)
    sectionRegex.lastIndex = startIndex;
    const nextMatch = sectionRegex.exec(markdown);
    const endIndex = nextMatch ? nextMatch.index : markdown.length;

    const content = markdown.slice(startIndex, endIndex).trim();

    // First section is typically Executive Summary
    if (sections.length === 0 && (heading.toLowerCase().includes('summary') || heading.toLowerCase().includes('executive'))) {
      summary = content;
    } else {
      sections.push({
        heading,
        content
      });
    }

    sectionRegex.lastIndex = endIndex;
  }

  // If no summary was found, use first paragraph after title
  if (!summary) {
    const firstParagraphMatch = markdown.match(/^#[^\n]*\n\n([\s\S]+?)(?:\n\n|\n##|$)/);
    summary = firstParagraphMatch ? firstParagraphMatch[1].trim() : 'Analysis of ' + extractedTitle;
  }

  return {
    title: extractedTitle,
    summary,
    sections
  };
}
