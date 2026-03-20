import { withUserHandler } from '@/app/api/utils/with-team-handler';
import { getApiLocale, translateApi } from '@/app/api/utils/i18n';
import { ErrorCodes } from '@/lib/errors';
import { ResponseUtil } from '@/lib/result';
import { NextResponse } from 'next/server';
import { resolveTeamAccess } from '@/lib/server/authz';
import { resolveCurrentOrganizationId } from '@/lib/auth/current-organization';

export const runtime = 'nodejs';

export const GET = withUserHandler(async ({ req, session, userId }) => {
    const locale = await getApiLocale();
    const requestedTeamId = req.nextUrl.searchParams.get('teamId');
    const teamId = requestedTeamId ?? resolveCurrentOrganizationId(session);

    if (!teamId) {
        return NextResponse.json(
            ResponseUtil.error({
                code: ErrorCodes.INVALID_PARAMS,
                message: translateApi('Api.Errors.MissingTeamContext', undefined, locale),
            }),
            { status: 400 },
        );
    }

    const access = await resolveTeamAccess(teamId, userId);
    if (!access?.isMember) {
        return NextResponse.json(
            ResponseUtil.error({
                code: ErrorCodes.FORBIDDEN,
                message: translateApi('Api.Errors.Unauthorized', undefined, locale),
            }),
            { status: 403 },
        );
    }

    return NextResponse.json(ResponseUtil.success({ access }));
});
