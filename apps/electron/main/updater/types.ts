import type { MainTranslator } from '../i18n.js';
import type { MainLocale } from '../locale.js';
import type { LogFn } from '../logger.js';

type ProgressInfo = import('electron-updater').ProgressInfo;
type UpdateInfo = import('electron-updater').UpdateInfo;

export type { ProgressInfo, UpdateInfo };

export type UpdateChannel = 'latest' | 'beta';

export type UpdateAction =
    | 'dismiss'
    | 'install-update'
    | 'cancel-download'
    | 'restart-now'
    | 'skip-version'
    | 'remind-later';

export interface AvailableDialogState {
    lang: string;
    title: string;
    message: string;
    detail: string;
    autoDownloadLabel: string;
    autoDownloadChecked: boolean;
    tertiaryLabel: string;
    secondaryLabel: string;
    primaryLabel: string;
}

export interface ProgressDialogState {
    lang: string;
    title: string;
    message: string;
    detail: string;
    progress: number | null;
    progressText: string;
    secondaryLabel: string | null;
    primaryLabel: string | null;
    secondaryAction: UpdateAction;
    primaryAction: UpdateAction | null;
}

export interface SetupUpdaterOptions {
    log: LogFn;
    logWarn: LogFn;
    logError: LogFn;
    locale: MainLocale;
    t: MainTranslator;
}

export interface RendererUpdaterState {
    readyToInstall: boolean;
    version: string | null;
}

export interface UpdaterPreferences {
    autoDownloadInstall: boolean;
    skippedVersion: string | null;
    remindLaterUntil: number;
    updateChannel?: UpdateChannel;
}
