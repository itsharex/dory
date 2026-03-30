'use client';

import { useTranslations } from 'next-intl';
import { SettingsRow } from '../SettingsRow';
import { ThemeModeSelect } from './ThemeModeSelect';
import { FontSizeSelect } from './FontSizeSelect';
import { ThemeSelector } from '@/components/theme-selector';
import { LanguageSelect } from './LanguageSelect';

export function AppearancePanel() {
    const t = useTranslations('DoryUI.Settings');

    return (
        <div className="space-y-6">
            <SettingsRow label={t('Appearance.ModeLabel')} description={t('Appearance.ModeDescription')}>
                <ThemeModeSelect />
            </SettingsRow>

            <SettingsRow label={t('Appearance.LanguageLabel')} description={t('Appearance.LanguageDescription')}>
                <LanguageSelect />
            </SettingsRow>

            <SettingsRow label={t('Appearance.ThemeLabel')} description={t('Appearance.ThemeDescription')}>
                <ThemeSelector compact />
            </SettingsRow>

            <SettingsRow label={t('Appearance.FontSizeLabel')} description={t('Appearance.FontSizeDescription')}>
                <FontSizeSelect />
            </SettingsRow>
        </div>
    );
}
