import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type React from 'react';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getFirstOrganizationForUser, getOrganizationBySlugOrId } from '@/lib/server/organization';
import { resolveCurrentOrganizationId } from '@/lib/auth/current-organization';
import { isAnonymousUser } from '@/lib/auth/anonymous-user';
import { OrganizationAppShell } from './components/organization-app-shell';

export default async function TeamLayout({ children, params }: { children: React.ReactNode; params: Promise<{ organization: string }> }) {
    const cookieStore = await cookies();
    const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';
    const session = await getSessionFromRequest();

    if (!session) {
        redirect('/sign-in');
    }

    const currentOrganizationId = resolveCurrentOrganizationId(session);

    if (!currentOrganizationId) {
        const fallbackOrganization = await getFirstOrganizationForUser(session.user.id);
        if (fallbackOrganization) {
            redirect(`/${fallbackOrganization.slug}/connections`);
        }

        if (isAnonymousUser(session.user)) {
            redirect('/sign-in');
        }

        redirect('/create-organization');
    }

    const teamParam = (await params)?.organization;
    const organization = teamParam ? await getOrganizationBySlugOrId(teamParam, session.user.id) : null;

    console.log('[organization][layout] resolve', {
        teamParam,
        currentOrganizationId,
        sessionUserId: session.user.id,
        hasOrganization: Boolean(organization),
    });

    if (!organization) {
        const fallbackOrganization = await getFirstOrganizationForUser(session.user.id);
        console.log('[organization][layout] redirect', {
            fromOrganization: teamParam,
            toOrganization: fallbackOrganization?.slug ?? currentOrganizationId,
            sessionUserId: session.user.id,
        });
        redirect(`/${fallbackOrganization?.slug ?? currentOrganizationId}/connections`);
    }

    return <OrganizationAppShell defaultOpen={defaultOpen} initialUser={session.user as any}>{children}</OrganizationAppShell>;
}
