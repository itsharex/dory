// lib/auth/session.ts

import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getAuth } from '../auth';
import { createAuthProxyHeaders, shouldProxyAuthRequest } from './auth-proxy';

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

function getCookieNamesFromHeader(cookieHeader: string | null): string[] {
    if (!cookieHeader) return [];
    return cookieHeader
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => part.split('=')[0]?.trim())
        .filter((name): name is string => Boolean(name));
}


export async function getSessionFromRequest(req?: NextRequest) {
    const auth = await getAuth();
    const reqHeaders = req ? req.headers : await headers();
    const runtime = process.env.NEXT_PUBLIC_DORY_RUNTIME?.trim() ?? null;
    const cloudBase = getCloudApiBaseUrl();
    const proxied = shouldProxyAuthRequest();
    const strictProxyOnly = proxied && process.env.DORY_AUTH_PROXY_STRICT !== '0';
    const cookieNames = getCookieNamesFromHeader(reqHeaders.get('cookie'));

    if (proxied) {
        const sessionUrl = getCloudAuthSessionUrl();
        if (sessionUrl && cloudBase) {
            try {
                const res = await fetch(sessionUrl, {
                    headers: createAuthProxyHeaders(reqHeaders, cloudBase),
                    cache: 'no-store',
                });
                console.info('[auth/session] cloud session fetch result', {
                    runtime,
                    hasCloudBase: Boolean(cloudBase),
                    status: res.status,
                    ok: res.ok,
                    cookieNames,
                });
                if (res.ok) {
                    const session = (await res.json()) as ReturnType<typeof auth.api.getSession>;
                    if (session) {
                        console.info('[auth/session] resolved via cloud proxy', {
                            runtime,
                            hasCloudBase: Boolean(cloudBase),
                            status: res.status,
                            cookieNames,
                        });
                        return session;
                    }
                    console.warn('[auth/session] cloud fetch ok but empty session', {
                        runtime,
                        hasCloudBase: Boolean(cloudBase),
                        status: res.status,
                        cookieNames,
                    });
                } else {
                    console.warn('[auth/session] cloud fetch not ok', {
                        runtime,
                        hasCloudBase: Boolean(cloudBase),
                        status: res.status,
                        cookieNames,
                    });
                }
            } catch {
                console.warn('[auth/session] cloud fetch threw', {
                    runtime,
                    hasCloudBase: Boolean(cloudBase),
                    cookieNames,
                });
            }
        }

        if (strictProxyOnly) {
            console.warn('[auth/session] proxy mode enabled, skip local fallback (strict)', {
                runtime,
                hasCloudBase: Boolean(cloudBase),
                cookieNames,
            });
            return null;
        }

        console.warn('[auth/session] cloud session unavailable, fallback to local auth', {
            runtime,
            hasCloudBase: Boolean(cloudBase),
            cookieNames,
        });
    }

    const session = await auth.api
        .getSession({
            headers: reqHeaders,
        })
        .catch(() => null);

    if (session) {
        console.info('[auth/session] resolved via local auth', {
            runtime,
            hasCloudBase: Boolean(cloudBase),
            cookieNames,
        });
        return session;
    }

    console.warn('[auth/session] no session resolved', {
        runtime,
        hasCloudBase: Boolean(cloudBase),
        proxied,
        cookieNames,
    });

    return null;
}
