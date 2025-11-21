import { NextRequest, NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message } = body;

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        console.log('🤖 Gemini API test - User message:', message);

        const response = await callGemini(
            message,
            'You are Astryon AI, a helpful and knowledgeable assistant.'
        );

        console.log('✅ Gemini response:', response.substring(0, 100));

        return NextResponse.json({
            response,
            model: 'gemini-2.0-flash-exp'
        });

    } catch (error: any) {
        console.error('❌ Error calling Gemini API:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get response from Gemini' },
            { status: 500 }
        );
    }
}
