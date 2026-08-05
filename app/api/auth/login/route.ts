import { NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATED — legacy password-cookie login.
 *
 * This route is retained so existing frontend callers do not 404, but it is
 * REMOVED from the security boundary: the App Router middleware no longer
 * honors the `aurora-auth` cookie it sets, and no protected route checks it.
 * Real authentication is handled by NextAuth (OAuth + JWT session) via
 * `/api/auth/*` and the session-based `requireUser` helper.
 *
 * Do not extend this route. Use NextAuth sign-in instead.
 */
export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();

        // Check password against environment variable
        const correctPassword = process.env.AURORA_PASSWORD;

        if (!correctPassword) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        if (password === correctPassword) {
            // Create response with auth cookie
            const response = NextResponse.json({ success: true });

            // Set HTTP-only cookie for security
            response.cookies.set('aurora-auth', 'authenticated', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 7 days
                path: '/',
            });

            return response;
        } else {
            return NextResponse.json(
                { error: 'Invalid password' },
                { status: 401 }
            );
        }
    } catch (error) {
        return NextResponse.json(
            { error: 'Invalid request' },
            { status: 400 }
        );
    }
}