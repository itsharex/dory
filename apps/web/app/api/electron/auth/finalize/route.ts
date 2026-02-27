import { getAuth } from '@/lib/auth';
import { schema } from '@/lib/database/schema';
import { getClient } from '@/lib/database/postgres/client';
import type { PostgresDBClient } from '@/types';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
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

function normalizeCookieName(name: string): string[] {
    const names = [name];
    if (name.startsWith('__Secure-')) names.push(name.replace(/^__Secure-/, ''));
    if (name.startsWith('__Host-')) names.push(name.replace(/^__Host-/, ''));
    return Array.from(new Set(names));
}

function extractSessionTokenFromRequest(req: Request, cookieName: string): string | null {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookieNames = normalizeCookieName(cookieName);
    for (const part of cookieHeader.split(';')) {
        const [rawName, ...rest] = part.split('=');
        const name = rawName?.trim();
        if (!name || !cookieNames.includes(name)) continue;
        const value = rest.join('=').trim();
        if (!value) return null;
        return decodeURIComponent(value);
    }

    return null;
}

function buildDeepLinkUrl(params: Record<string, string | undefined | null>) {
    const deepLinkUrl = new URL(DEEP_LINK);
    for (const [key, value] of Object.entries(params)) {
        if (value) {
            deepLinkUrl.searchParams.set(key, value);
        }
    }
    return deepLinkUrl.toString();
}

function createDeepLinkResponse(deepLinkUrl: string) {
    return new NextResponse(
        `
      <html>
        <body>
          <script>
            window.location.href = ${JSON.stringify(deepLinkUrl)};
          </script>
        </body>
      </html>
    `,
        { headers: { 'Content-Type': 'text/html' } },
    );
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
    const url = new URL(req.url);
    const error = url.searchParams.get('error');
    if (error) {
        const deepLinkUrl = buildDeepLinkUrl({
            error,
            error_description: url.searchParams.get('error_description') ?? undefined,
        });
        return createDeepLinkResponse(deepLinkUrl);
    }

    const auth = await getAuth();
    const ctx = await auth.$context;
    const sessionToken = extractSessionTokenFromRequest(req, ctx.authCookies.sessionToken.name);
    if (!sessionToken) {
        return NextResponse.json({ error: 'missing_session_cookie' }, { status: 401 });
    }

    const session = await ctx.internalAdapter.findSession(sessionToken);
    if (!session) {
        return NextResponse.json({ error: 'missing_session' }, { status: 401 });
    }

    const db = (await getClient()) as PostgresDBClient;
    const [dbUser] = await db.select().from(schema.user).where(eq(schema.user.id, session.user.id));
    const user = {
        id: dbUser?.id ?? session.user.id,
        email: dbUser?.email ?? session.user.email ?? null,
        name: dbUser?.name ?? session.user.name ?? null,
        image: dbUser?.image ?? session.user.image ?? null,
        emailVerified: dbUser?.emailVerified ?? session.user.emailVerified ?? false,
        defaultTeamId: dbUser?.defaultTeamId ?? (session.user as TicketUser).defaultTeamId ?? null,
    } satisfies TicketUser;
    const ticket = await createTicket(auth, { user });
    const deepLinkUrl = buildDeepLinkUrl({ ticket });

    return createDeepLinkResponse(deepLinkUrl);
}
