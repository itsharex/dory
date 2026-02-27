import { getAuth } from '@/lib/auth';
import { serializeSignedCookie } from 'better-call';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    ticket: z.string().min(1),
});

function getCloudApiBaseUrl(): string | null {
    const cloudUrl = process.env.DORY_CLOUD_API_URL ?? process.env.NEXT_PUBLIC_DORY_CLOUD_API_URL;
    if (typeof cloudUrl !== 'string' || !cloudUrl.trim()) return null;
    return cloudUrl.trim();
}

type TicketUser = {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
    defaultTeamId?: string | null;
};

async function createLocalSession(user: TicketUser) {
    const auth = await getAuth();
    const ctx = await auth.$context;

    let localUserId: string | null = null;
    if (user.email) {
        const existing = await ctx.internalAdapter.findUserByEmail(user.email, { includeAccounts: false });
        if (existing?.user?.id) {
            localUserId = existing.user.id;
            await ctx.internalAdapter.updateUser(localUserId, {
                name: user.name ?? existing.user.name ?? user.email,
                image: user.image ?? existing.user.image ?? null,
                emailVerified: user.emailVerified ?? existing.user.emailVerified,
                defaultTeamId: user.defaultTeamId ?? (existing.user as any).defaultTeamId ?? null,
            });
        }
    }

    if (!localUserId) {
        const created = await ctx.internalAdapter.createUser({
            email: user.email || '',
            name: user.name ?? user.email ?? 'User',
            image: user.image ?? null,
            emailVerified: user.emailVerified ?? true,
            defaultTeamId: user.defaultTeamId ?? null,
        });
        localUserId = created.id;
    }

    const session = await ctx.internalAdapter.createSession(localUserId, false);
    if (!session) {
        return NextResponse.json({ error: 'failed_to_create_session' }, { status: 500 });
    }

    const maxAge = ctx.sessionConfig?.expiresIn ?? ctx.options.session?.expiresIn;
    const baseAttrs = ctx.authCookies.sessionToken.attributes;
    const adjustedAttrs = {
        ...baseAttrs,
        ...(maxAge ? { maxAge } : {}),
        ...(baseAttrs.secure ? { secure: false } : {}),
        ...(String(baseAttrs.sameSite).toLowerCase() === 'none' ? { sameSite: 'lax' as const } : {}),
    };
    const cookie = await serializeSignedCookie(ctx.authCookies.sessionToken.name, session.token, ctx.secret, adjustedAttrs);

    const res = NextResponse.json({ ok: true });
    res.headers.append('set-cookie', cookie);
    return res;
}

async function consumeTicketFromCloud(ticket: string) {
    const baseUrl = getCloudApiBaseUrl();
    if (!baseUrl) {
        return NextResponse.json({ error: 'cloud_api_not_configured' }, { status: 500 });
    }

    const targetUrl = new URL('/api/electron/auth/consume', baseUrl).toString();
    const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
    });

    if (!upstream.ok) {
        const data = await upstream.json().catch(() => null);
        return NextResponse.json({ error: data?.error ?? 'ticket_exchange_failed' }, { status: upstream.status });
    }

    const data = (await upstream.json().catch(() => null)) as { user?: TicketUser } | null;
    const user = data?.user;
    if (!user) {
        return NextResponse.json({ error: 'missing_user_payload' }, { status: 500 });
    }

    return createLocalSession(user);
}

async function consumeTicketLocally(ticket: string) {
    const auth = await getAuth();
    const ctx = await auth.$context;

    const verification = await ctx.internalAdapter.findVerificationValue(ticket);
    if (!verification) {
        return NextResponse.json({ error: 'invalid_ticket' }, { status: 401 });
    }

    if (verification.expiresAt < new Date()) {
        await ctx.internalAdapter.deleteVerificationValue(verification.id);
        return NextResponse.json({ error: 'ticket_expired' }, { status: 401 });
    }

    let parsed: { user?: TicketUser } | null = null;
    try {
        parsed = JSON.parse(verification.value) as { user?: TicketUser };
    } catch {
        parsed = null;
    }

    const user = parsed?.user;
    if (!user) {
        await ctx.internalAdapter.deleteVerificationValue(verification.id);
        return NextResponse.json({ error: 'invalid_ticket_payload' }, { status: 400 });
    }

    await ctx.internalAdapter.deleteVerificationValue(verification.id);
    return NextResponse.json({ user });
}

export async function POST(req: Request) {
    const runtime = process.env.NEXT_PUBLIC_DORY_RUNTIME?.trim();
    const body = bodySchema.parse(await req.json().catch(() => ({})));

    if (runtime === 'desktop') {
        return consumeTicketFromCloud(body.ticket);
    }

    return consumeTicketLocally(body.ticket);
}
