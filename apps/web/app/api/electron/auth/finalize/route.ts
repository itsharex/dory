import { getAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEEP_LINK = 'dory://auth-complete';
const TICKET_TTL_MS = 5 * 60 * 1000;

type TicketUser = {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
    defaultTeamId?: string | null;
};

function getSetCookies(headers: Headers): string[] {
    const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
    if (typeof anyHeaders.getSetCookie === 'function') {
        return anyHeaders.getSetCookie();
    }

    const raw = headers.get('set-cookie');
    if (!raw) return [];
    return [raw];
}

function readCookieValueFromSetCookie(setCookie: string, name: string): string | null {
    const match = setCookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function normalizeCookieName(name: string): string[] {
    const names = [name];
    if (name.startsWith('__Secure-')) names.push(name.replace(/^__Secure-/, ''));
    if (name.startsWith('__Host-')) names.push(name.replace(/^__Host-/, ''));
    return Array.from(new Set(names));
}

function extractSessionTokenFromHeaders(headers: Headers, cookieName: string): string | null {
    const cookieNames = normalizeCookieName(cookieName);
    for (const cookie of getSetCookies(headers)) {
        for (const name of cookieNames) {
            const value = readCookieValueFromSetCookie(cookie, name);
            if (value) return value;
        }
    }
    return null;
}

async function createTicket(auth: Awaited<ReturnType<typeof getAuth>>, payload: { user: TicketUser }) {
    const ctx = await auth.$context;
    const ticket = `electron-${randomUUID()}`;
    const verification = await ctx.internalAdapter.createVerificationValue({
        value: JSON.stringify(payload),
        identifier: ticket,
        expiresAt: new Date(Date.now() + TICKET_TTL_MS),
    });

    if (!verification) {
        throw new Error('failed_to_create_ticket');
    }

    return ticket;
}

export async function GET(req: Request) {
    const auth = await getAuth();

    const response = await auth.api.callbackOAuth({
        headers: req.headers,
        params: { id: 'github' },
        query: Object.fromEntries(new URL(req.url).searchParams),
        asResponse: true,
    });

    const ctx = await auth.$context;
    const sessionToken = extractSessionTokenFromHeaders(response.headers ?? new Headers(), ctx.authCookies.sessionToken.name);
    if (!sessionToken) {
        return NextResponse.json({ error: 'missing_session_cookie' }, { status: 401 });
    }

    const session = await ctx.internalAdapter.findSession(sessionToken);
    if (!session) {
        return NextResponse.json({ error: 'missing_session' }, { status: 401 });
    }

    const user = session.user as TicketUser;
    const ticket = await createTicket(auth, { user });
    const deepLinkUrl = new URL(DEEP_LINK);
    deepLinkUrl.searchParams.set('ticket', ticket);

    const res = new NextResponse(
        `
      <html>
        <body>
          <script>
            window.location.href = "${deepLinkUrl.toString()}";
          </script>
        </body>
      </html>
    `,
        { headers: { 'Content-Type': 'text/html' } },
    );

    return res;
}
