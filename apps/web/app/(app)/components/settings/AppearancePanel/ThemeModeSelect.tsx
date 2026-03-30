'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/registry/new-york-v4/ui/select';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

export function ThemeModeSelect() {
    const { theme, setTheme } = useTheme();
    const t = useTranslations('DoryUI.Settings');
    const val = (theme as string) || 'system';

    return (
        <Select value={val} onValueChange={setTheme}>
            <SelectTrigger className="h-8 w-[180px] justify-between">
                <SelectValue placeholder={t('ThemeMode.System')} />
            </SelectTrigger>
            <SelectContent align="end">
                <SelectItem value="system">{t('ThemeMode.System')}</SelectItem>
                <SelectItem value="light">{t('ThemeMode.Light')}</SelectItem>
                <SelectItem value="dark">{t('ThemeMode.Dark')}</SelectItem>
            </SelectContent>
        </Select>
    );
}
