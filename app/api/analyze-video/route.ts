import { NextRequest, NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';

export const maxDuration = 60; // Set max duration to 60 seconds for Vercel (optional but good practice)

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

        // Check file size (20MB limit for MVP)
        if (file.size > 20 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'File too large. Please upload a video smaller than 20MB.' },
                { status: 400 }
            );
        }

        console.log(`🎥 Received video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const mimeType = file.type || 'video/mp4';

        // Prompt for Gemini
        const systemPrompt = `You are an expert educational content creator. Your task is to watch the provided video and generate a structured course curriculum based on its content.
    
    Return a valid JSON object with the following structure:
    {
      "title": "Engaging Course Title",
      "description": "A compelling description of what the student will learn.",
      "fullTextContent": "A detailed summary or transcript of the video content.",
      "timestamps": "0:00-2:30, 2:30-5:00", // Key segments in MM:SS format
      "sectionContents": [
        "Detailed content for section 1...",
        "Detailed content for section 2..."
      ]
    }
    
    IMPORTANT:
    1. The "timestamps" field must be a comma-separated list of time ranges (e.g., "0:00-1:30, 1:30-3:00").
    2. The "sectionContents" array must have the same number of items as the timestamps.
    3. Ensure the content is educational, accurate, and directly derived from the video.
    4. Return ONLY the JSON object. Do not include markdown formatting or extra text.`;

        const userPrompt = "Analyze this video and generate a course structure.";

        console.log('🤖 Sending video to Gemini for analysis...');

        const response = await callGemini(userPrompt, systemPrompt, {
            mimeType,
            data: base64Data
        });

        console.log('✅ Gemini analysis complete');

        // Parse JSON response
        let jsonResponse;
        try {
            let cleanJson = response.trim();
            // Remove markdown code blocks if present
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

    } catch (error: any) {
        console.error('❌ Error analyzing video:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to analyze video' },
            { status: 500 }
        );
    }
}
