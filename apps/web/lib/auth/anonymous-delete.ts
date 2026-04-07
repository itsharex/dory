import { NextResponse } from 'next/server';
import { appendClearAnonymousRecoveryCookieHeader } from './anonymous-recovery';

export function isLocalAnonymousDeleteRequest(pathname: string) {
    return pathname.endsWith('/delete-anonymous-user');
}

export function buildAnonymousDeleteResponse(req: Request) {
    const response = NextResponse.json({ success: true });
    const isSecureRequest = new URL(req.url).protocol === 'https:';
    const cookieOptions = {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: isSecureRequest,
    };

    response.cookies.set('better-auth.session_token', '', cookieOptions);
    response.cookies.set('__Secure-better-auth.session_token', '', cookieOptions);
    appendClearAnonymousRecoveryCookieHeader(response.headers, req.url);

    return response;
}
