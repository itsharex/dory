export type TeamAccessRole = 'owner' | 'admin' | 'member' | 'viewer' | null;

export type TeamAccess = {
    source: 'desktop' | 'local';
    teamId: string;
    userId: string;
    isMember: boolean;
    role: TeamAccessRole;
    team: {
        id: string;
        slug?: string | null;
        name?: string | null;
    } | null;
};
