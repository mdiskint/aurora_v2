import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

let _genAI: GoogleGenerativeAI | null = null;
let _ai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }
    if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return _genAI;
}

function getAi(): GoogleGenAI {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }
    if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return _ai;
}

// Legacy: inline base64 data (kept for backward compatibility with small files)
export async function callGemini(prompt: string, systemPrompt?: string, mediaData?: { mimeType: string; data: string }) {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-3-pro-preview' });

    const parts: any[] = [];

    if (systemPrompt) {
        parts.push({ text: `System: ${systemPrompt}\n\n` });
    }

    if (mediaData) {
        parts.push({
            inlineData: {
                mimeType: mediaData.mimeType,
                data: mediaData.data
            }
        });
    }

    parts.push({ text: `User: ${prompt}` });

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
}

// New: Upload file to Gemini File API, poll for processing, then generate content
export async function callGeminiWithFileAPI(
    filePath: string,
    mimeType: string,
    prompt: string,
    systemPrompt?: string
): Promise<string> {
    // 1. Upload file to Gemini File API
    console.log('📤 Uploading file to Gemini File API...');
    const ai = getAi();
    const uploadedFile = await ai.files.upload({
        file: filePath,
        config: { mimeType },
    });

    console.log(`✅ File uploaded: ${uploadedFile.name}, state: ${uploadedFile.state}`);

    // 2. Poll for processing completion
    let file = uploadedFile;
    let pollCount = 0;
    while (file.state === 'PROCESSING') {
        pollCount++;
        console.log(`⏳ File processing... (poll ${pollCount})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await ai.files.get({ name: file.name! });
    }

    if (file.state === 'FAILED') {
        throw new Error('Gemini file processing failed');
    }

    console.log(`✅ File ready: ${file.name}, state: ${file.state}`);

    // 3. Generate content using the file URI
    const contents: any[] = [];

    if (systemPrompt) {
        contents.push(`System: ${systemPrompt}\n\n`);
    }

    contents.push(createPartFromUri(file.uri!, file.mimeType!));
    contents.push(`User: ${prompt}`);

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: createUserContent(contents),
    });

    return response.text || '';
}

// Fast preprocessing for structured text conversion. Uses Gemini Flash if a
// GEMINI_API_KEY is set; otherwise falls back to Anthropic Haiku so the app
// works on Anthropic alone.
export async function callGeminiFlash(prompt: string, systemPrompt?: string): Promise<string> {
    if (process.env.GEMINI_API_KEY) {
        const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });
        const parts: any[] = [];
        if (systemPrompt) parts.push({ text: `System: ${systemPrompt}\n\n` });
        parts.push({ text: prompt });
        const result = await model.generateContent(parts);
        const response = await result.response;
        return response.text();
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY is set');
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: 'user', content: prompt }],
    });
    const block = message.content[0];
    return block.type === 'text' ? block.text : '';
}
