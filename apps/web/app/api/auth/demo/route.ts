import { getAuth } from '@/lib/auth';
import { proxyAuthRequest, shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_USER = {
    email: 'demo@dory.local',
    password: 'demo',
    name: 'Demo User',
};

export async function POST(req: NextRequest) {
    if (shouldProxyAuthRequest()) {
        return proxyAuthRequest(req);
    }

    const auth = await getAuth();
    const ctx = await auth.$context;

    const existing = await ctx.internalAdapter.findUserByEmail(DEMO_USER.email, {
        includeAccounts: true,
    });

    const passwordHash = await ctx.password.hash(DEMO_USER.password);

    if (!existing) {
        const createdUser = await ctx.internalAdapter.createUser({
            email: DEMO_USER.email,
            name: DEMO_USER.name,
            emailVerified: true,
        });

        await ctx.internalAdapter.linkAccount({
            userId: createdUser.id,
            providerId: 'credential',
            accountId: createdUser.id,
            password: passwordHash,
        });
    } else {
        if (!existing.user.emailVerified) {
            await ctx.internalAdapter.updateUser(existing.user.id, { emailVerified: true });
        }

        const hasCredential = existing.accounts?.some(account => account.providerId === 'credential' && account.password);
        if (!hasCredential) {
            await ctx.internalAdapter.linkAccount({
                userId: existing.user.id,
                providerId: 'credential',
                accountId: existing.user.id,
                password: passwordHash,
            });
        } else {
            await ctx.internalAdapter.updatePassword(existing.user.id, passwordHash);
        }
    }

    const response = await auth.api.signInEmail({
        headers: req.headers,
        body: {
            email: DEMO_USER.email,
            password: DEMO_USER.password,
        },
        asResponse: true,
    });

    const res = NextResponse.json({ ok: true });
    const isSecureRequest = new URL(req.url).protocol === 'https:';
    if (isSecureRequest) {
        response.headers?.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') {
                res.headers.append('set-cookie', value);
            }
        });
        return res;
    }

    response.headers?.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') return;
        const parts = value.split(';');
        const [nameValue, ...attrs] = parts;
        let rewrittenNameValue = nameValue;
        if (!isSecureRequest && /^__Secure-/i.test(nameValue)) {
            rewrittenNameValue = nameValue.replace(/^__Secure-/i, '');
        }
        const rewritten = attrs
            .map(attr => attr.trim())
            .filter(attr => !/^domain=/i.test(attr))
            .map(attr => {
                if (!isSecureRequest && /^secure$/i.test(attr)) {
                    return '';
                }
                if (!isSecureRequest && /^samesite=none$/i.test(attr)) {
                    return 'SameSite=Lax';
                }
                return attr;
            })
            .filter(Boolean);
        res.headers.append('set-cookie', [rewrittenNameValue, ...rewritten].join('; '));
    });
    return res;
}
