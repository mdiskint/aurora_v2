import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AIComplexity = 'high' | 'mid' | 'low';

const MODEL_CONFIG = {
  high: { anthropic: 'claude-opus-4-7', openai: 'gpt-4o' },
  mid: { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o' },
  low: { anthropic: 'claude-haiku-4-5', openai: 'gpt-4o-mini' },
};

export async function safeAICall(
  anthropic: Anthropic,
  openai: OpenAI,
  params: any,
  complexity: AIComplexity = 'mid'
) {
  const modelToUse = MODEL_CONFIG[complexity];
  const systemBlocks = typeof params.system === 'string'
    ? [{ type: 'text' as const, text: params.system, cache_control: { type: 'ephemeral' as const } }]
    : params.system;

  const currentParams = { ...params, system: systemBlocks, model: modelToUse.anthropic };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log(`🤖 Attempting Anthropic call (${complexity} tier: ${modelToUse.anthropic})...`);
      const response = await anthropic.messages.create(currentParams);
      if (response.usage) {
        console.log(`💾 Cache: read=${response.usage.cache_read_input_tokens ?? 0} write=${response.usage.cache_creation_input_tokens ?? 0} input=${response.usage.input_tokens} output=${response.usage.output_tokens}`);
      }
      return response;
    } catch (error: any) {
      console.error('❌ Anthropic failed:', error.message);
      if (!process.env.OPENAI_API_KEY) throw error;
      console.log(`🔄 Fallback condition met, switching to OpenAI (${modelToUse.openai})...`);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    console.log(`🚀 Executing OpenAI fallback (${modelToUse.openai})...`);
    const systemContent = getOpenAISystemContent(params.system);
    const completion = await openai.chat.completions.create({
      model: modelToUse.openai,
      messages: [
        ...(systemContent ? [{ role: 'system' as const, content: systemContent }] : []),
        ...params.messages,
      ],
      max_tokens: params.max_tokens,
      temperature: params.temperature ?? 0.7,
    });

    return {
      content: [{ type: 'text', text: completion.choices[0].message.content || '' }],
    };
  }

  throw new Error('No valid AI provider key available');
}

function buildAnthropicParams(params: any, complexity: AIComplexity = 'mid') {
  const modelToUse = MODEL_CONFIG[complexity];
  const systemBlocks = typeof params.system === 'string'
    ? [{ type: 'text' as const, text: params.system, cache_control: { type: 'ephemeral' as const } }]
    : params.system;

  return { ...params, system: systemBlocks, model: modelToUse.anthropic };
}

export function getOpenAISystemContent(system: any) {
  if (!system) return '';
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return system.map((block) => block?.text || '').filter(Boolean).join('\n\n');
  }
  return String(system);
}

export function streamAICall(
  anthropic: Anthropic,
  openai: OpenAI,
  params: any,
  complexity: AIComplexity = 'mid'
) {
  const encoder = new TextEncoder();
  const modelToUse = MODEL_CONFIG[complexity];

  return new ReadableStream({
    async start(controller) {
      try {
        if (process.env.ANTHROPIC_API_KEY) {
          try {
            console.log(`🌊 Streaming Anthropic response (${complexity} tier: ${modelToUse.anthropic})...`);
            const stream = anthropic.messages.stream(buildAnthropicParams(params, complexity));

            for await (const event of stream as any) {
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            }

            controller.close();
            return;
          } catch (error: any) {
            console.error('❌ Anthropic stream failed:', error.message);
            if (!process.env.OPENAI_API_KEY) throw error;
            console.log(`🔄 Streaming fallback to OpenAI (${modelToUse.openai})...`);
          }
        }

        if (process.env.OPENAI_API_KEY) {
          const systemContent = getOpenAISystemContent(params.system);
          const completion = await openai.chat.completions.create({
            model: modelToUse.openai,
            messages: [
              ...(systemContent ? [{ role: 'system' as const, content: systemContent }] : []),
              ...params.messages,
            ],
            max_tokens: params.max_tokens,
            temperature: params.temperature ?? 0.7,
            stream: true,
          });

          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }

          controller.close();
          return;
        }

        throw new Error('No valid AI provider key available');
      } catch (error: any) {
        controller.error(error);
      }
    },
  });
}

export function getTextFromAIResponse(response: any) {
  const textContent = response.content?.find((block: any) => block.type === 'text');
  return textContent && 'text' in textContent ? textContent.text : '';
}
