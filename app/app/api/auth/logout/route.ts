import { NextResponse } from 'next/server';

/**
 * DEPRECATED — legacy password-cookie logout.
 *
 * Retained as a no-op-compatible sibling of the deprecated login route. The
 * `aurora-auth` cookie it clears is no longer part of the security boundary;
 * real sessions are NextAuth JWT sessions ended via `/api/auth/signout`.
 */
export async function POST() {
    const response = NextResponse.json({ success: true });

    // Clear the auth cookie
    response.cookies.set('aurora-auth', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });

    return response;
}