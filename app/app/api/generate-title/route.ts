import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { parseBoundedJson } from '@/lib/requestBound';

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[generate-title] ANTHROPIC_API_KEY is not defined');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const parsed = await parseBoundedJson(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { content } = parsed.body;

    if (typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }
    if (content.length > 100_000) {
      return NextResponse.json(
        { error: 'Content too large' },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const contentPreview = content.slice(0, 500);
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
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

    console.log('[generate-title] user=', user.id ?? user.email ?? 'unknown', 'title chars=', title.length);

    return NextResponse.json({ title });

  } catch (error: any) {
    console.error('[generate-title] error:', error?.constructor?.name, error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate title' },
      { status: 500 }
    );
  }
}
