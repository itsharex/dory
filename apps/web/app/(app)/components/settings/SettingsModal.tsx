'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/registry/new-york-v4/ui/dialog';
import { getCategories } from './types';
import type { CategoryKey } from './types';
import { SettingsSidebar } from './SettingsSidebar';
import { SettingsContent } from './SettingsContent';

export function SettingsModal({
    open,
    onOpenChange,
    defaultCategory = 'appearance',
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    defaultCategory?: CategoryKey;
}) {
    const [active, setActive] = React.useState<CategoryKey>(defaultCategory);
    const [query, setQuery] = React.useState('');
    const t = useTranslations('DoryUI.Settings');
    const categories = React.useMemo(() => getCategories(t), [t]);

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter(c => c.label.toLowerCase().includes(q) || (c.tag ?? '').toLowerCase().includes(q));
    }, [categories, query]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn('p-0 gap-0 overflow-hidden', 'sm:max-w-[960px] w-[960px] h-[600px]', 'rounded-2xl')}>
                <div className="grid grid-cols-[280px_1fr] h-full">
                    <SettingsSidebar active={active} query={query} onQueryChange={setQuery} onSelect={setActive} filtered={filtered} />
                    <SettingsContent active={active} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
