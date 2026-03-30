'use client';

import { useThemeConfig } from '@/components/active-theme';
import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/registry/new-york-v4/ui/select';

const DEFAULT_THEMES = [
    { labelKey: 'Options.default', value: 'default' },
    { labelKey: 'Options.blue', value: 'blue' },
    { labelKey: 'Options.green', value: 'green' },
    { labelKey: 'Options.amber', value: 'amber' },
    { labelKey: 'Options.liquid', value: 'liquid' },
];

const SCALED_THEMES = [
    { labelKey: 'Options.default', value: 'default-scaled' },
    { labelKey: 'Options.blue', value: 'blue-scaled' },
    { labelKey: 'Options.liquid', value: 'liquid-scaled' },
];

const MONO_THEMES = [{ labelKey: 'Options.mono', value: 'mono-scaled' }];

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
    const { activeTheme, setActiveTheme } = useThemeConfig();
    const t = useTranslations('DoryUI.Settings');

    return (
        <Select value={activeTheme} onValueChange={setActiveTheme}>
            <SelectTrigger id="theme-selector" className={compact ? 'h-8 w-[160px] justify-between' : 'justify-start'}>
                <SelectValue placeholder={t('ColorTheme.Placeholder')} />
            </SelectTrigger>
            <SelectContent align="end">
                <SelectGroup>
                    <SelectLabel>{t('ColorTheme.Groups.Default')}</SelectLabel>
                    {DEFAULT_THEMES.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                            {t(`ColorTheme.${option.labelKey}`)}
                        </SelectItem>
                    ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                    <SelectLabel>{t('ColorTheme.Groups.Scaled')}</SelectLabel>
                    {SCALED_THEMES.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                            {t(`ColorTheme.${option.labelKey}`)}
                        </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                    <SelectLabel>{t('ColorTheme.Groups.Monospaced')}</SelectLabel>
                    {MONO_THEMES.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                            {t(`ColorTheme.${option.labelKey}`)}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
