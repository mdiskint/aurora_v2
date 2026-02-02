import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFileAPI } from '@/lib/gemini';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export const maxDuration = 300; // 5 minutes for upload + processing + analysis

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            );
        }

        // 2GB is the Gemini File API max; cap at 500MB for practical serverless limits
        const MAX_FILE_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File too large. Please upload a video smaller than 500MB.' },
                { status: 400 }
            );
        }

        console.log(`🎥 Received video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY is not configured');
            return NextResponse.json(
                { error: 'Gemini API key not configured on server' },
                { status: 500 }
            );
        }

        console.log('✅ GEMINI_API_KEY is configured');

        // Write file to temp directory for Gemini File API upload
        const mimeType = file.type || 'video/mp4';
        const tempPath = join(tmpdir(), `gemini-upload-${Date.now()}-${file.name}`);

        try {
            const arrayBuffer = await file.arrayBuffer();
            await writeFile(tempPath, Buffer.from(arrayBuffer));
            console.log(`📁 Temp file written: ${tempPath}`);

            const systemPrompt = `You are an expert educational content creator. Your task is to watch the provided video, identify its natural topic segments, and produce structured teaching material for each segment.

    Return a valid JSON object with the following structure:
    {
      "title": "Engaging Course Title",
      "description": "A compelling description of what the student will learn.",
      "fullTextContent": "A comprehensive course overview covering the main themes, learning objectives, and how the sections connect to each other.",
      "timestamps": "0:00-2:30, 2:30-5:00",
      "sectionContents": [
        "Section Title: [clear title for this segment]\\n\\nKey Points:\\n- [concept or point 1]\\n- [concept or point 2]\\n- [concept or point 3]\\n\\nDefinitions & Examples:\\n- [term]: [definition or example as presented in the video]",
        "Section Title: [clear title for this segment]\\n\\nKey Points:\\n- ..."
      ]
    }

    IMPORTANT:
    1. The "timestamps" field must be a comma-separated list of time ranges (e.g., "0:00-1:30, 1:30-3:00"). Identify segments by natural topic transitions in the video.
    2. The "sectionContents" array must have the same number of items as the timestamps.
    3. Each entry in "sectionContents" MUST follow this structure:
       - Start with "Section Title:" followed by a clear, descriptive title for the segment.
       - A "Key Points:" block with 3-5 bullet points capturing the core concepts, arguments, or ideas taught in that segment.
       - A "Definitions & Examples:" block listing any important terms, definitions, formulas, or concrete examples mentioned. If none are applicable, write "None for this section."
    4. Do NOT transcribe the video word-for-word. Extract and reorganize the ideas into clear teaching material that a student can study from directly.
    5. The "fullTextContent" field should be a course overview, NOT a transcript. Summarize the overall subject, state what the student will learn, and briefly describe how the sections build on each other.
    6. Return ONLY the JSON object. Do not include markdown formatting or extra text.`;

            const userPrompt = "Analyze this video and generate a course structure.";

            console.log('🤖 Uploading to Gemini File API and analyzing...');

            const response = await callGeminiWithFileAPI(tempPath, mimeType, userPrompt, systemPrompt);

            console.log('✅ Gemini analysis complete');

            // Parse JSON response
            let jsonResponse;
            try {
                let cleanJson = response.trim();
                if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
                if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
                if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);

                jsonResponse = JSON.parse(cleanJson);
            } catch (e) {
                console.error('❌ Failed to parse Gemini response:', e);
                console.error('Raw response:', response);
                return NextResponse.json(
                    { error: 'Failed to parse AI response', rawResponse: response },
                    { status: 500 }
                );
            }

            return NextResponse.json(jsonResponse);
        } finally {
            // Clean up temp file
            try {
                await unlink(tempPath);
                console.log('🧹 Temp file cleaned up');
            } catch {
                // Ignore cleanup errors
            }
        }

    } catch (error: any) {
        console.error('❌ Error analyzing video:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to analyze video' },
            { status: 500 }
        );
    }
}
