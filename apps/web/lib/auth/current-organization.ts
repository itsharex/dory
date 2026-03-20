import type { getSessionFromRequest } from './session';
import { resolveOrganizationIdForSession } from './migration-state';

type SessionResult = Awaited<ReturnType<typeof getSessionFromRequest>>;

type SessionLike = SessionResult | null | undefined;

type SessionRecord = {
    activeOrganizationId?: string | null;
};

function asSessionRecord(session: SessionLike): SessionRecord | null {
    const value = session as { session?: SessionRecord } | null | undefined;
    return value?.session ?? null;
}

export function getActiveOrganizationIdFromSession(session: SessionLike): string | null {
    return asSessionRecord(session)?.activeOrganizationId ?? null;
}

export function resolveCurrentOrganizationIdStrict(session: SessionLike): string | null {
    return getActiveOrganizationIdFromSession(session);
}

export function resolveCurrentOrganizationId(session: SessionLike): string | null {
    return resolveOrganizationIdForSession({
        activeOrganizationId: resolveCurrentOrganizationIdStrict(session),
    });
}
