'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Settings, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SidebarMenuButton, SidebarMenuItem } from '@/registry/new-york-v4/ui/sidebar';
import { useSettings } from '../../../components/settings/settings';

export function SidebarThemeEntry() {
    const { resolvedTheme, setTheme } = useTheme();
    const t = useTranslations('DoryUI');

    const toggleTheme = React.useCallback(() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }, [resolvedTheme, setTheme]);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton className="w-full justify-start group-data-[collapsible=icon]:justify-center" onClick={toggleTheme}>
                <Sun className="h-4 w-4 shrink-0 dark:hidden" />
                <Moon className="hidden h-4 w-4 shrink-0 dark:block" />
                <span>{t('ModeToggle.ToggleTheme')}</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

export function SidebarSettingsEntry() {
    const t = useTranslations('DoryUI.Settings');
    const { openSettings } = useSettings();

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                className="w-full justify-start group-data-[collapsible=icon]:justify-center"
                onClick={() => {
                    openSettings();
                }}
            >
                <Settings className="h-4 w-4" />
                <span>{t('Title')}</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
