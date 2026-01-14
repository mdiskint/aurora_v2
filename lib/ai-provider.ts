import Anthropic from '@anthropic-ai/sdk';
import { callOpenAI } from './openai';
import { callGemini } from './gemini';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function callAI(params: {
    messages: any[];
    system?: string;
    model?: string;
    max_tokens?: number;
    temperature?: number;
}) {
    const { messages, system, mode } = params as any;

    // Try Anthropic first if key exists
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            console.log('🤖 Attempting Anthropic call...');
            const response = await anthropic.messages.create({
                model: params.model || 'claude-3-5-sonnet-20240620', // Default fallback
                max_tokens: params.max_tokens || 4096,
                system: system,
                messages: messages,
            });

            const textContent = response.content.find((block) => block.type === 'text');
            return textContent && 'text' in textContent ? textContent.text : '';
        } catch (error: any) {
            console.error('❌ Anthropic failed:', error.message);

            // If use limit or other non-auth error, try OpenAI
            if (process.env.OPENAI_API_KEY) {
                return fallbackToOpenAI(messages, system);
            }
            throw error;
        }
    } else if (process.env.OPENAI_API_KEY) {
        return fallbackToOpenAI(messages, system);
    } else {
        throw new Error('No AI provider keys configured');
    }
}

async function fallbackToOpenAI(messages: any[], system?: string) {
    console.log('🔄 Falling back to OpenAI...');
    try {
        const response = await callOpenAI(messages, system);
        return response;
    } catch (error: any) {
        console.error('❌ OpenAI also failed:', error.message);
        throw error;
    }
}
