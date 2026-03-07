import { shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { resolveDesktopTeamAccess } from './authz.desktop';
import { resolveLocalTeamAccess } from './authz.local';
import type { TeamAccess, TeamAccessRole } from './types';

export type { TeamAccess, TeamAccessRole } from './types';

export async function resolveTeamAccess(teamId: string, userId: string): Promise<TeamAccess | null> {
    if (shouldProxyAuthRequest()) {
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
