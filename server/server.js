require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// ✨ MARKDOWN BOLD PARSER - Finds **text** markers only
function parseBoldSections(text) {
  const sections = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue; // Skip empty lines
    
    // Look for **Bold Markdown** pattern
    const boldMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (boldMatch) {
      sections.push({
        title: boldMatch[1].trim(),
        lineIndex: i,
        type: 'markdown'
      });
      console.log(`   Found: "${boldMatch[1].trim()}"`);
    }
  }
  
  console.log(`🔍 Total sections found: ${sections.length}`);
  return sections;
}

// ✨ CONTENT EXTRACTOR - Gets text between headers (line-based)
function extractNodeContent(text, sections) {
  const nodes = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < sections.length; i++) {
    const currentSection = sections[i];
    const nextSection = sections[i + 1];
    
    // Extract content from line after current header to line before next header
    const contentStartLine = currentSection.lineIndex + 1;
    const contentEndLine = nextSection ? nextSection.lineIndex : lines.length;
    
    const content = lines
      .slice(contentStartLine, contentEndLine)
      .join('\n')
      .trim();
    
    nodes.push({
      title: currentSection.title,
      content: content || "No additional content.",
      type: currentSection.type
    });
  }
  
  return nodes;
}

// ✨ SPATIAL MODE PROMPT - Now expects pre-parsed structure
function buildSpatialPrompt(nodeCount) {
  return `
SPATIAL ORGANIZATION MODE

You are Aurora's spatial architect. The content has been pre-parsed into ${nodeCount} sections using header markers.

YOUR TASK:
Organize these ${nodeCount} pre-defined sections spatially for optimal 3D navigation.

STRUCTURE RULES:
- Section 1 = NEXUS (center position - this is the anchor point)
- Sections 2-${nodeCount} = REPLY NODES (children of the nexus)

YOUR JOB (what you DO control):
✅ Determine semantic relationships between sections
✅ Suggest optimal spatial layout pattern
✅ Create meaningful edges showing connections
✅ Assign position hints (center, left, right, cluster)

YOUR JOB (what you DON'T control):
❌ Node count (fixed at ${nodeCount})
❌ Node titles (use exact titles from headers)
❌ Node content (use exact content provided - DO NOT rewrite, summarize, or modify)
❌ Granularity decisions (already made by user)

CRITICAL CONTENT RULE:
You MUST preserve the original content EXACTLY as provided. Do NOT:
- Summarize or condense the text
- Rewrite in your own words
- Add your own interpretations
- Remove any details
- Change the structure or formatting

Copy the content verbatim into the "content" field. Your job is ONLY to organize spatially, not to edit.

RESPONSE FORMAT (JSON only, no markdown fences):

{
  "explanation": "Brief reasoning about spatial organization and why this layout pattern works",
  "nodes": [
    {
      "title": "Exact title from header",
      "content": "EXACT ORIGINAL CONTENT - copied verbatim with no modifications",
      "position": "center" | "left" | "right" | "cluster"
    }
  ],
  "edges": [
    {
      "type": "semantic" | "cross" | "echo",
      "from": 0,
      "to": 1,
      "reason": "Specific relationship between these sections"
    }
  ],
  "layout_hint": "cluster" | "linear" | "radial" | "semantic_field" | "hierarchical" | "network"
}

LAYOUT SELECTION:
- "linear" - sequential flow (A → B → C)
- "hierarchical" - nested concepts (main → sub-concepts)
- "radial" - aspects of central concept
- "cluster" - thematic groupings
- "semantic_field" - organically related ideas
- "network" - dense interconnections

EDGE TYPES:
- "semantic" - shares core theme
- "cross" - bridges different strands
- "echo" - synthesizes multiple nodes

CRITICAL REMINDER:
- First node MUST be position: "center" (the nexus)
- Create EXACTLY ${nodeCount} nodes
- Use EXACT titles from the provided sections
- Use EXACT content from the provided sections (NO REWRITING)
- Focus on relationships and optimal spatial layout ONLY

Return ONLY valid JSON.
`;
}

// ✨ STANDARD DOCUMENT ANALYSIS PROMPT (fallback when no **markers** found)
const SPATIAL_MODE_PROMPT = `
SPATIAL EXPLORATION MODE ACTIVATED

You are Aurora's spatial conversation architect analyzing and restructuring content for optimal 3D navigation.

YOUR TASK:
Read the provided content and intelligently decompose it into a spatial knowledge structure optimized for Aurora's 3D interface.

ANALYSIS FRAMEWORK:

**Step 1: Identify Natural Break Points**
Look for:
- Conceptual shifts (when topic/focus changes)
- Argument transitions (premises → evidence → conclusions)
- Definitional boundaries (what X is vs. how X works vs. why X matters)
- Thematic clusters (related ideas that belong together)
- Dependency relationships (concept A must be understood before B)
- Synthesis points (where multiple threads converge)

**Step 2: Evaluate Each Potential Node**
Ask for each segment:
- Does this represent ONE coherent idea/argument/concept?
- Is it substantial enough to stand alone? (2-4 paragraphs ideal)
- Does it serve a unique purpose in understanding the whole?
- Would splitting it further improve clarity OR create fragmentation?
- Does it connect meaningfully to other nodes?

**Step 3: Optimize for Aurora's Capabilities**

CONTEXT PRESERVATION:
- Keep related ideas spatially proximate (use position hints)
- Create edges between conceptually connected nodes
- Ensure smooth navigation paths through argument chains

SEMANTIC CLARITY:
- Each node title should clearly signal its unique contribution
- Content should be self-contained but reference connections
- Avoid overlap - each node covers distinct ground

DISCUSSION GENERATIVITY:
- Structure invites exploration ("what about this aspect?")
- Terminal nodes suggest natural follow-up questions
- Controversial points isolated for focused discussion

COGNITIVE SCAFFOLDING:
- Essential foundations come first (center/left positions)
- Build complexity progressively
- Meta-nodes summarize when helpful

DECISION RULES:

**When to CREATE a separate node:**
✅ Introduces new main concept/mechanism/argument
✅ Provides detailed evidence/case study
✅ Addresses distinct objection/counterpoint
✅ Explores different application/implication
✅ Synthesizes multiple earlier points
✅ Shifts to new analytical level (theory → practice → critique)

**When to KEEP content together:**
❌ Merely elaborates the same point with examples
❌ Provides minor supporting details
❌ Contains transitional logic ("therefore...")
❌ Would be too brief to stand alone (< 1 paragraph)

**Granularity Sweet Spot:**
- Aim for 15-40 nodes for article-length content
- Each node: 2-5 paragraphs of focused content
- Too few nodes (< 10) = missing structural insights
- Too many nodes (> 50) = over-fragmentation

RESPONSE FORMAT (JSON only):

{
  "explanation": "I identified [N] natural conceptual units based on [reasoning]. Structure optimizes for [Aurora principles].",
  "nodes": [
    {
      "title": "Clear Specific Title (4-8 words)",
      "content": "Self-contained but connected content. 2-5 focused paragraphs. Preserves original text where appropriate, synthesizes where helpful.",
      "position": "center" | "left" | "right" | "cluster"
    }
  ],
  "edges": [
    {
      "type": "semantic" | "cross" | "echo",
      "from": 0,
      "to": 1,
      "reason": "Specific relationship (builds on, contrasts with, applies, etc.)"
    }
  ],
  "layout_hint": "cluster" | "linear" | "radial" | "semantic_field" | "hierarchical" | "network"
}

LAYOUT SELECTION:
- "linear" - for sequential arguments (premise → evidence → conclusion)
- "hierarchical" - for nested concepts (theory → applications → cases)
- "radial" - for aspect analysis (central concept with dimensions)
- "cluster" - for thematic groupings with cross-links
- "semantic_field" - for organically related ideas
- "network" - for dense interconnected concepts

EDGE TYPES:
- "semantic" - shares core theme/concept
- "cross" - connects across different argument strands
- "echo" - synthesizes/references multiple earlier nodes

CRITICAL QUALITY CHECKS:
1. Does each node justify its existence?
2. Would merging any two nodes improve clarity?
3. Should any node be split for better focus?
4. Do edges capture the most important relationships?
5. Does the structure make the argument/content MORE navigable than linear text?

REMEMBER:
- You're restructuring for 3D spatial understanding, not just chunking text
- Trust your analysis - you know when concepts deserve their own node
- The goal is optimal navigation and comprehension, not word-count equality
- Original content quality matters - preserve powerful passages, synthesize weaker ones

Return ONLY valid JSON. No markdown wrappers.
`;

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, mode } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const isSpatialMode = mode === 'spatial';

    console.log(`🎯 Chat request received - Mode: ${isSpatialMode ? 'SPATIAL' : 'STANDARD'}`);

    // ✨ NEW: Check for **markdown** markers in spatial mode
    let systemMessage;
    let processedMessages = messages;
    
    if (isSpatialMode) {
      const userMessage = messages[messages.length - 1].content;
      const sections = parseBoldSections(userMessage);
      
      if (sections.length > 0) {
        // **Markers** found! Use structured parsing approach
        console.log(`📊 Found ${sections.length} sections - using structured parsing`);
        
        const parsedNodes = extractNodeContent(userMessage, sections);
        systemMessage = buildSpatialPrompt(sections.length);
        
        // Build structured prompt for Claude
        const structuredPrompt = `Here are the ${sections.length} pre-parsed sections to organize spatially:

${parsedNodes.map((node, i) => `
SECTION ${i + 1}:
Title: ${node.title}
Content: ${node.content}
`).join('\n---\n')}

Create the JSON structure organizing these sections spatially.`;

        processedMessages = [{ role: 'user', content: structuredPrompt }];
        
      } else {
        // No **markers** - use original analysis approach
        console.log(`📝 No **markers** found - using AI-driven analysis`);
        systemMessage = SPATIAL_MODE_PROMPT;
      }
    }

    // Call Claude API
    const apiParams = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: isSpatialMode ? 16000 : 1024,
      messages: processedMessages,
    };

    if (systemMessage) {
      apiParams.system = systemMessage;
    }

    const response = await anthropic.messages.create(apiParams);

    const aiResponse = response.content[0].text;

    if (isSpatialMode) {
      try {
        let cleanedResponse = aiResponse.trim();
        
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        
        const spatialData = JSON.parse(cleanedResponse);
        const nodeCount = spatialData.nodes?.length || 0;
        console.log(`✅ Spatial JSON parsed - ${nodeCount} nodes created`);
        console.log(`📊 Layout: ${spatialData.layout_hint}`);
        console.log(`🔗 Edges: ${spatialData.edges?.length || 0} connections`);
        
        return res.json({ 
          response: aiResponse,
          mode: 'spatial',
          spatialData: spatialData 
        });
      } catch (parseError) {
        console.warn('⚠️ Failed to parse spatial JSON, returning as standard:', parseError.message);
        return res.json({ 
          response: aiResponse,
          mode: 'standard' 
        });
      }
    }

    res.json({ 
      response: aiResponse,
      mode: 'standard'
    });

  } catch (error) {
    console.error('Error calling Claude API:', error);
    res.status(500).json({ error: 'Failed to get response from Claude' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Aurora chat server running on http://localhost:3001`);
});