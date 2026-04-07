import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type React from 'react';
import { SidebarProvider, SidebarInset } from '@/registry/new-york-v4/ui/sidebar';
import { AppContentShell } from './components/app-sidebar/app-content-shell';
import { AppSidebar } from './components/app-sidebar/app-sidebar';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getFirstOrganizationForUser, getOrganizationBySlugOrId } from '@/lib/server/organization';
import { resolveCurrentOrganizationId } from '@/lib/auth/current-organization';
import { isAnonymousUser } from '@/lib/auth/anonymous-user';
import { SettingsProvider } from '../components/settings/settings';
import { PgliteUpgradeAlert } from './components/pglite-upgrade-alert';

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

    return (
        <SettingsProvider>
            <div className="flex h-screen min-h-0 flex-col overflow-hidden">
                <PgliteUpgradeAlert />
                <SidebarProvider
                    className="flex-1 !min-h-0"
                    defaultOpen={defaultOpen}
                    style={
                        {
                            '--sidebar-width': 'calc(var(--spacing) * 50)',
                            '--sidebar-width-icon': '40px',
                        } as React.CSSProperties
                    }
                >
                    <AppSidebar className="md:top-10 md:bottom-0 md:h-auto" variant="inset" collapsible="icon" initialUser={session.user as any} />
                    <SidebarInset className="flex min-h-0 flex-col" style={{ height: 'calc(100% - 1rem)', width: 'calc(100% - 248px)' }}>
                        <AppContentShell>{children}</AppContentShell>
                    </SidebarInset>
                </SidebarProvider>
            </div>
        </SettingsProvider>
    );
}
