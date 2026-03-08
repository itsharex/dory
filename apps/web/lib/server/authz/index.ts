import { shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { resolveDesktopTeamAccess } from './authz.desktop';
import { resolveLocalTeamAccess } from './authz.local';
import type { TeamAccess, TeamAccessRole } from './types';

export type { TeamAccess, TeamAccessRole } from './types';

const TEAM_ACCESS_TTL_MS = 60 * 1000;

const teamAccessCache = new Map<
    string,
    {
        expiresAt: number;
        value: TeamAccess | null;
    }
>();

export async function resolveTeamAccess(teamId: string, userId: string): Promise<TeamAccess | null> {
    const proxy = shouldProxyAuthRequest();
    const cacheKey = `${proxy ? 'desktop' : 'local'}:${userId}:${teamId}`;
    const cached = teamAccessCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
        console.log('[authz] resolveTeamAccess:cache-hit', {
            teamId,
            userId,
            proxy,
            expiresInMs: cached.expiresAt - now,
        });
        return cached.value;
    }

    console.log('[authz] resolveTeamAccess', {
        teamId,
        userId,
        proxy,
        runtime: process.env.DORY_RUNTIME ?? null,
        publicRuntime: process.env.NEXT_PUBLIC_DORY_RUNTIME ?? null,
        cloudApiUrl: process.env.DORY_CLOUD_API_URL ?? process.env.NEXT_PUBLIC_DORY_CLOUD_API_URL ?? null,
    });

    const value = proxy
        ? await resolveDesktopTeamAccess(teamId, userId)
        : await resolveLocalTeamAccess(teamId, userId);

    teamAccessCache.set(cacheKey, {
        expiresAt: now + TEAM_ACCESS_TTL_MS,
        value,
    });

    return value;
}

export function canManageTeam(access: Pick<TeamAccess, 'isMember' | 'role'> | null): boolean {
    if (!access?.isMember) {
        return false;
    }

    return access.role === 'owner' || access.role === 'admin';
}
