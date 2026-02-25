// lib/auth/session.ts

import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getAuth } from '../auth';
import { createAuthProxyHeaders, shouldProxyAuthRequest } from './auth-proxy';

const TOKEN_COOKIE_KEY = 'dory_access_token';

function getCloudApiBaseUrl(): string | null {
    const cloudUrl = process.env.DORY_CLOUD_API_URL ?? process.env.NEXT_PUBLIC_DORY_CLOUD_API_URL;
    if (typeof cloudUrl !== 'string' || !cloudUrl.trim()) return null;
    return cloudUrl.trim();
}

function getCloudAuthSessionUrl(): string | null {
    const base = getCloudApiBaseUrl();
    if (!base) return null;
    return new URL('/api/auth/get-session', base).toString();
}

function readBearerToken(reqHeaders: Headers): string | null {
    const authorization = reqHeaders.get('authorization') ?? reqHeaders.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
}

async function readCookieToken(req?: NextRequest): Promise<string | null> {
    // 1) Server Components 场景
    if (!req) {
        const v = (await cookies()).get(TOKEN_COOKIE_KEY)?.value ?? null;
        if (!v) return null;
        try {
            return decodeURIComponent(v);
        } catch {
            return v;
        }
    }

    // 2) Route Handler/Middleware 场景
    const cookieHeader = req.headers.get('cookie') ?? '';
    const m = cookieHeader.match(/(?:^|;\s*)dory_access_token=([^;]+)/);
    if (!m?.[1]) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        return m[1];
    }
}

function decodeJwtPayload(token: string): Record<string, any> | null {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payloadBase64Url = parts[1];
        const normalized = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const json = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/**
 * Desktop 弱校验：不验签，只校验 exp/iss/aud 并生成 session-like。
 * 目的：先跑通 Electron 刷新 SSR 的登录态。
 */
function jwtToSessionLoose(token: string) {
    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    // exp 校验
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= now) return null;

    // iss/aud 校验（按你 token 里 demo.getdory.dev 来；后续可做白名单/多环境）
    const allowedIss = new Set(['https://demo.getdory.dev']);
    const allowedAud = new Set(['https://demo.getdory.dev']);

    if (typeof payload.iss === 'string' && !allowedIss.has(payload.iss)) return null;
    if (typeof payload.aud === 'string' && !allowedAud.has(payload.aud)) return null;
    // 有些实现 aud 可能是数组
    if (Array.isArray(payload.aud) && !payload.aud.some((x: any) => typeof x === 'string' && allowedAud.has(x))) return null;

    const userId = payload.sub ?? payload.id;
    if (!userId) return null;

    return {
        session: { token },
        user: {
            id: String(userId),
            name: typeof payload.name === 'string' ? payload.name : null,
            email: typeof payload.email === 'string' ? payload.email : null,
            emailVerified: Boolean(payload.emailVerified),
            image: typeof payload.image === 'string' ? payload.image : null,
            defaultTeamId: typeof payload.defaultTeamId === 'string' ? payload.defaultTeamId : null,
        },
    };
}

export async function getSessionFromRequest(req?: NextRequest) {
    const auth = await getAuth();
    const reqHeaders = req ? req.headers : await headers();

    // ✅ 0) 先走 JWT（Bearer 或 Cookie）——用于 Electron/SSR 稳定登录态
    const bearerToken = readBearerToken(reqHeaders);
    const cookieToken = await readCookieToken(req);
    const token = bearerToken ?? cookieToken;

    // 你想继续观察日志可打开
    // console.log('[session] bearer?', Boolean(bearerToken), 'cookie?', Boolean(cookieToken), 'tokenLen', token?.length ?? 0);

    if (token) {
        const s = jwtToSessionLoose(token);
        if (s) return s;
    }

    // ✅ 1) Desktop runtime：再尝试代理到云端 get-session（可保留）
    if (shouldProxyAuthRequest()) {
        const sessionUrl = getCloudAuthSessionUrl();
        const cloudBase = getCloudApiBaseUrl();
        if (sessionUrl && cloudBase) {
            try {
                const res = await fetch(sessionUrl, {
                    headers: createAuthProxyHeaders(reqHeaders, cloudBase),
                    cache: 'no-store',
                });
                if (res.ok) {
                    const session = (await res.json()) as ReturnType<typeof auth.api.getSession>;
                    if (session) return session;
                }
            } catch {
                // ignore
            }
        }
    }

    // ✅ 2) 最后：本地 cookie session（Web / 本地场景）
    const session = await auth.api
        .getSession({
            headers: reqHeaders,
        })
        .catch(() => null);

    if (session) return session;

    return null;
}
