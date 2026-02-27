import 'server-only';

function getCloudApiBaseUrl(): string | null {
    const cloudUrl = process.env.DORY_CLOUD_API_URL ?? process.env.NEXT_PUBLIC_DORY_CLOUD_API_URL;
    if (typeof cloudUrl === 'string' && cloudUrl.trim()) {
        return cloudUrl.trim();
    }
    return null;
}

export function shouldProxyAuthRequest(): boolean {
    const runtime = process.env.NEXT_PUBLIC_DORY_RUNTIME?.trim();
    return runtime === 'desktop' && Boolean(getCloudApiBaseUrl());
}

export function shouldProxyCloudRequest(): boolean {
    return shouldProxyAuthRequest();
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

    return [rewrittenNameValue, ...rewritten].join('; ');
}

function rewriteCookieHeaderForUpstream(value: string): string {
    const parts = value
        .split(';')
        .map(part => part.trim())
        .filter(Boolean);
    const withoutSecure = parts.filter(part => !part.startsWith('__Secure-better-auth.session_token='));

    return withoutSecure
        .map(part => {
            if (part.startsWith('better-auth.session_token=')) {
                return part.replace('better-auth.session_token=', '__Secure-better-auth.session_token=');
            }
            return part;
        })
        .join('; ');
}

function redactHeaderValue(name: string, value: string): string {
    const key = name.toLowerCase();
    if (key === 'authorization' || key === 'cookie' || key === 'set-cookie') {
        return '[redacted]';
    }
    return value;
}

function formatHeadersForLog(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
        result[key] = redactHeaderValue(key, value);
    });
    return result;
}

export function createAuthProxyHeaders(incoming: Headers, baseUrl: string): Headers {
    const headers = new Headers(incoming);

    headers.delete('host');
    headers.delete('connection');

    const upstreamOrigin = new URL(baseUrl).origin;
    if (headers.has('origin')) headers.set('origin', upstreamOrigin);

    const referer = headers.get('referer');
    if (referer) {
        const u = new URL(referer);
        headers.set('referer', upstreamOrigin + u.pathname + u.search);
    }

    const cookieHeader = headers.get('cookie');
    if (cookieHeader) {
        headers.set('cookie', rewriteCookieHeaderForUpstream(cookieHeader));
    }

    return headers;
}

export async function proxyAuthRequest(req: Request): Promise<Response> {
    const baseUrl = getCloudApiBaseUrl();
    if (!baseUrl) {
        return new Response('CLOUD_API_NOT_CONFIGURED', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    const incomingUrl = new URL(req.url);
    const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, baseUrl);
    const headers = createAuthProxyHeaders(req.headers, baseUrl);

    headers.delete('host');
    headers.delete('connection');

    const method = req.method.toUpperCase();
    const body = method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer();

    console.log('[auth-proxy] upstream request', {
        method,
        targetUrl: targetUrl.toString(),
        headers: formatHeadersForLog(headers),
        bodyBytes: body ? body.byteLength : 0,
    });

    const upstream = await fetch(targetUrl.toString(), {
        method,
        headers,
        body,
        redirect: 'manual',
    });

    console.log('[auth-proxy] upstream response', {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: formatHeadersForLog(upstream.headers),
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('set-cookie');
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    const isSecureRequest = incomingUrl.protocol === 'https:';
    const setCookies = getSetCookies(upstream.headers)
        .map(cookie => rewriteSetCookie(cookie, isSecureRequest))
        .filter(Boolean);
    for (const cookie of setCookies) {
        responseHeaders.append('set-cookie', cookie);
    }

    if (!isSecureRequest) {
        responseHeaders.append('set-cookie', '__Secure-better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    }

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}

export async function proxyCloudRequest(req: Request): Promise<Response> {
    return proxyAuthRequest(req);
}
