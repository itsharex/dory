// lib/api/with-team-handler.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getDBService } from '@/lib/database';
import { ErrorCodes } from '@/lib/errors';
import { ResponseUtil } from '@/lib/result';
import { getApiLocale, translateApi } from '@/app/api/utils/i18n';
import { canManageTeam, resolveTeamAccess } from '@/lib/server/authz';

type TeamHandlerContext = {
    req: NextRequest;
    db: Awaited<ReturnType<typeof getDBService>>;
    session: Awaited<ReturnType<typeof getSessionFromRequest>>;
    userId: string | null;
    teamId: string;
};

type UserHandlerContext = Omit<TeamHandlerContext, 'teamId'> & {
    userId: string;
};

type UserTeamHandlerContext = Omit<TeamHandlerContext, 'userId'> & {
    userId: string;
};
type ManagedTeamHandlerContext = UserTeamHandlerContext & {
    access: Awaited<ReturnType<typeof resolveTeamAccess>>;
};

type TeamHandlerFn = (ctx: TeamHandlerContext) => Promise<Response>;
type UserHandlerFn = (ctx: UserHandlerContext) => Promise<Response>;
type UserTeamHandlerFn = (ctx: UserTeamHandlerContext) => Promise<Response>;
type ManagedTeamHandlerFn = (ctx: ManagedTeamHandlerContext) => Promise<Response>;
type PlatformAdminHandlerFn = (ctx: UserHandlerContext) => Promise<Response>;

function parseCsvEnv(name: string): string[] {
    const raw = process.env[name];
    if (!raw) return [];
    return raw
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function isPlatformAdmin(session: Awaited<ReturnType<typeof getSessionFromRequest>>): boolean {
    const user = session?.user;
    if (!user) return false;

    const adminIds = new Set(parseCsvEnv('DORY_PLATFORM_ADMIN_IDS'));
    const adminEmails = new Set(parseCsvEnv('DORY_PLATFORM_ADMIN_EMAILS').map(email => email.toLowerCase()));

    if (user.id && adminIds.has(user.id)) return true;
    if (user.email && adminEmails.has(user.email.toLowerCase())) return true;

    return false;
}

async function withHandlerErrorBoundary(handler: () => Promise<Response>) {
    const locale = await getApiLocale();

    try {
        return await handler();
    } catch (err: any) {
        return NextResponse.json(
            ResponseUtil.error({
                code: ErrorCodes.DATABASE_ERROR,
                message: err?.message ?? translateApi('Api.Errors.InternalError', undefined, locale),
                error: err,
            }),
            { status: 500 },
        );
    }
}

export function withUserHandler(handler: UserHandlerFn) {
    return async function routeHandler(req: NextRequest): Promise<Response> {
        const locale = await getApiLocale();
        const session = await getSessionFromRequest(req);
        const userId = session?.user?.id ?? null;

        if (!userId) {
            return NextResponse.json(
                ResponseUtil.error({
                    code: ErrorCodes.UNAUTHORIZED,
                    message: translateApi('Api.Errors.Unauthorized', undefined, locale),
                }),
                { status: 401 },
            );
        }

        const db = await getDBService();

        return withHandlerErrorBoundary(async () => {
            return handler({
                req,
                db,
                session,
                userId,
            });
        });
    };
}

export function withTeamHandler(handler: TeamHandlerFn) {
    return async function routeHandler(req: NextRequest): Promise<Response> {
        const locale = await getApiLocale();
        const session = await getSessionFromRequest(req);
        const teamId = session?.user?.defaultTeamId ?? null;
        const userId = session?.user?.id ?? null;

        if (!teamId) {
            return NextResponse.json(
                ResponseUtil.error({
                    code: ErrorCodes.UNAUTHORIZED,
                    message: translateApi('Api.Errors.MissingTeamContext', undefined, locale),
                }),
                { status: 401 },
            );
        }

        const db = await getDBService();

        return withHandlerErrorBoundary(async () => {
            return handler({
                req,
                db,
                session,
                userId,
                teamId,
            });
        });
    };
}

export function withUserAndTeamHandler(handler: UserTeamHandlerFn) {
    return async function routeHandler(req: NextRequest): Promise<Response> {
        const locale = await getApiLocale();
        const session = await getSessionFromRequest(req);
        const teamId = session?.user?.defaultTeamId ?? null;
        const userId = session?.user?.id ?? null;

        if (!userId) {
            return NextResponse.json(
                ResponseUtil.error({
                    code: ErrorCodes.UNAUTHORIZED,
                    message: translateApi('Api.Errors.Unauthorized', undefined, locale),
                }),
                { status: 401 },
            );
        }

        if (!teamId) {
            return NextResponse.json(
                ResponseUtil.error({
                    code: ErrorCodes.UNAUTHORIZED,
                    message: translateApi('Api.Errors.MissingTeamContext', undefined, locale),
                }),
                { status: 401 },
            );
        }

        const db = await getDBService();

        return withHandlerErrorBoundary(async () => {
            return handler({
                req,
                db,
                session,
                userId,
                teamId,
            });
        });
    };
}

export function withPlatformAdminHandler(handler: PlatformAdminHandlerFn) {
    return async function routeHandler(req: NextRequest): Promise<Response> {
        const locale = await getApiLocale();
        const session = await getSessionFromRequest(req);
        const userId = session?.user?.id ?? null;

        if (!userId) {
            return NextResponse.json(
                ResponseUtil.error({
                    code: ErrorCodes.UNAUTHORIZED,
                    message: translateApi('Api.Errors.Unauthorized', undefined, locale),
                }),
                { status: 401 },
            );
        }

        if (!isPlatformAdmin(session)) {
            return NextResponse.json(
                ResponseUtil.error({
                    code: ErrorCodes.FORBIDDEN,
                    message: 'Forbidden',
                }),
                { status: 403 },
            );
        }

        const db = await getDBService();

        return withHandlerErrorBoundary(async () => {
            return handler({
                req,
                db,
                session,
                userId,
            });
        });
    };
}

export function withManagedTeamHandler(handler: ManagedTeamHandlerFn) {
    return withUserAndTeamHandler(async ctx => {
        const locale = await getApiLocale();
        const access = await resolveTeamAccess(ctx.teamId, ctx.userId);

        if (!canManageTeam(access)) {
            return NextResponse.json(
                ResponseUtil.error({
                    code: ErrorCodes.FORBIDDEN,
                    message: translateApi('ErrorCodes.FORBIDDEN', undefined, locale),
                }),
                { status: 403 },
            );
        }

        return handler({
            ...ctx,
            access,
        });
    });
}
