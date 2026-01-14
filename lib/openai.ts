import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

export async function callOpenAI(messages: any[], systemPrompt?: string, model: string = 'gpt-4o') {
    const formattedMessages: any[] = [];

    if (systemPrompt) {
        formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    formattedMessages.push(...messages);

    const response = await openai.chat.completions.create({
        model,
        messages: formattedMessages as any,
        temperature: 0.7,
    });

    return response.choices[0].message.content;
}

export { openai };
