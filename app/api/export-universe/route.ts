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
  return `Create a detailed bullet-point document from this conversation universe.

Universe Title: "${nexus.title}"
Universe Context: ${nexus.content}

Structure your document like this:

# ${nexus.title}

## Executive Summary
- [Key insight 1 from the exploration]
- [Key insight 2 from the exploration]
- [Key insight 3 from the exploration]

## The Exploration Journey
- [Major topic or phase 1]
  - [Key finding or insight]
  - [Supporting detail]
  - [Supporting detail]
- [Major topic or phase 2]
  - [Key finding or insight]
  - [Supporting detail]
  - [Supporting detail]
- [Major topic or phase 3]
  - [Key finding or insight]
  - [Supporting detail]

## Key Connections & Insights
- [Connection between ideas A and B]
  - [What this reveals]
  - [Why this matters]
  - [Implication or application]
- [Connection between ideas C and D]
  - [What this reveals]
  - [Why this matters]
- [Emergent pattern or theme]
  - [How it manifests]
  - [Significance]

## Conclusions & Recommendations
- [Recommendation 1]
  - [Specific action item]
  - [Expected outcome]
  - [Timeline or priority]
- [Recommendation 2]
  - [Specific action item]
  - [Expected outcome]
- [Recommendation 3]
  - [Specific action item]
  - [Expected outcome]

---

All Nodes in Universe:
${nodeDescriptions.join('\n\n')}

---

Guidelines:
- Use ONLY bullet points and sub-bullets - NO prose paragraphs
- Use clear hierarchical structure with proper indentation
- Main bullets (-) for primary points
- Sub-bullets (  -) indented with 2 spaces for supporting details
- Keep bullets concise and scannable
- Use **bold** for emphasis on key terms
- Organize chronologically in The Journey section
- Focus on actionable insights and recommendations
- Use markdown formatting: -, spaces for indentation

Generate the complete bullet-point document now:`;
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

  return `Create a concise bullet-point analysis document focusing on deliverables and actionable insights.

Universe Title: "${nexus.title}"
Universe Context: ${nexus.content}

Structure your document like this:

# ${nexus.title} - Analysis

## Executive Summary
- [Top insight 1]
- [Top insight 2]
- [Top insight 3]

## Key Insights
### [Insight Category 1]
- [Main discovery or finding]
  - [Supporting detail or evidence]
  - [Why this matters]
  - [Practical implication]

### [Insight Category 2]
- [Main discovery or finding]
  - [Supporting detail or evidence]
  - [Why this matters]

### [Insight Category 3]
- [Main discovery or finding]
  - [Supporting detail or evidence]

## Important Connections
- [How concept A relates to concept B]
  - [What this connection reveals]
  - [Why this matters]
  - [Emergent pattern or opportunity]
- [How concept C relates to concept D]
  - [What this connection reveals]
  - [Practical application]

## Recommendations & Next Steps
- [Immediate action 1]
  - [Specific implementation step]
  - [Expected result]
  - [Timeline or priority]
- [Strategic recommendation 2]
  - [Specific implementation step]
  - [Expected result]
- [Long-term recommendation 3]
  - [Specific implementation step]
  - [Expected result]

---

Synthesis Nodes:
${synthesisList || 'None'}

Connection Insights:
${connectionsList || 'None'}

Key AI Insights:
${insightsList || 'None'}

---

Guidelines:
- Use ONLY bullet points and sub-bullets - NO prose paragraphs
- Use clear hierarchical structure with proper indentation
- Main bullets (-) for primary points
- Sub-bullets (  -) indented with 2 spaces for supporting details
- Use ### for insight category subheadings
- Focus on deliverables and actionable items
- Keep bullets concise and scannable
- Make recommendations specific and implementable
- Use markdown formatting: -, spaces for indentation

Generate the complete bullet-point analysis document now:`;
}

function parseMarkdownToStructured(markdown: string, title: string) {
  // Extract title from first # heading if present
  const titleMatch = markdown.match(/^#\s+(.+?)$/m);
  const extractedTitle = titleMatch ? titleMatch[1] : title;

  // Split into sections by ## headings
  const sections: Array<{ heading: string; content: string }> = [];
  const sectionRegex = /^##\s+(.+?)$/gm;

  let lastIndex = 0;
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
    const firstParagraphMatch = markdown.match(/^#[^\n]*\n\n(.+?)(?:\n\n|\n##|$)/s);
    summary = firstParagraphMatch ? firstParagraphMatch[1].trim() : 'Analysis of ' + extractedTitle;
  }

  return {
    title: extractedTitle,
    summary,
    sections
  };
}
