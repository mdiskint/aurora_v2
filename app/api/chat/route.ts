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

      const spatialPrompt = `User wants to explore: "${userTopic}"

Generate a comprehensive universe structure with:
- A central nexus (main topic/title)
- 4-6 key subtopic nodes

Format your response as JSON (and ONLY JSON, no other text):
{
  "nexusTitle": "brief title",
  "nexusContent": "overview paragraph",
  "nodes": [
    {"content": "Subtopic 1 with detailed explanation"},
    {"content": "Subtopic 2 with detailed explanation"},
    {"content": "Subtopic 3 with detailed explanation"}
  ]
}

Make each node substantive (2-3 sentences minimum). Return ONLY the JSON, nothing else.`;

      console.log('📤 Sending spatial universe generation prompt...');

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: 'You are Aurora AI, a universe architect. Generate structured spatial knowledge graphs.',
        messages: [{ role: 'user', content: spatialPrompt }],
      });

      console.log('✅ Got response from Claude');

      const textContent = response.content.find((block) => block.type === 'text');
      const rawResponse = textContent && 'text' in textContent ? textContent.text : '';

      console.log('📝 Raw AI response:', rawResponse);

      try {
        // Parse the JSON response
        const spatialData = JSON.parse(rawResponse);
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