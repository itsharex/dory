import { getAuth } from '@/lib/auth';
import { proxyAuthRequest, shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { serializeSignedCookie } from 'better-call';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    code: z.string().min(1),
});

export async function POST(req: NextRequest) {
    if (shouldProxyAuthRequest()) {
        return proxyAuthRequest(req);
    }

    const auth = await getAuth();
    const ctx = await auth.$context;
    const body = bodySchema.parse(await req.json().catch(() => ({})));

    const verification = await ctx.internalAdapter.findVerificationValue(body.code);
    if (!verification) {
        return NextResponse.json({ message: 'invalid_code' }, { status: 401 });
    }

    if (verification.expiresAt < new Date()) {
        await ctx.internalAdapter.deleteVerificationValue(verification.id);
        return NextResponse.json({ message: 'code_expired' }, { status: 401 });
    }

    let parsed: { userId?: string } | null = null;
    try {
        parsed = JSON.parse(verification.value) as { userId?: string };
    } catch {
        parsed = null;
    }

    const userId = parsed?.userId;
    if (!userId) {
        await ctx.internalAdapter.deleteVerificationValue(verification.id);
        return NextResponse.json({ message: 'invalid_code_payload' }, { status: 400 });
    }

    await ctx.internalAdapter.deleteVerificationValue(verification.id);

    const user = await ctx.internalAdapter.findUserById(userId);
    if (!user) {
        return NextResponse.json({ message: 'user_not_found' }, { status: 404 });
    }

    const session = await ctx.internalAdapter.createSession(user.id, false);
    if (!session) {
        return NextResponse.json({ message: 'failed_to_create_session' }, { status: 500 });
    }

    const maxAge = ctx.sessionConfig?.expiresIn ?? ctx.options.session?.expiresIn;
    const cookie = await serializeSignedCookie(
        ctx.authCookies.sessionToken.name,
        session.token,
        ctx.secret,
        {
            ...ctx.authCookies.sessionToken.attributes,
            ...(maxAge ? { maxAge } : {}),
        },
    );

    const res = NextResponse.json({ ok: true });
    res.headers.append('set-cookie', cookie);
    return res;
}
