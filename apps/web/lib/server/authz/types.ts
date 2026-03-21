import type { OrganizationPermissionMap, OrganizationRole } from '@/types/organization';

export type OrganizationAccessRole = OrganizationRole | null;

export type OrganizationAccess = {
    source: 'desktop' | 'local';
    organizationId: string;
    userId: string;
    isMember: boolean;
    role: OrganizationAccessRole;
    permissions: OrganizationPermissionMap;
    organization: {
        id: string;
        slug?: string | null;
        name?: string | null;
    } | null;
};
