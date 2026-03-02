'use client';

import { useParams } from 'next/navigation';
import { IconDatabase, IconFileAi, IconHelp, IconUsers } from '@tabler/icons-react';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/registry/new-york-v4/ui/sidebar';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
import { authClient } from '@/lib/auth-client';
import { ArrowUpCircle, FileChartColumnIncreasing, SquareCode } from 'lucide-react';
import { NavSecondary } from './nav-secondary';
import { ConnectionSwitcher } from './connection-switcher';
import { Separator } from '@/registry/new-york-v4/ui/separator';
import { DoryLogo } from '@/components/@dory/ui/logo';
import { ConnectionDialogRoot } from '../../connections/components/connection-dialog-root';
import { Badge } from '@/registry/new-york-v4/ui/badge';

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
    const params = useParams<{ team: string; connectionId?: string }>();
    const { data: session } = authClient.useSession();
    const t = useTranslations('AppSidebar');
    const team = params.team;
    const connectionId = params.connectionId;
    const [updaterState, setUpdaterState] = React.useState<{ readyToInstall: boolean; version: string | null }>({
        readyToInstall: false,
        version: null,
    });
    const [isRestartingUpdate, setIsRestartingUpdate] = React.useState(false);
    const restartInFlightRef = React.useRef(false);

    const navMain = [
        {
            title: t('SQLConsole'),
            url: connectionId ? `/${team}/${connectionId}/sql-console` : `/${team}/connections`,
            icon: SquareCode,
            requiresConnection: true,
        },
        {
            title: t('Schema'),
            url: connectionId ? `/${team}/${connectionId}/catalog/default` : `/${team}/connections`,
            icon: IconDatabase,
            requiresConnection: true,
        },
        {
            title: t('Chatbot'),
            url: connectionId ? `/${team}/${connectionId}/chatbot` : `/${team}/chatbot`,
            icon: IconFileAi,
            requiresConnection: true,
        },
        {
            title: t('Monitoring'),
            url: connectionId ? `/${team}/${connectionId}/monitoring` : `/${team}/connections`,
            icon: FileChartColumnIncreasing,
            requiresConnection: true,
        },
        {
            title: t('Privileges'),
            url: connectionId ? `/${team}/${connectionId}/privileges` : `/${team}/privileges`,
            icon: IconUsers,
            requiresConnection: true,
        },
    ];

    const navSecondary = [
        {
            title: t('GetHelp'),
            url: 'https://github.com/dorylab/dory/discussions',
            icon: IconHelp,
            external: true,
        },
    ];

    React.useEffect(() => {
        if (!window.updateBridge) return;
        let disposed = false;

        window.updateBridge
            .getState()
            .then(state => {
                if (disposed) return;
                setUpdaterState(state);
            })
            .catch(() => undefined);

        const unsubscribe = window.updateBridge.onStateChanged(state => {
            if (disposed) return;
            setUpdaterState(state);
        });

        return () => {
            disposed = true;
            unsubscribe?.();
        };
    }, []);

    const handleRestartAndInstall = async () => {
        if (!window.updateBridge || restartInFlightRef.current) return;
        restartInFlightRef.current = true;
        setIsRestartingUpdate(true);
        try {
            const accepted = await window.updateBridge.restartAndInstall();
            if (!accepted) {
                restartInFlightRef.current = false;
                setIsRestartingUpdate(false);
            }
        } catch {
            restartInFlightRef.current = false;
            setIsRestartingUpdate(false);
        }
    };

    return (
        <Sidebar {...props}>
            <ConnectionDialogRoot />
            <SidebarHeader className="pb-2">
                <ConnectionSwitcher />
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={navMain} disabled={!connectionId} hasActiveConnection={!!connectionId} />
                <div className="mt-auto space-y-2">
                    <NavSecondary items={navSecondary} disabled={!connectionId} />
                </div>
            </SidebarContent>


            <div className="px-5 pb-3 pt-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center flex items-center gap-6">
                <a
                    href="https://github.com/dorylab/dory"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Dory"
                >
                    <DoryLogo className="h-5 w-auto group-data-[collapsible=icon]:hidden" />
                </a>
                {updaterState.readyToInstall && (
                    <>
                        <Badge
                            onClick={() => {
                                if (isRestartingUpdate) return;
                                void handleRestartAndInstall();
                            }}
                            aria-disabled={isRestartingUpdate}
                            className={`group-data-[collapsible=icon]:hidden ${isRestartingUpdate ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
                            title={updaterState.version ? t('UpdateVersion', { version: updaterState.version }) : undefined}
                        >
                            {isRestartingUpdate ? t('Updating') : t('Update')}
                        </Badge>
                        <button
                            type="button"
                            onClick={() => {
                                if (isRestartingUpdate) return;
                                void handleRestartAndInstall();
                            }}
                            aria-disabled={isRestartingUpdate}
                            aria-label={isRestartingUpdate ? t('Updating') : t('Update')}
                            title={updaterState.version ? t('UpdateVersion', { version: updaterState.version }) : t('Update')}
                            className={`hidden h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-[collapsible=icon]:inline-flex ${
                                isRestartingUpdate ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:bg-muted/80'
                            }`}
                        >
                            <ArrowUpCircle className="h-4 w-4" />
                        </button>
                    </>
                )}
            </div>

            <Separator />

            <SidebarFooter>
                <NavUser user={session?.user as any} />
            </SidebarFooter>
        </Sidebar>
    );
}
