import { getSessionFromRequest } from '@/lib/auth/session';

export async function getDesktopTeamBySlugOrId(slugOrId: string) {
    const session = await getSessionFromRequest();
    const defaultTeamId = session?.user?.defaultTeamId ?? null;

    if (!defaultTeamId || slugOrId !== defaultTeamId) {
        return null;
    }

    return { id: defaultTeamId, slug: defaultTeamId, name: defaultTeamId } as any;
}
