'use client';

import * as React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/registry/new-york-v4/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '../../components/settings/settings-provider';

const PGLITE_UPGRADE_NOTICE_VERSION = 'v0.8.0';
const PGLITE_UPGRADE_NOTICE_STORAGE_KEY = `dory:pglite-upgrade-alert:${PGLITE_UPGRADE_NOTICE_VERSION}`;

export function getPgliteUpgradeNoticeStorageKey() {
    return PGLITE_UPGRADE_NOTICE_STORAGE_KEY;
}

export function PgliteUpgradeAlert({ onDismiss }: { onDismiss: () => void }) {
    const t = useTranslations('DoryUI.Settings.PgliteUpgradeAlert');
    const { openSettings } = useSettings();

    return (
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-amber-500/25 bg-amber-500/10 px-3 text-sm md:px-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
                <span className="font-medium text-foreground">{t('Title', { version: PGLITE_UPGRADE_NOTICE_VERSION })}</span>
                <span className="mx-2 text-muted-foreground/60">•</span>
                <span>{t('Description', { version: PGLITE_UPGRADE_NOTICE_VERSION })}</span>
            </div>
            <Button
                type="button"
                size="xs"
                variant="secondary"
                className="h-6 shrink-0 rounded-md px-2.5 text-xs"
                onClick={() => {
                    openSettings('data');
                }}
            >
                {t('Action')}
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={cn('h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground')}
                onClick={onDismiss}
                aria-label={t('Dismiss')}
            >
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}
