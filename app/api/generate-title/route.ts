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

    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const contentPreview = content.slice(0, 500);

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Summarize this in exactly 5-10 words that capture the core idea. Be specific and semantic, not generic. No punctuation at the end.

Content: "${contentPreview}"

Title:`
      }]
    });

    const textContent = message.content.find((block) => block.type === 'text');
    const title = textContent && 'text' in textContent
      ? textContent.text.trim()
      : content.slice(0, 50) + '...';

    console.log('📝 Generated title:', title);

    return NextResponse.json({ title });

  } catch (error: any) {
    console.error('❌ Error generating title:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate title' },
      { status: 500 }
    );
  }
}
