import type { getSessionFromRequest } from './session';
import { resolveOrganizationIdForSession } from './migration-state';

type SessionResult = Awaited<ReturnType<typeof getSessionFromRequest>>;

type SessionLike = SessionResult | null | undefined;

type SessionRecord = {
    activeOrganizationId?: string | null;
};

type UserRecord = {
    defaultTeamId?: string | null;
};

function asSessionRecord(session: SessionLike): SessionRecord | null {
    const value = session as { session?: SessionRecord } | null | undefined;
    return value?.session ?? null;
}

function asUserRecord(session: SessionLike): UserRecord | null {
    const value = session as { user?: UserRecord } | null | undefined;
    return value?.user ?? null;
}

export function getActiveOrganizationIdFromSession(session: SessionLike): string | null {
    return asSessionRecord(session)?.activeOrganizationId ?? null;
}

export function getLegacyDefaultTeamIdFromSession(session: SessionLike): string | null {
    return asUserRecord(session)?.defaultTeamId ?? null;
}

export function resolveCurrentOrganizationId(session: SessionLike): string | null {
    return resolveOrganizationIdForSession({
        activeOrganizationId: getActiveOrganizationIdFromSession(session),
        legacyDefaultTeamId: getLegacyDefaultTeamIdFromSession(session),
    });
}
