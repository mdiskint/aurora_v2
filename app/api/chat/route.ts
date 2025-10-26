import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY is not defined');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    console.log('✅ API key found, initializing Anthropic client');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const body = await request.json();
    console.log('📦 Full request body:', JSON.stringify(body, null, 2));

    const { messages, conversationContext, mode } = body;
    console.log('📨 Message count:', messages?.length);
    console.log('🧠 Has context:', !!conversationContext);
    console.log('🌌 Mode:', mode);

    let userMessage: string;

    if (messages && Array.isArray(messages) && messages.length > 0) {
      userMessage = messages[messages.length - 1].content;
      console.log('📨 Extracted from messages array:', userMessage);
    } else {
      console.error('❌ No valid message found in request');
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!userMessage || userMessage.trim() === '') {
      console.error('❌ Message is empty');
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    // 🌌 SPATIAL MODE: Detect "Explore:" prefix or explicit spatial mode
    const isSpatialMode = mode === 'spatial' || userMessage.toLowerCase().startsWith('explore:');

    if (isSpatialMode) {
      console.log('🌌 SPATIAL MODE ACTIVATED - Generating universe structure');

      // Extract topic from "Explore: topic" or use full message
      const userTopic = userMessage.toLowerCase().startsWith('explore:')
        ? userMessage.substring(8).trim()
        : userMessage;

      console.log('🎯 Topic for universe:', userTopic);

      // 🔍 CHECK FOR MANUAL MODE: User provided ** structure
      if (userTopic.includes('**')) {
        console.log('✋ MANUAL MODE: Parsing ** delimiters');
        console.log('📝 Raw input:', userTopic);

        const sections = userTopic.split('**').filter(s => s.trim());
        console.log('📊 Split sections:', sections.length, sections);

        if (sections.length < 2) {
          console.error('❌ Invalid ** format: need at least nexus title and one node');
          return NextResponse.json(
            { error: 'Manual mode requires at least: **Nexus Title **Node 1 content' },
            { status: 400 }
          );
        }

        // First section = Nexus ONLY
        const nexusSection = sections[0].trim();
        // Remaining sections = Nodes ONLY (excludes first section)
        const nodeSections = sections.slice(1);

        console.log('🏛️ Nexus section (index 0):', nexusSection);
        console.log('📦 Node sections (index 1+):', nodeSections);

        const spatialData = {
          nexusTitle: nexusSection.substring(0, 50), // First 50 chars for title
          nexusContent: nexusSection, // Full first section for content
          nodes: nodeSections.map((content, idx) => {
            console.log(`   Node ${idx + 1}:`, content.substring(0, 50) + '...');
            return { content: content.trim() };
          })
        };

        console.log('✅ Parsed manual structure:');
        console.log(`   - Nexus: "${spatialData.nexusTitle}"`);
        console.log(`   - Nodes: ${spatialData.nodes.length}`);
        console.log('   - Nexus appears in nodes? NO (using slice(1))');

        return NextResponse.json({
          response: `Created manual universe with ${spatialData.nodes.length} nodes`,
          spatialData
        });
      }

      // 🤖 AI MODE: Generate structure automatically
      console.log('🤖 AI MODE: Generating universe structure');

      const spatialPrompt = `User wants to explore: "${userTopic}"

You have the freedom to create 4-20 total artifacts (1 nexus + 3-19 child nodes).

Assess the topic and decide the optimal number based on:
- How many distinct subtopics exist naturally?
- Can the topic be well-covered with fewer nodes, or does it require comprehensive breakdown?
- Balance breadth (many areas) vs. depth (detailed coverage)

Guidelines for scaling:
- Simple/narrow topics (e.g., "primary colors", "traffic lights"): 4-6 total (nexus + 3-5 nodes)
- Medium complexity (e.g., "building a startup", "photosynthesis"): 7-12 total (nexus + 6-11 nodes)
- Complex/broad topics (e.g., "causes of World War I", "quantum mechanics", "history of philosophy"): 13-20 total (nexus + 12-19 nodes)

Create the optimal number to give users a complete conceptual map without overwhelming or under-serving the topic.

Format your response as VALID JSON (and ONLY JSON, no other text):
{
  "nexusTitle": "brief title (3-7 words)",
  "nexusContent": "overview paragraph explaining the topic",
  "nodes": [
    {"content": "Subtopic 1: Title\\n\\nDetailed explanation (2-3 sentences minimum)"},
    {"content": "Subtopic 2: Title\\n\\nDetailed explanation (2-3 sentences minimum)"},
    {"content": "Subtopic 3: Title\\n\\nDetailed explanation (2-3 sentences minimum)"}
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- Use \\n for line breaks within strings (NOT literal newlines)
- Each node should be substantive (2-3 sentences minimum)
- Create 3-19 nodes based on topic complexity`;

      console.log('📤 Sending spatial universe generation prompt...');

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096, // Increased to handle up to 19 nodes
        system: 'You are Aurora AI, a universe architect. Generate structured spatial knowledge graphs with intelligent scaling. Assess topic complexity and create the optimal number of nodes (3-19) to comprehensively map the conceptual space. Always return ONLY valid JSON with properly escaped newlines (\\n).',
        messages: [{ role: 'user', content: spatialPrompt }],
      });

      console.log('✅ Got response from Claude');

      const textContent = response.content.find((block) => block.type === 'text');
      const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

      console.log('📝 Raw AI response:', rawResponse);

      try {
        // Sanitize JSON: Try parsing as-is first, then with cleanup if needed
        let spatialData;
        try {
          spatialData = JSON.parse(rawResponse);
        } catch (firstError) {
          console.log('⚠️ Initial parse failed, attempting cleanup...');

          // Extract JSON from markdown code blocks if present
          let cleanedResponse = rawResponse.trim();
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```$/, '');
          }

          // Parse the cleaned response
          spatialData = JSON.parse(cleanedResponse);
        }

        console.log('✅ Successfully parsed spatial JSON:', spatialData);

        return NextResponse.json({
          response: `Generated universe for: ${userTopic}`,
          spatialData
        });
      } catch (parseError) {
        console.error('❌ Failed to parse spatial JSON:', parseError);
        console.error('Raw response was:', rawResponse);
        return NextResponse.json(
          { error: 'Failed to parse universe structure from AI' },
          { status: 500 }
        );
      }
    }

    // Standard chat mode
    console.log('📤 Sending to Claude API...');

    // 🧠 NEW: Build system message with full context
    const systemMessage = conversationContext
      ? `You are Aurora AI, helping users explore ideas in 3D space. You have access to the full conversation context below:\n\n${conversationContext}\n\nRespond naturally based on this full context.`
      : 'You are Aurora AI, helping users explore ideas in 3D space.';

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: systemMessage, // 🧠 Include context here
      messages: [{ role: 'user', content: userMessage }],
    });

    console.log('✅ Got response from Claude');

    const textContent = response.content.find((block) => block.type === 'text');
    const aiResponse = textContent && 'text' in textContent ? textContent.text : 'No response';

    return NextResponse.json({ response: aiResponse });
  } catch (error: any) {
    console.error('❌ Error calling Anthropic API:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);
    
    return NextResponse.json(
      { error: error.message || 'Failed to get response from Claude' },
      { status: 500 }
    );
  }
}