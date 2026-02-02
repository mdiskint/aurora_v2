import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { universes: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user.universes);
    } catch (error) {
        console.error('Error fetching universes:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, data, videoUrl } = body;

        if (!id || !data) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const universe = await prisma.universe.upsert({
            where: { id },
            update: {
                data,
                videoUrl,
                updatedAt: new Date(),
            },
            create: {
                id,
                userId: user.id,
                data,
                videoUrl,
            },
        });

        return NextResponse.json(universe);
    } catch (error) {
        console.error('Error saving universe:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { universeId } = await req.json();

        if (!universeId) {
            return NextResponse.json({ error: 'Missing universeId' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await prisma.universe.delete({
            where: {
                id: universeId,
                userId: user.id,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        // P2025 = record not found — not an error if already deleted locally
        if (error?.code === 'P2025') {
            return NextResponse.json({ success: true });
        }
        console.error('Error deleting universe:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
