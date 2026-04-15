'use client';

import { Fragment, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/registry/new-york-v4/ui/button';
import { Kbd } from '@/registry/new-york-v4/ui/kbd';

type ShortcutKey = 'mod' | 'alt' | 'shift' | 'enter' | 's' | 'l' | 'i' | 'f';

const getShortcutKeyLabel = (key: ShortcutKey, isMac: boolean) => {
    switch (key) {
        case 'mod':
            return isMac ? '⌘' : 'Ctrl';
        case 'alt':
            return isMac ? '⌥' : 'Alt';
        case 'shift':
            return isMac ? '⇧' : 'Shift';
        case 'enter':
            return 'Enter';
        default:
            return key.toUpperCase();
    }
};

export default function SQLTabEmpty(props: { addTab: () => void; disabled?: boolean }) {
    const { addTab, disabled = false } = props;
    const t = useTranslations('SqlConsole');
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        const navigatorWithUAData = navigator as Navigator & {
            userAgentData?: {
                platform?: string;
            };
        };
        const platform =
            navigatorWithUAData.userAgentData?.platform ??
            navigator.platform ??
            navigator.userAgent;

        setIsMac(/mac/i.test(platform));
    }, []);

    const shortcuts = [
        { label: t('Empty.ActionRunSelection'), keys: ['mod', 'enter'] as ShortcutKey[] },
        { label: t('Empty.ActionSave'), keys: ['mod', 's'] as ShortcutKey[] },
        { label: t('Empty.ActionNewTab'), keys: ['mod', 'alt', 'l'] as ShortcutKey[] },
        { label: t('Empty.ActionToggleCopilot'), keys: ['mod', 'i'] as ShortcutKey[] },
        { label: t('Empty.ActionFormat'), keys: ['shift', 'mod', 'f'] as ShortcutKey[] },
    ];

    return (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="mb-6 text-5xl font-semibold tracking-wide">
                {t('Empty.Brand')}
            </div>
            <div className="mx-auto mb-6 grid w-fit gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:items-center sm:gap-x-4">
                {shortcuts.map(shortcut => (
                    <Fragment key={shortcut.label}>
                        <span className="text-center sm:justify-self-end sm:text-right">{shortcut.label}</span>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-self-start sm:justify-start">
                            {shortcut.keys.map((key, index) => (
                                <Fragment key={`${shortcut.label}-${key}`}>
                                    {index > 0 ? <span className="text-xs text-muted-foreground/60">+</span> : null}
                                    <Kbd>{getShortcutKeyLabel(key, isMac)}</Kbd>
                                </Fragment>
                            ))}
                        </div>
                    </Fragment>
                ))}
            </div>
            <div className="flex flex-col items-center gap-3">
                <Button onClick={addTab} disabled={disabled}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('Empty.NewConsole')}
                </Button>
            </div>
        </div>
    );
}
