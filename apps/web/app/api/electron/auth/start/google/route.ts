import { getAuth } from '@/lib/auth';
import { proxyAuthRequest, shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    if (shouldProxyAuthRequest()) {
        return proxyAuthRequest(req);
    }

    const auth = await getAuth();
    const envOrigin =
        process.env.DORY_ELECTRON_ORIGIN?.trim() ||
        process.env.NEXT_PUBLIC_DORY_ELECTRON_ORIGIN?.trim() ||
        '';
    const origin = envOrigin || new URL(req.url).origin;
    const finalizeUrl = `${origin}/api/electron/auth/finalize?provider=google`;

    const { response, headers } = await auth.api.signInSocial({
        headers: req.headers,
        body: {
            provider: 'google',
            callbackURL: finalizeUrl,
            errorCallbackURL: finalizeUrl,
            disableRedirect: true,
        },
        returnHeaders: true,
    });

    if (!response?.url) {
        return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 });
    }

    const res = NextResponse.json({ url: response.url });
    headers?.forEach((value, key) => {
        res.headers.append(key, value);
    });

    return res;
}
