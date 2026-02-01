import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

interface ExportNode {
  id: string;
  title: string;
  content: string;
  parentId: string;
  children: string[];
  semanticTitle?: string;
  nodeType?: string;
  isConnectionNode?: boolean;
  isSynthesis?: boolean;
}

interface ExportRequest {
  exportType: 'full' | 'analysis';
  nexus: {
    id: string;
    title: string;
    content: string;
  };
  nodes: ExportNode[];
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


    // Reconstruction of the tree for both modes
    const rootNodes = nodes.filter(n => n.parentId === nexus.id).sort((a, b) => {
      const aTime = parseInt(a.id.split('-')[1]) || 0;
      const bTime = parseInt(b.id.split('-')[1]) || 0;
      return aTime - bTime;
    });

    let markdown = '';

    // ALWAYS generate the literal tree for now to satisfy the user's requirement for a bullet-pointed study guide
    console.log('🚀 Generating hierarchical tree export for universe:', nexus.title);
    markdown = `# ${nexus.title}\n\n`;

    const generateMarkdownTree = (node: ExportNode, depth: number = 0): string => {
      const indent = '  '.repeat(depth);
      const title = node.semanticTitle || node.title || node.content.slice(0, 50) + '...';

      // Logical labeling for study guide feel
      const typeLabel = node.isConnectionNode ? 'CONNECTION' :
        node.isSynthesis ? 'SYNTHESIS' :
          node.nodeType === 'ai-response' ? 'EXPLANATION' :
            node.nodeType === 'user-reply' ? 'USER' :
              node.nodeType === 'socratic-question' ? 'INQUIRY' :
                node.nodeType === 'quiz-mc' ? 'QUIZ (MC)' :
                  node.nodeType === 'quiz-fr' ? 'QUIZ (FR)' :
                    'NODE';

      let out = `${indent}- **[${typeLabel}] ${title}**\n`;

      // Indent content for readability
      const contentLines = node.content.split('\n');
      contentLines.forEach(line => {
        if (line.trim()) {
          out += `${indent}  ${line.trim()}\n`;
        }
      });

      // Recurse for children, sorted by timestamp to match UI
      const childNodes = nodes.filter(n => n.parentId === node.id).sort((a, b) => {
        const aTime = parseInt(a.id.split('-')[1]) || 0;
        const bTime = parseInt(b.id.split('-')[1]) || 0;
        return aTime - bTime;
      });

      if (childNodes.length > 0) {
        childNodes.forEach(child => {
          out += generateMarkdownTree(child, depth + 1);
        });
      }

      return out;
    };

    markdown += rootNodes.map(node => generateMarkdownTree(node, 0)).join('\n');

    console.log('✅ Generated document (first 100 chars):', markdown.slice(0, 100) + '...');

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

  // Find everything after the main title but before the first section
  const afterTitleIndex = titleMatch ? titleMatch.index + titleMatch[0].length : 0;
  const firstSectionMatch = sectionRegex.exec(markdown);
  sectionRegex.lastIndex = 0; // Reset for the main loop

  if (firstSectionMatch) {
    // There are sections (Executive Summary, etc.)
    summary = markdown.slice(afterTitleIndex, firstSectionMatch.index).trim();

    while ((match = sectionRegex.exec(markdown)) !== null) {
      const heading = match[1];
      const startIndex = match.index + match[0].length;
      const nextMatch = sectionRegex.exec(markdown);
      const endIndex = nextMatch ? nextMatch.index : markdown.length;
      const content = markdown.slice(startIndex, endIndex).trim();

      if (heading.toLowerCase().includes('summary') || heading.toLowerCase().includes('executive')) {
        summary = content;
      } else {
        sections.push({ heading, content });
      }

      if (nextMatch) sectionRegex.lastIndex = nextMatch.index;
      else break;
    }
  } else {
    // No ## sections found - everything is the tree
    const treeContent = markdown.slice(afterTitleIndex).trim();
    if (treeContent) {
      sections.push({
        heading: 'Full Conversation Tree',
        content: treeContent
      });
    }
  }

  return {
    title: extractedTitle,
    summary,
    sections
  };
}
