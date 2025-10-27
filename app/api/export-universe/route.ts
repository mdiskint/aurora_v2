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
  return `Create a narrative markdown document from this conversation universe.

Universe Title: "${nexus.title}"
Universe Context: ${nexus.content}

Structure your document like this:

# ${nexus.title}

## Executive Summary
Write 2-3 paragraphs summarizing the entire exploration journey and key discoveries.

## The Journey
Create a flowing narrative that tells the story of this exploration chronologically.
Show how questions led to insights, how ideas connected, and how understanding deepened.
Write in engaging prose, not bullet points.

## Key Connections
Identify and explain the most important connections between ideas that emerged.
Show how disparate concepts came together to create new understanding.

## Conclusions & Recommendations
Provide clear, actionable conclusions and recommendations based on the exploration.
Number your recommendations for clarity.

---

All Nodes in Universe:
${nodeDescriptions.join('\n\n')}

---

Guidelines:
- Write in flowing, professional prose
- Use headers and subheaders for structure
- Emphasize key insights with **bold** or _italic_
- Tell a story - this is a narrative, not a transcript
- Focus on the intellectual journey and discoveries
- Make it readable and engaging
- Keep it concise but comprehensive
- Use markdown formatting effectively

Generate the complete document now:`;
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

  return `Create a concise analysis document focusing on final insights and recommendations.

Universe Title: "${nexus.title}"
Universe Context: ${nexus.content}

Structure your document like this:

# ${nexus.title} - Analysis

## Executive Summary
Write 1-2 paragraphs summarizing the key insights and recommendations.

## Key Insights
Identify 3-5 main discoveries from this exploration.
Use ### subheaders for each insight.
Explain why each insight matters.

## Important Connections
Explain how different ideas relate and reinforce each other.
Show the emergent patterns that weren't obvious initially.

## Recommendations & Next Steps
Provide clear, numbered, actionable recommendations.
Focus on practical next steps and implementation.

---

Synthesis Nodes:
${synthesisList || 'None'}

Connection Insights:
${connectionsList || 'None'}

Key AI Insights:
${insightsList || 'None'}

---

Guidelines:
- Focus on deliverables, not the exploration process
- Write in clear, professional prose
- Be concise but thorough
- Use markdown formatting effectively
- Number recommendations for clarity
- Make it actionable

Generate the complete analysis document now:`;
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
