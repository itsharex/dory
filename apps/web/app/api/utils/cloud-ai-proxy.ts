import { NextRequest } from 'next/server';
import { USE_CLOUD_AI } from '@/app/config/app';

const FORWARDED_HEADERS = [
    'content-type',
    'cookie',
    'authorization',
    'x-connection-id',
    'accept-language',
];

function resolveCloudBaseUrl(): string | null {
    const aiCloudUrl = process.env.DORY_AI_CLOUD_URL?.trim();
    if (aiCloudUrl) return aiCloudUrl;

    const cloudUrl = process.env.DORY_CLOUD_API_URL?.trim();
    if (cloudUrl) return cloudUrl;

    const publicCloudUrl = process.env.NEXT_PUBLIC_DORY_CLOUD_API_URL?.trim();
    if (publicCloudUrl) return publicCloudUrl;

    return null;
}

function buildForwardHeaders(req: NextRequest): Headers {
    const headers = new Headers();
    for (const key of FORWARDED_HEADERS) {
        const value = req.headers.get(key);
        if (value) headers.set(key, value);
    }
    return headers;
}

export async function proxyAiRouteIfNeeded(
    req: NextRequest,
    pathname: string,
    options?: {
        body?: unknown;
    },
): Promise<Response | null> {
    if (!USE_CLOUD_AI) return null;

    const baseUrl = resolveCloudBaseUrl();
    if (!baseUrl) {
        return new Response('CLOUD_API_NOT_CONFIGURED', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    let currentOrigin: string | null = null;
    try {
        currentOrigin = new URL(req.url).origin;
    } catch {
        currentOrigin = null;
    }

    const target = new URL(pathname, baseUrl);
    if (currentOrigin && target.origin === currentOrigin) {
        return new Response('CLOUD_API_URL_MUST_DIFFER_FROM_LOCAL_ORIGIN', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    const method = req.method.toUpperCase();
    const shouldSendBody = method !== 'GET' && method !== 'HEAD';
    const body =
        !shouldSendBody
            ? undefined
            : options && 'body' in options
              ? JSON.stringify(options.body)
              : await req.text();

    const upstream = await fetch(target.toString(), {
        method,
        headers: buildForwardHeaders(req),
        body,
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}
