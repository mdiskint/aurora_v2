import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';

// Legacy SDK client (used by callGemini for inline data)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// New SDK client (used by File API)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Legacy: inline base64 data (kept for backward compatibility with small files)
export async function callGemini(prompt: string, systemPrompt?: string, mediaData?: { mimeType: string; data: string }) {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

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

// Fast preprocessing with Gemini Flash for structured text conversion
export async function callGeminiFlash(prompt: string, systemPrompt?: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const parts: any[] = [];

    if (systemPrompt) {
        parts.push({ text: `System: ${systemPrompt}\n\n` });
    }

    parts.push({ text: prompt });

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
}

export { genAI, ai };
