// app/api/auth/resend-verification/route.ts
import { getAuth } from '@/lib/auth';
import { ResponseUtil } from '@/lib/result';
import { proxyAuthRequest, shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
    email: z.string().email(),
    callbackURL: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
    if (shouldProxyAuthRequest()) {
        return proxyAuthRequest(req);
    }
    const auth = await getAuth();
    const { email, callbackURL = '/' } = schema.parse(await req.json());

    const res = await auth.api.sendVerificationEmail({
        body: { email, callbackURL },
    });

    console.log('Resend verification response:', res);

    return NextResponse.json(ResponseUtil.success({ message: 'Verification email sent if the email is registered.' }));
}
