import { getSessionFromRequest } from '@/lib/auth/session';
import { resolveCurrentOrganizationIdStrict } from '@/lib/auth/current-organization';

export async function getDesktopTeamBySlugOrId(slugOrId: string) {
    const session = await getSessionFromRequest();
    const activeOrganizationId = resolveCurrentOrganizationIdStrict(session);

    if (!activeOrganizationId || slugOrId !== activeOrganizationId) {
        return null;
    }

    return { id: activeOrganizationId, slug: activeOrganizationId, name: activeOrganizationId } as any;
}
