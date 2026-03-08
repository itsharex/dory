import { getDBService } from '@/lib/database';
import type { TeamAccess } from './types';

export async function resolveLocalTeamAccess(teamId: string, userId: string): Promise<TeamAccess | null> {
    const db = await getDBService();
    if (!db) throw new Error('Database service not initialized');

    const members = await db.teams.list(userId);
    const member = members.find(item => item.teamId === teamId && item.status === 'active');
    if (!member) {
        return null;
    }

    const team = await db.teams.getTeamBySlugOrId(teamId);

    return {
        source: 'local',
        teamId,
        userId,
        isMember: true,
        role: member.role ?? null,
        team: team
            ? {
                  id: team.id,
                  slug: team.slug ?? null,
                  name: team.name ?? null,
              }
            : {
                  id: teamId,
                  slug: teamId,
                  name: teamId,
              },
    };
}
