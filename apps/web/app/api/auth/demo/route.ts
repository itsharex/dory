import { getAuth } from '@/lib/auth';
import { getDBService } from '@/lib/database';
import { proxyAuthRequest, shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { ensureDemoConnection } from '@/lib/demo/ensure-demo-connection';
import { createProvisionedOrganization } from '@/lib/auth/organization-provisioning';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_USER = {
    email: 'demo@getdory.dev',
    password: 'demo',
    name: 'Demo User',
};

const LEGACY_DEMO_EMAILS = ['demo@example.com', 'demo@dory.local'];

function slugifyOrganizationName(name: string) {
    const normalized = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || 'workspace';
}

function getSetCookies(headers: Headers): string[] {
    const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
    if (typeof anyHeaders.getSetCookie === 'function') {
        return anyHeaders.getSetCookie();
    }

    const raw = headers.get('set-cookie');
    if (!raw) return [];
    return [raw];
}

function rewriteSetCookie(value: string, isSecureRequest: boolean): string {
    const parts = value.split(';');
    const [nameValue, ...attrs] = parts;
    const normalizedAttrs = attrs.map(attr => attr.trim());
    const isClearingCookie = /=\s*$/.test(nameValue) || normalizedAttrs.some(attr => /^max-age=0$/i.test(attr)) || normalizedAttrs.some(attr => /^expires=/i.test(attr));

    let rewrittenNameValue = nameValue;
    if (!isSecureRequest && /^__Secure-/i.test(nameValue)) {
        if (isClearingCookie) {
            return '';
        }
        rewrittenNameValue = nameValue.replace(/^__Secure-/i, '');
    }

    const rewritten = normalizedAttrs
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

    return [rewrittenNameValue, ...rewritten].join('; ');
}

export async function POST(req: NextRequest) {
    if (shouldProxyAuthRequest()) {
        return proxyAuthRequest(req);
    }

    const auth = await getAuth();
    const ctx = await auth.$context;

    let existing = await ctx.internalAdapter.findUserByEmail(DEMO_USER.email, {
        includeAccounts: true,
    });

    if (!existing) {
        for (const legacyEmail of LEGACY_DEMO_EMAILS) {
            const legacyUser = await ctx.internalAdapter.findUserByEmail(legacyEmail, {
                includeAccounts: true,
            });

            if (!legacyUser) {
                continue;
            }

            await ctx.internalAdapter.updateUser(legacyUser.user.id, {
                email: DEMO_USER.email,
            });

            existing = await ctx.internalAdapter.findUserByEmail(DEMO_USER.email, {
                includeAccounts: true,
            });
            break;
        }
    }

    const passwordHash = await ctx.password.hash(DEMO_USER.password);

    let userId: string;

    if (!existing) {
        const createdUser = await ctx.internalAdapter.createUser({
            email: DEMO_USER.email,
            name: DEMO_USER.name,
            emailVerified: true,
        });

        userId = createdUser.id;

        await ctx.internalAdapter.linkAccount({
            userId: createdUser.id,
            providerId: 'credential',
            accountId: createdUser.id,
            password: passwordHash,
        });
    } else {
        userId = existing.user.id;

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

    const db = await getDBService();
    if (!db) {
        throw new Error('Database service not initialized');
    }

    const existingMemberships = await db.organizations.listByUser(userId);
    if (existingMemberships.length === 0) {
        const name = `${DEMO_USER.name}'s Workspace`;
        await createProvisionedOrganization({
            auth,
            userId,
            name,
            slug: `${slugifyOrganizationName(name)}-${userId.slice(0, 8)}`,
            provisioningKind: 'manual',
        });
    }

    // Ensure demo SQLite connection exists for the user's organization
    const memberships = await db.organizations.listByUser(userId);
    if (memberships.length > 0) {
        try {
            await ensureDemoConnection(db, userId, memberships[0]!.organizationId);
        } catch (error) {
            console.warn('[demo] failed to ensure demo connection:', error);
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
    const setCookies = getSetCookies(response.headers)
        .map(cookie => rewriteSetCookie(cookie, isSecureRequest))
        .filter(Boolean);

    for (const cookie of setCookies) {
        res.headers.append('set-cookie', cookie);
    }

    return res;
}
