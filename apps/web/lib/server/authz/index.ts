import { shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { resolveDesktopTeamAccess } from './authz.desktop';
import { resolveLocalTeamAccess } from './authz.local';
import type { TeamAccess, TeamAccessRole } from './types';

export type { TeamAccess, TeamAccessRole } from './types';

export async function resolveTeamAccess(teamId: string, userId: string): Promise<TeamAccess | null> {
    const proxy = shouldProxyAuthRequest();
    console.log('[authz] resolveTeamAccess', {
        teamId,
        userId,
        proxy,
        runtime: process.env.DORY_RUNTIME ?? null,
        publicRuntime: process.env.NEXT_PUBLIC_DORY_RUNTIME ?? null,
        cloudApiUrl: process.env.DORY_CLOUD_API_URL ?? process.env.NEXT_PUBLIC_DORY_CLOUD_API_URL ?? null,
    });

    if (proxy) {
        return resolveDesktopTeamAccess(teamId, userId);
    }

    return resolveLocalTeamAccess(teamId, userId);
}

export function canManageTeam(access: Pick<TeamAccess, 'isMember' | 'role'> | null): boolean {
    if (!access?.isMember) {
        return false;
    }

    return access.role === 'owner' || access.role === 'admin';
}
