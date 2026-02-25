import { getAuth } from '@/lib/auth';
import { proxyAuthRequest, shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_DEEP_LINK = 'dory://auth/callback';
const CODE_TTL_MS = 5 * 60 * 1000;

function safeUrl(input: string, fallback: string) {
    try {
        return new URL(input);
    } catch {
        return new URL(fallback);
    }
}

function appendError(url: URL, error: string) {
    url.searchParams.set('error', error);
}

function appendCode(url: URL, code: string) {
    url.searchParams.set('code', code);
}

async function createOneTimeCode(auth: Awaited<ReturnType<typeof getAuth>>, userId: string) {
    const ctx = await auth.$context;
    const code = `electron-${randomUUID()}`;
    const verification = await ctx.internalAdapter.createVerificationValue({
        value: JSON.stringify({ userId }),
        identifier: code,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    if (!verification) {
        throw new Error('failed_to_create_code');
    }

    return code;
}

export async function GET(req: NextRequest) {
    // Desktop runtime：本地 standalone 直接把 bridge 转发到云端
    // 让云端 bridge 生成 deep link（token/error）后返回给本地
    if (shouldProxyAuthRequest()) {
        return proxyAuthRequest(req);
    }

    const auth = await getAuth();
    // 确保 baseURL 正确（你原逻辑保留）
    const ctx = await auth.$context;
    const origin = req.nextUrl.origin;
    if (!ctx.options.baseURL) {
        const basePath = ctx.options.basePath ?? '/api/auth';
        const authBaseURL = `${origin.trim()}${basePath}`;
        ctx.options.baseURL = authBaseURL;
        ctx.baseURL = authBaseURL;
    }

    const redirectTo = req.nextUrl.searchParams.get('redirectTo') ?? DEFAULT_DEEP_LINK;
    const errorParam = req.nextUrl.searchParams.get('error');
    let error: string | null = errorParam ?? null;

    let code: string | null = null;
    if (!error) {
        const session = await auth.api
            .getSession({
                headers: req.headers,
            })
            .catch(() => null);

        if (!session) {
            error = 'missing_session';
        } else {
            try {
                code = await createOneTimeCode(auth, session.user.id);
            } catch (err) {
                console.error('[auth-bridge] failed to create code', err);
                error = 'failed_to_create_code';
            }
        }
    }

    const deepLinkUrl = safeUrl(redirectTo, DEFAULT_DEEP_LINK);

    if (error) appendError(deepLinkUrl, error);
    if (code) appendCode(deepLinkUrl, code);

    return NextResponse.redirect(deepLinkUrl.toString());
}
