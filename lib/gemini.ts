import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function callGemini(prompt: string, systemPrompt?: string, mediaData?: { mimeType: string; data: string }) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const parts: any[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
        parts.push({ text: `System: ${systemPrompt}\n\n` });
    }

    // Add media if provided
    if (mediaData) {
        parts.push({
            inlineData: {
                mimeType: mediaData.mimeType,
                data: mediaData.data
            }
        });
    }

    // Add user prompt
    parts.push({ text: `User: ${prompt}` });

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
}

export { genAI };
