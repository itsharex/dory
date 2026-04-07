'use client';

import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/registry/new-york-v4/ui/sidebar';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSettings } from '../../../components/settings/settings';

export function SidebarSettingsEntry() {
    const t = useTranslations('DoryUI.Settings');
    const { openSettings } = useSettings();

    return (
        <SidebarMenu>
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
        </SidebarMenu>
    );
}
