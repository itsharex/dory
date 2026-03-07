import { shouldProxyAuthRequest } from '@/lib/auth/auth-proxy';
import { getDesktopTeamBySlugOrId } from './team.desktop';
import { getLocalTeamBySlugOrId } from './team.local';

export async function getTeamBySlugOrId(slugOrId: string, userId: string) {
    if (shouldProxyAuthRequest()) {
        return getDesktopTeamBySlugOrId(slugOrId);
    }

    return getLocalTeamBySlugOrId(slugOrId, userId);
}
