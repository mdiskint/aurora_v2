import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function callGemini(prompt: string, systemPrompt?: string) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\nUser: ${prompt}`
        : prompt;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
}

export { genAI };
