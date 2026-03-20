import { getSessionFromRequest } from '@/lib/auth/session';
import { resolveCurrentOrganizationId } from '@/lib/auth/current-organization';

export async function getDesktopTeamBySlugOrId(slugOrId: string) {
    const session = await getSessionFromRequest();
    const activeOrganizationId = resolveCurrentOrganizationId(session);

    if (!activeOrganizationId || slugOrId !== activeOrganizationId) {
        return null;
    }

    return { id: activeOrganizationId, slug: activeOrganizationId, name: activeOrganizationId } as any;
}
