import type { MainTranslator } from '../i18n.js';
import type { AvailableDialogState, ProgressDialogState, ProgressInfo, UpdateInfo } from './types.js';
import { formatBytes } from './utils.js';

export function createCheckInProgressState(locale: string, t: MainTranslator): ProgressDialogState {
    return {
        lang: locale,
        title: t('updater.title'),
        message: t('updater.checking'),
        detail: t('updater.pleaseWait'),
        progress: null,
        progressText: '',
        secondaryLabel: t('updater.cancel'),
        primaryLabel: null,
        secondaryAction: 'dismiss',
        primaryAction: null,
    };
}

export function createUpdateAvailableState(
    locale: string,
    t: MainTranslator,
    info: UpdateInfo,
    currentVersion: string,
    autoDownloadChecked: boolean,
): AvailableDialogState {
    return {
        lang: locale,
        title: t('updater.title'),
        message: t('updater.updateAvailable', { version: info.version }),
        detail: t('updater.updatePrompt', { currentVersion }),
        autoDownloadLabel: t('updater.autoDownloadInstall'),
        autoDownloadChecked,
        tertiaryLabel: t('updater.skipVersion'),
        secondaryLabel: t('updater.remindLater'),
        primaryLabel: t('updater.installUpdate'),
    };
}

export function createDownloadingState(locale: string, t: MainTranslator, progress: ProgressInfo): ProgressDialogState {
    return {
        lang: locale,
        title: t('updater.downloadingTitle'),
        message: t('updater.downloading'),
        detail: t('updater.downloadWillPrompt'),
        progress: progress.percent / 100,
        progressText: `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`,
        secondaryLabel: t('updater.cancel'),
        primaryLabel: null,
        secondaryAction: 'cancel-download',
        primaryAction: null,
    };
}

export function createDownloadPendingState(locale: string, t: MainTranslator): ProgressDialogState {
    return {
        lang: locale,
        title: t('updater.downloadingTitle'),
        message: t('updater.downloading'),
        detail: t('updater.downloadWillPrompt'),
        progress: null,
        progressText: '',
        secondaryLabel: t('updater.cancel'),
        primaryLabel: null,
        secondaryAction: 'cancel-download',
        primaryAction: null,
    };
}

export function createDebugDownloadingState(
    locale: string,
    t: MainTranslator,
    percent: number,
    totalBytes: number,
): ProgressDialogState {
    const transferred = (totalBytes * Math.max(0, Math.min(100, percent))) / 100;
    return {
        lang: locale,
        title: t('updater.downloadingTitle'),
        message: t('updater.downloading'),
        detail: t('updater.downloadWillPrompt'),
        progress: percent / 100,
        progressText: `${formatBytes(transferred)} / ${formatBytes(totalBytes)}`,
        secondaryLabel: t('updater.cancel'),
        primaryLabel: null,
        secondaryAction: 'cancel-download',
        primaryAction: null,
    };
}
