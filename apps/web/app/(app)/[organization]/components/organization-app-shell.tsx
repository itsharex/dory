'use client';

import * as React from 'react';
import { SidebarInset, SidebarProvider } from '@/registry/new-york-v4/ui/sidebar';
import { SettingsProvider } from '../../components/settings/settings';
import { AppContentShell } from './app-sidebar/app-content-shell';
import { AppSidebar } from './app-sidebar/app-sidebar';
import { getPgliteUpgradeNoticeStorageKey, PgliteUpgradeAlert } from './pglite-upgrade-alert';

export function OrganizationAppShell({
    children,
    defaultOpen,
    initialUser,
}: {
    children: React.ReactNode;
    defaultOpen: boolean;
    initialUser: any;
}) {
    const [announcementVisible, setAnnouncementVisible] = React.useState(false);

    React.useEffect(() => {
        try {
            setAnnouncementVisible(window.localStorage.getItem(getPgliteUpgradeNoticeStorageKey()) !== 'dismissed');
        } catch {
            setAnnouncementVisible(true);
        }
    }, []);

    const dismissAnnouncement = React.useCallback(() => {
        try {
            window.localStorage.setItem(getPgliteUpgradeNoticeStorageKey(), 'dismissed');
        } catch {
            // Ignore storage errors and only update local UI state.
        }

        setAnnouncementVisible(false);
    }, []);

    return (
        <SettingsProvider>
            <div className="flex h-screen min-h-0 flex-col overflow-hidden">
                {announcementVisible ? <PgliteUpgradeAlert onDismiss={dismissAnnouncement} /> : null}
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
                    <AppSidebar
                        className={announcementVisible ? 'md:top-10 md:bottom-0 md:h-auto' : 'md:top-0 md:bottom-0 md:h-auto'}
                        variant="inset"
                        collapsible="icon"
                        initialUser={initialUser}
                    />
                    <SidebarInset className="flex min-h-0 flex-col" style={{ height: 'calc(100% - 1rem)', width: 'calc(100% - 248px)' }}>
                        <AppContentShell>{children}</AppContentShell>
                    </SidebarInset>
                </SidebarProvider>
            </div>
        </SettingsProvider>
    );
}
