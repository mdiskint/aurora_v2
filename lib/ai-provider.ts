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

    // Try OpenAI first if key exists
    if (process.env.OPENAI_API_KEY) {
        try {
            return await fallbackToOpenAI(messages, system);
        } catch (error: any) {
            console.error('❌ OpenAI failed:', error.message);
            // Fall through to Anthropic
            if (process.env.ANTHROPIC_API_KEY) {
                return await callAnthropic(params, messages, system);
            }
            throw error;
        }
    } else if (process.env.ANTHROPIC_API_KEY) {
        return await callAnthropic(params, messages, system);
    } else {
        throw new Error('No AI provider keys configured');
    }
}

async function callAnthropic(params: any, messages: any[], system?: string) {
    console.log('🔄 Falling back to Anthropic...');
    try {
        const response = await anthropic.messages.create({
            model: params.model || 'claude-sonnet-4-5-20250929',
            max_tokens: params.max_tokens || 4096,
            system: system,
            messages: messages,
        });

        const textContent = response.content.find((block) => block.type === 'text');
        return textContent && 'text' in textContent ? (textContent as any).text : '';
    } catch (error: any) {
        console.error('❌ Anthropic also failed:', error.message);
        throw error;
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
