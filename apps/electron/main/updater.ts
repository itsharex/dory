import { app, BrowserWindow, dialog, ipcMain, nativeTheme, type MessageBoxOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronUpdater from 'electron-updater';
import Store from 'electron-store';
import { isDev } from './constants.js';
import type { MainTranslator } from './i18n.js';
import type { LogFn } from './logger.js';
import { getMainWindow, setMainWindowQuitting } from './window.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { autoUpdater } = electronUpdater;

type ProgressInfo = import('electron-updater').ProgressInfo;
type UpdateInfo = import('electron-updater').UpdateInfo;

type UpdateAction = 'dismiss' | 'install-update' | 'cancel-download' | 'restart-now' | 'skip-version' | 'remind-later';

interface AvailableDialogState {
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

interface ProgressDialogState {
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

interface SetupUpdaterOptions {
    log: LogFn;
    logWarn: LogFn;
    logError: LogFn;
    locale: string;
    t: MainTranslator;
}

interface RendererUpdaterState {
    readyToInstall: boolean;
    version: string | null;
}

let availableDialog: BrowserWindow | null = null;
let progressDialog: BrowserWindow | null = null;
let queuedAvailableState: AvailableDialogState | null = null;
let queuedProgressState: ProgressDialogState | null = null;
let isManualCheck = false;
let checkInProgress = false;
let downloadInProgress = false;
let downloadCanceledByUser = false;
let shouldAutoInstallAfterDownload = false;
let availableVersion: string | null = null;
let currentLocale = 'en-US';
let debugPreviewMode = false;
let debugProgressTimer: NodeJS.Timeout | null = null;
let restartInstallInFlight = false;
let showCheckingDialog = false;
let rendererUpdaterState: RendererUpdaterState = {
    readyToInstall: false,
    version: null,
};

const updaterPreferenceStore = new Store<{
    autoDownloadInstall: boolean;
    skippedVersion: string | null;
    remindLaterUntil: number;
}>({
    name: 'updater-preferences',
    defaults: {
        autoDownloadInstall: true,
        skippedVersion: null,
        remindLaterUntil: 0,
    },
});

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
};

function getDialogHtmlPath(fileName: string) {
    if (isDev) {
        return path.resolve(__dirname, '../../main', fileName);
    }
    return path.join(__dirname, fileName);
}

function getDialogBackgroundColor() {
    return nativeTheme.shouldUseDarkColors ? '#232326' : '#f3f3f5';
}

function getCenteredPosition(width: number, height: number) {
    const main = getMainWindow();
    if (!main || main.isDestroyed()) return {};
    const [mx, my] = main.getPosition();
    const [mw, mh] = main.getSize();
    return {
        x: Math.round(mx + (mw - width) / 2),
        y: Math.round(my + (mh - height) / 2),
    };
}

function showDialogWithoutFocus(window: BrowserWindow) {
    if (window.isVisible()) return;
    window.showInactive();
}

function compareVersions(a: string, b: string) {
    const clean = (value: string) => value.split('-')[0];
    const pa = clean(a).split('.').map(part => Number(part));
    const pb = clean(b).split('.').map(part => Number(part));
    const length = Math.max(pa.length, pb.length);
    for (let i = 0; i < length; i += 1) {
        const av = Number.isFinite(pa[i]) ? pa[i] : 0;
        const bv = Number.isFinite(pb[i]) ? pb[i] : 0;
        if (av > bv) return 1;
        if (av < bv) return -1;
    }
    return 0;
}

function closeAvailableDialog() {
    if (!availableDialog || availableDialog.isDestroyed()) {
        availableDialog = null;
        return;
    }
    availableDialog.close();
}

function closeProgressDialog() {
    if (!progressDialog || progressDialog.isDestroyed()) {
        progressDialog = null;
        return;
    }
    progressDialog.close();
}

function closeAllDialogs() {
    closeAvailableDialog();
    closeProgressDialog();
}

function updateRendererUpdaterState(state: RendererUpdaterState) {
    rendererUpdaterState = state;
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('updater:state', state);
}

function stopDebugProgressTimer() {
    if (!debugProgressTimer) return;
    clearInterval(debugProgressTimer);
    debugProgressTimer = null;
}

function cancelActiveDownload(log: LogFn) {
    try {
        const updaterWithCancel = autoUpdater as typeof autoUpdater & {
            cancelDownload?: () => void;
        };
        updaterWithCancel.cancelDownload?.();
    } catch (error) {
        log('[updater] cancelDownload failed:', error);
    }
}

function getAppBundlePath() {
    // /path/MyApp.app/Contents/MacOS/MyApp -> /path/MyApp.app
    return path.resolve(process.execPath, '../../..');
}

function canInstallUpdateInCurrentLocation() {
    if (process.platform !== 'darwin') return true;
    const appBundlePath = getAppBundlePath();
    if (appBundlePath.startsWith('/Volumes/')) return false;
    try {
        fs.accessSync(appBundlePath, fs.constants.W_OK);
        fs.accessSync(path.dirname(appBundlePath), fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

function openAvailableDialog(title: string) {
    if (availableDialog && !availableDialog.isDestroyed()) {
        availableDialog.setTitle(title);
        availableDialog.setMovable(true);
        showDialogWithoutFocus(availableDialog);
        return;
    }

    const pos = getCenteredPosition(534, 180);
    availableDialog = new BrowserWindow({
        width: 534,
        height: 180,
        minWidth: 534,
        minHeight: 180,
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        movable: true,
        show: false,
        title,
        ...pos,
        modal: false,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        backgroundColor: getDialogBackgroundColor(),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    availableDialog.removeMenu();
    availableDialog.loadFile(getDialogHtmlPath('update-available-dialog.html'));

    availableDialog.once('ready-to-show', () => {
        if (!availableDialog || availableDialog.isDestroyed()) return;
        availableDialog.setMovable(true);
        showDialogWithoutFocus(availableDialog);
        if (isDev) {
            availableDialog.webContents.openDevTools({ mode: 'detach', activate: false });
        }
        if (queuedAvailableState) {
            availableDialog.webContents.send('updater:available-state', queuedAvailableState);
        }
    });

    availableDialog.on('closed', () => {
        availableDialog = null;
    });
}

function openProgressDialog(title: string) {
    if (progressDialog && !progressDialog.isDestroyed()) {
        progressDialog.setTitle(title);
        progressDialog.setMovable(true);
        showDialogWithoutFocus(progressDialog);
        return;
    }

    const pos = getCenteredPosition(400, 150);
    progressDialog = new BrowserWindow({
        width: 400,
        height: 150,
        minWidth: 400,
        minHeight: 150,
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        movable: true,
        show: false,
        title,
        ...pos,
        modal: false,
        titleBarStyle: 'default',
        backgroundColor: getDialogBackgroundColor(),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    progressDialog.removeMenu();
    progressDialog.loadFile(getDialogHtmlPath('update-progress-dialog.html'));

    progressDialog.once('ready-to-show', () => {
        if (!progressDialog || progressDialog.isDestroyed()) return;
        progressDialog.setMovable(true);
        showDialogWithoutFocus(progressDialog);
        if (isDev) {
            progressDialog.webContents.openDevTools({ mode: 'detach', activate: false });
        }
        if (queuedProgressState) {
            progressDialog.webContents.send('updater:progress-state', queuedProgressState);
        }
    });

    progressDialog.on('closed', () => {
        progressDialog = null;
    });
}

function showAvailableDialog(state: AvailableDialogState) {
    queuedAvailableState = state;
    openAvailableDialog(state.title);
    if (availableDialog && !availableDialog.isDestroyed()) {
        availableDialog.webContents.send('updater:available-state', state);
    }
    closeProgressDialog();
}

function showProgressDialog(state: ProgressDialogState) {
    queuedProgressState = state;
    openProgressDialog(state.title);
    if (progressDialog && !progressDialog.isDestroyed()) {
        progressDialog.webContents.send('updater:progress-state', state);
    }
    closeAvailableDialog();
}

function showCheckInProgress(locale: string, t: MainTranslator) {
    showProgressDialog({
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
    });
}

function showUpdateAvailable(locale: string, t: MainTranslator, info: UpdateInfo) {
    showAvailableDialog({
        lang: locale,
        title: t('updater.title'),
        message: t('updater.updateAvailable', { version: info.version }),
        detail: t('updater.updatePrompt', { currentVersion: app.getVersion() }),
        autoDownloadLabel: t('updater.autoDownloadInstall'),
        autoDownloadChecked: updaterPreferenceStore.get('autoDownloadInstall'),
        tertiaryLabel: t('updater.skipVersion'),
        secondaryLabel: t('updater.remindLater'),
        primaryLabel: t('updater.installUpdate'),
    });
}

function showDownloading(locale: string, t: MainTranslator, progress: ProgressInfo) {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(Math.max(0, Math.min(1, progress.percent / 100)));
    }

    showProgressDialog({
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
    });
}

function showDownloadPending(locale: string, t: MainTranslator) {
    showProgressDialog({
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
    });
}

function markUpdateReadyToInstall(log: LogFn, info: UpdateInfo) {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
    }

    closeAllDialogs();
    updateRendererUpdaterState({
        readyToInstall: true,
        version: info.version,
    });
    log('[updater] renderer notified update ready:', info.version);
}

function showDebugDownloading(t: MainTranslator, percent: number) {
    const totalBytes = 157.7 * 1024 * 1024;
    const transferred = (totalBytes * Math.max(0, Math.min(100, percent))) / 100;
    showProgressDialog({
        lang: currentLocale,
        title: t('updater.downloadingTitle'),
        message: t('updater.downloading'),
        detail: t('updater.downloadWillPrompt'),
        progress: percent / 100,
        progressText: `${formatBytes(transferred)} / ${formatBytes(totalBytes)}`,
        secondaryLabel: t('updater.cancel'),
        primaryLabel: null,
        secondaryAction: 'cancel-download',
        primaryAction: null,
    });
}

function startDebugDownloadFlow(log: LogFn, t: MainTranslator) {
    stopDebugProgressTimer();
    downloadInProgress = true;
    let percent = 0;
    showDebugDownloading(t, percent);

    debugProgressTimer = setInterval(() => {
        percent = Math.min(100, percent + 6);
        showDebugDownloading(t, percent);
        if (percent >= 100) {
            stopDebugProgressTimer();
            log('[updater] debug download completed');
            downloadInProgress = false;
            markUpdateReadyToInstall(log, { version: '1.2026.048' } as UpdateInfo);
        }
    }, 160);
}

function showNoUpdateDialog(t: MainTranslator) {
    const options: MessageBoxOptions = {
        type: 'info',
        title: t('updater.title'),
        message: t('updater.latestVersion'),
        buttons: [t('updater.ok')],
        defaultId: 0,
    };

    const parentWindow = getMainWindow();
    if (parentWindow) {
        dialog.showMessageBox(parentWindow, options);
        return;
    }

    dialog.showMessageBox(options);
}

function showUpdateError(logError: LogFn, error: unknown) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const compactRaw = rawMessage.replace(/\s+/g, ' ').trim();
    logError('[updater] update flow failed (silent):', compactRaw || rawMessage || error);

    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
    }
    closeAllDialogs();
}

function showInstallLocationBlockedDialog(t: MainTranslator) {
    const options: MessageBoxOptions = {
        type: 'warning',
        title: t('updater.installLocationBlocked'),
        message: t('updater.installLocationBlockedDetail'),
        buttons: [t('updater.ok')],
        defaultId: 0,
    };
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        void dialog.showMessageBox(mainWindow, options);
        return;
    }
    void dialog.showMessageBox(options);
}

function handleUpdateAction(log: LogFn, t: MainTranslator, action: UpdateAction) {
    switch (action) {
        case 'dismiss': {
            stopDebugProgressTimer();
            closeAllDialogs();
            // "Restart later": keep downloaded update queued for install on app quit.
            break;
        }
        case 'install-update': {
            if (rendererUpdaterState.readyToInstall) {
                log('[updater] install requested and update already downloaded, restarting to install');
                handleUpdateAction(log, t, 'restart-now');
                break;
            }
            log('[updater] download requested by user');
            downloadCanceledByUser = false;
            shouldAutoInstallAfterDownload = true;
            showDownloadPending(currentLocale, t);
            closeAvailableDialog();
            if (debugPreviewMode) {
                startDebugDownloadFlow(log, t);
                break;
            }
            downloadInProgress = true;
            autoUpdater.downloadUpdate().catch((error: unknown) => {
                downloadInProgress = false;
                showUpdateError(log, error);
            });
            break;
        }
        case 'cancel-download': {
            log('[updater] user clicked cancel download');
            downloadCanceledByUser = true;
            shouldAutoInstallAfterDownload = false;
            if (debugPreviewMode) {
                stopDebugProgressTimer();
            } else {
                cancelActiveDownload(log);
            }

            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setProgressBar(-1);
            }
            downloadInProgress = false;
            closeAllDialogs();
            break;
        }
        case 'restart-now': {
            if (debugPreviewMode) {
                closeAllDialogs();
                break;
            }
            if (!canInstallUpdateInCurrentLocation()) {
                log('[updater] blocked restart install due to app location:', getAppBundlePath());
                showInstallLocationBlockedDialog(t);
                break;
            }
            log('[updater] quitAndInstall');
            log('[updater] restart install path:', getAppBundlePath());
            log('[updater] restart install current version:', app.getVersion());
            updateRendererUpdaterState({
                readyToInstall: false,
                version: null,
            });
            closeAllDialogs();
            setMainWindowQuitting(true);
            restartInstallInFlight = true;
            try {
                autoUpdater.quitAndInstall(false, true);
                // Fallback: some environments ignore quitAndInstall silently.
                setTimeout(() => {
                    if (!restartInstallInFlight) return;
                    log('[updater] quitAndInstall fallback -> app.quit()');
                    app.quit();
                }, 1500);
            } catch (error) {
                log('[updater] quitAndInstall failed, fallback to app.quit():', error);
                app.quit();
            }
            break;
        }
        case 'skip-version': {
            if (availableVersion) {
                updaterPreferenceStore.set('skippedVersion', availableVersion);
            }
            closeAvailableDialog();
            break;
        }
        case 'remind-later': {
            const remindLaterMs = 24 * 60 * 60 * 1000;
            updaterPreferenceStore.set('remindLaterUntil', Date.now() + remindLaterMs);
            closeAvailableDialog();
            break;
        }
    }
}

export function setupUpdater({ log, logWarn, logError, locale, t }: SetupUpdaterOptions) {
    currentLocale = locale;
    const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml');
    const hasUpdateConfig = fs.existsSync(updateConfigPath);
    const devUpdateConfigPath = (() => {
        if (!isDev) return null;
        const candidates = [
            path.resolve(process.cwd(), 'dev-app-update.yml'),
            path.join(app.getAppPath(), 'dev-app-update.yml'),
            path.resolve(__dirname, '..', 'dev-app-update.yml'),
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) return candidate;
        }
        return null;
    })();
    const hasDevUpdateConfig = Boolean(devUpdateConfigPath);
    if (hasDevUpdateConfig && devUpdateConfigPath) {
        autoUpdater.forceDevUpdateConfig = true;
        autoUpdater.updateConfigPath = devUpdateConfigPath;
        log('[updater] dev update config enabled:', devUpdateConfigPath);
    }
    const devFeedUrl = isDev ? (process.env.ELECTRON_UPDATER_URL || '').trim() : '';
    if (devFeedUrl && !hasDevUpdateConfig) {
        try {
            autoUpdater.setFeedURL({ provider: 'generic', url: devFeedUrl });
            log('[updater] dev feed URL set:', devFeedUrl);
        } catch (error) {
            logWarn('[updater] failed to set dev feed URL:', error);
        }
    }
    if (!hasUpdateConfig && !hasDevUpdateConfig && !devFeedUrl) {
        logWarn('[updater] app-update.yml not found, updater disabled:', updateConfigPath);
    }

    const showNotConfiguredDialog = () => {
        const options: MessageBoxOptions = {
            type: 'warning',
            title: t('updater.notConfigured'),
            message: t('updater.notConfiguredDetail'),
            buttons: [t('updater.ok')],
            defaultId: 0,
        };
        const parentWindow = getMainWindow();
        if (parentWindow) {
            dialog.showMessageBox(parentWindow, options);
            return;
        }
        dialog.showMessageBox(options);
    };

    const clearSkippedVersion = () => {
        updaterPreferenceStore.set('skippedVersion', null);
        availableVersion = null;

        const options: MessageBoxOptions = {
            type: 'info',
            title: t('updater.title'),
            message: t('updater.skipCleared'),
            buttons: [t('updater.ok')],
            defaultId: 0,
        };
        const parentWindow = getMainWindow();
        if (parentWindow) {
            dialog.showMessageBox(parentWindow, options);
            return;
        }
        dialog.showMessageBox(options);
    };

    const openUpdateDialogDebug = () => {
        debugPreviewMode = true;
        showAvailableDialog({
            lang: locale,
            title: t('updater.title'),
            message: t('updater.updateAvailable', { version: '1.2026.048' }),
            detail: t('updater.updatePrompt', { currentVersion: app.getVersion() }),
            autoDownloadLabel: t('updater.autoDownloadInstall'),
            autoDownloadChecked: updaterPreferenceStore.get('autoDownloadInstall'),
            tertiaryLabel: t('updater.skipVersion'),
            secondaryLabel: t('updater.remindLater'),
            primaryLabel: t('updater.installUpdate'),
        });
    };

    ipcMain.on('updater:action', (_event, action: UpdateAction) => {
        handleUpdateAction(log, t, action);
    });

    ipcMain.on('updater:auto-download', (_event, enabled: boolean) => {
        updaterPreferenceStore.set('autoDownloadInstall', Boolean(enabled));
    });

    ipcMain.removeHandler('updater:get-state');
    ipcMain.handle('updater:get-state', async () => rendererUpdaterState);

    ipcMain.removeHandler('updater:restart-and-install');
    ipcMain.handle('updater:restart-and-install', async () => {
        if (!rendererUpdaterState.readyToInstall) return false;
        if (debugPreviewMode) {
            closeAllDialogs();
            return true;
        }
        if (!canInstallUpdateInCurrentLocation()) {
            log('[updater] blocked restart install due to app location:', getAppBundlePath());
            showInstallLocationBlockedDialog(t);
            return false;
        }
        handleUpdateAction(log, t, 'restart-now');
        return true;
    });

    if (!hasUpdateConfig && !hasDevUpdateConfig && !devFeedUrl) {
        return {
            checkForUpdatesFromMenu: async () => {
                debugPreviewMode = false;
                showNotConfiguredDialog();
            },
            clearSkippedVersionFromMenu: () => {
                clearSkippedVersion();
            },
            openUpdateDialogDebug,
            startAutoUpdateChecks: () => {
                logWarn('[updater] auto update checks disabled: updater not configured');
            },
        };
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;

    autoUpdater.on('checking-for-update', () => {
        debugPreviewMode = false;
        log('[updater] checking-for-update');
        checkInProgress = true;
        if (showCheckingDialog) {
            showCheckInProgress(locale, t);
        }
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
        debugPreviewMode = false;
        log('[updater] update-available:', info.version);
        checkInProgress = false;
        downloadCanceledByUser = false;
        availableVersion = info.version;

        if (rendererUpdaterState.readyToInstall && rendererUpdaterState.version === info.version) {
            log('[updater] update already downloaded for this version:', info.version);
            if (isManualCheck) {
                log('[updater] manual check found already-downloaded version, opening available dialog');
                showUpdateAvailable(locale, t, info);
            }
            isManualCheck = false;
            return;
        }

        if (compareVersions(info.version, app.getVersion()) <= 0) {
            logWarn('[updater] ignored non-newer version:', info.version, 'current:', app.getVersion());
            updateRendererUpdaterState({
                readyToInstall: false,
                version: null,
            });
            closeAllDialogs();
            isManualCheck = false;
            return;
        }

        if (isManualCheck) {
            log('[updater] manual check found update, opening available dialog:', info.version);
            showUpdateAvailable(locale, t, info);
            isManualCheck = false;
            return;
        }

        const skippedVersion = updaterPreferenceStore.get('skippedVersion');
        if (skippedVersion && skippedVersion === info.version) {
            log('[updater] skipped version detected, suppress prompt:', info.version);
            closeAllDialogs();
            return;
        }

        const remindLaterUntil = updaterPreferenceStore.get('remindLaterUntil');
        if (!isManualCheck && remindLaterUntil > Date.now()) {
            log('[updater] remind-later active, suppress prompt until:', new Date(remindLaterUntil).toISOString());
            closeAllDialogs();
            return;
        }

        const autoDownloadInstall = updaterPreferenceStore.get('autoDownloadInstall');
        if (autoDownloadInstall) {
            log('[updater] autoDownloadInstall enabled, start download immediately');
            shouldAutoInstallAfterDownload = true;
            downloadInProgress = true;
            autoUpdater.downloadUpdate().catch((error: unknown) => {
                downloadInProgress = false;
                shouldAutoInstallAfterDownload = false;
                showUpdateError(logError, error);
            });
            return;
        }

        shouldAutoInstallAfterDownload = false;
        closeAllDialogs();
        log('[updater] auto check found update, suppress available dialog until manual check');
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
        debugPreviewMode = false;
        log('[updater] update-not-available:', info.version);
        checkInProgress = false;
        updateRendererUpdaterState({
            readyToInstall: false,
            version: null,
        });
        closeAllDialogs();
        if (isManualCheck) {
            showNoUpdateDialog(t);
        }
        isManualCheck = false;
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        debugPreviewMode = false;
        if (downloadCanceledByUser) {
            return;
        }
        if (!downloadInProgress) {
            downloadInProgress = true;
        }
        showDownloading(locale, t, progress);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        debugPreviewMode = false;
        log('[updater] update-downloaded:', info.version);
        downloadInProgress = false;
        isManualCheck = false;
        availableVersion = null;
        updaterPreferenceStore.set('remindLaterUntil', 0);
        const autoInstallNow = shouldAutoInstallAfterDownload && !downloadCanceledByUser;
        shouldAutoInstallAfterDownload = false;
        downloadCanceledByUser = false;
        markUpdateReadyToInstall(log, info);
        if (autoInstallNow) {
            log('[updater] auto install enabled, restarting to install downloaded update');
            handleUpdateAction(log, t, 'restart-now');
        }
    });

    autoUpdater.on('error', (error: Error) => {
        debugPreviewMode = false;
        stopDebugProgressTimer();
        checkInProgress = false;
        downloadInProgress = false;
        downloadCanceledByUser = false;
        shouldAutoInstallAfterDownload = false;
        isManualCheck = false;
        availableVersion = null;
        closeAllDialogs();
        showUpdateError(logError, error);
    });

    app.on('before-quit', () => {
        if (restartInstallInFlight) {
            log('[updater] before-quit while restart install in flight');
            restartInstallInFlight = false;
        }
    });

    const runCheckForUpdates = async (manual: boolean) => {
        if (checkInProgress || downloadInProgress) {
            if (manual) {
                logWarn('[updater] check ignored: update flow already in progress');
            }
            return;
        }

        try {
            showCheckingDialog = manual;
            isManualCheck = manual;
            if (!manual) {
                downloadCanceledByUser = false;
            }
            await autoUpdater.checkForUpdates();
        } catch (error) {
            stopDebugProgressTimer();
            checkInProgress = false;
            downloadInProgress = false;
            downloadCanceledByUser = false;
            shouldAutoInstallAfterDownload = false;
            isManualCheck = false;
            availableVersion = null;
            closeAllDialogs();
            showUpdateError(logError, error);
        } finally {
            showCheckingDialog = false;
        }
    };

    const startAutoUpdateChecks = () => {
        const initialDelayMs = 10 * 1000;
        const intervalMs = 6 * 60 * 60 * 1000;
        log('[updater] schedule auto update checks, initial delay(ms):', initialDelayMs, 'interval(ms):', intervalMs);
        setTimeout(() => {
            void runCheckForUpdates(false);
            setInterval(() => {
                void runCheckForUpdates(false);
            }, intervalMs);
        }, initialDelayMs);
    };

    return {
        checkForUpdatesFromMenu: async () => {
            debugPreviewMode = false;
            await runCheckForUpdates(true);
        },
        clearSkippedVersionFromMenu: () => {
            clearSkippedVersion();
        },
        openUpdateDialogDebug,
        startAutoUpdateChecks,
    };
}
