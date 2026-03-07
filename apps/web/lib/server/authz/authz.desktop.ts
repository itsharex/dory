import { getSessionFromRequest } from '@/lib/auth/session';
import { createAuthProxyHeaders } from '@/lib/auth/auth-proxy';
import { getCloudApiBaseUrl } from '@/lib/cloud/url';
import { headers } from 'next/headers';
import type { TeamAccess } from './types';

async function fetchCloudTeamAccess(teamId: string): Promise<TeamAccess | null> {
    const cloudBaseUrl = getCloudApiBaseUrl();
    if (!cloudBaseUrl) {
        return null;
    }

    const incomingHeaders = await headers();
    const forwardedHeaders = createAuthProxyHeaders(incomingHeaders, cloudBaseUrl);
    const url = new URL('/api/team/access', cloudBaseUrl);
    url.searchParams.set('teamId', teamId);

    try {
        const response = await fetch(url.toString(), {
            headers: forwardedHeaders,
            cache: 'no-store',
        });

        if (!response.ok) {
            return null;
        }

        const payload = (await response.json().catch(() => null)) as
            | { code?: number; data?: { access?: TeamAccess | null } }
            | null;

        if (payload?.code !== 0) {
            return null;
        }

        return payload?.data?.access ?? null;
    } catch {
        return null;
    }
}

export async function resolveDesktopTeamAccess(teamId: string, userId: string): Promise<TeamAccess | null> {
    const session = await getSessionFromRequest();
    const sessionUserId = session?.user?.id ?? null;
    const defaultTeamId = session?.user?.defaultTeamId ?? null;

    if (!sessionUserId || !defaultTeamId) {
        return null;
    }

    if (sessionUserId !== userId || defaultTeamId !== teamId) {
        return null;
    }

    const cloudAccess = await fetchCloudTeamAccess(teamId);
    if (cloudAccess?.isMember) {
        return cloudAccess;
    }

    return {
        source: 'desktop',
        teamId,
        userId,
        isMember: true,
        role: null,
        team: {
            id: teamId,
            slug: teamId,
            name: teamId,
        },
    };
}
