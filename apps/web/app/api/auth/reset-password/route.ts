// app/api/auth/reset-password/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getAuth } from '@/lib/auth';
import { proxyAuthRequest, shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';

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

function rewriteAuthResponse(req: Request, res: Response): Response {
    const isSecureRequest = new URL(req.url).protocol === 'https:';
    if (isSecureRequest) return res;

    const responseHeaders = new Headers(res.headers);
    responseHeaders.delete('set-cookie');

    const setCookies = getSetCookies(res.headers)
        .map(cookie => rewriteSetCookie(cookie, isSecureRequest))
        .filter(Boolean);
    for (const cookie of setCookies) {
        responseHeaders.append('set-cookie', cookie);
    }

    return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
    });
}

export async function POST(req: Request) {
    if (shouldProxyAuthRequest()) {
        return proxyAuthRequest(req);
    }
    const auth = await getAuth();
    const res = await auth.handler(req);
    return rewriteAuthResponse(req, res);
}
