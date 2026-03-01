import { app, dialog, ipcMain, shell, Menu, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ID, PROTOCOL, isDev } from './main/constants.js';
import { ensureDirectoryExists } from './main/filesystem.js';
import { createMainI18n } from './main/i18n.js';
import { getMainLogFilePath, setupMainLogger } from './main/logger.js';
import { registerProtocolClient } from './main/protocol.js';
import { createStandaloneServerManager } from './main/server.js';
import { setupUpdater } from './main/updater.js';
import {
  createMainWindow,
  focusMainWindow,
  hasMainWindow,
  sendAuthCallback,
  setPendingAuthCallback,
  setMainWindowQuitting,
} from './main/window.js';
import { applyTheme, getStoredTheme, registerThemeIpc } from './main/theme.js';
import { getUserDataPath } from './paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
  app.setPath('userData', path.join(app.getPath('appData'), APP_ID));
}

const databasePath = path.join(getUserDataPath(), 'data/database');
ensureDirectoryExists(databasePath);

const { log, logWarn, logError } = setupMainLogger({
  isDev,
  databasePath,
  protocol: PROTOCOL,
});

const serverManager = createStandaloneServerManager({
  isDev,
  databasePath,
  log,
  logWarn,
  logError,
});

registerThemeIpc();
applyTheme(getStoredTheme());

function setupAppMenu(options: {
  onCheckUpdate: () => void;
  onResetSkippedUpdate: () => void;
  onOpenUpdateDialogDebug?: () => void;
  checkForUpdatesLabel: string;
  resetSkippedUpdateLabel: string;
  openUpdateDialogDebugLabel: string;
  openLogLabel: string;
  openLogFailedTitle: string;
}) {
  const logFilePath = getMainLogFilePath();
  const debugMenuItems: MenuItemConstructorOptions[] = [];
  if (options.onOpenUpdateDialogDebug) {
    const onOpenUpdateDialogDebug = options.onOpenUpdateDialogDebug;
    debugMenuItems.push({
      label: options.openUpdateDialogDebugLabel,
      click: () => {
        onOpenUpdateDialogDebug();
      },
    });
  }

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            {
              label: options.checkForUpdatesLabel,
              click: () => {
                options.onCheckUpdate();
              },
            },
            {
              label: options.resetSkippedUpdateLabel,
              click: () => {
                options.onResetSkippedUpdate();
              },
            },
            ...debugMenuItems,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        } satisfies MenuItemConstructorOptions]
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        ...(process.platform !== 'darwin'
          ? [{
              label: options.checkForUpdatesLabel,
              click: () => {
                options.onCheckUpdate();
              },
            }, {
              label: options.resetSkippedUpdateLabel,
              click: () => {
                options.onResetSkippedUpdate();
              },
            }, ...debugMenuItems]
          : []),
        { type: 'separator' },
        {
          label: options.openLogLabel,
          click: async () => {
            const result = await shell.openPath(logFilePath);
            if (result) {
              logWarn('[electron] open log file failed:', result);
              dialog.showErrorBox(options.openLogFailedTitle, result);
            }
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function launch() {
  try {
    const targetUrl = await serverManager.getAppUrl();
    log('[electron] launch targetUrl:', targetUrl);
    createMainWindow({
      targetUrl,
      preloadPath: path.join(__dirname, 'preload.cjs'),
      log,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logError('[electron] launch error:', error);
    dialog.showErrorBox('Launch Failed', message);
    app.quit();
  }
}

const gotLock = app.requestSingleInstanceLock();
log('[electron] singleInstanceLock:', gotLock);

if (!gotLock) {
  log('[electron] another instance owns the lock, quitting');
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    log('[electron] second-instance argv:', argv);
    const deepLinkArg = argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (deepLinkArg) sendAuthCallback(deepLinkArg, logWarn);
    focusMainWindow();
  });

  app.on('will-finish-launching', () => {
    app.on('open-url', (event, url) => {
      event.preventDefault();
      log('[electron] open-url:', url);
      sendAuthCallback(url, logWarn);
    });
  });

  app.whenReady().then(() => {
    log('[electron] app ready');
    log('[electron] version:', app.getVersion());
    log('[electron] execPath:', process.execPath);
    log('[electron] appPath:', app.getAppPath());
    const { locale, t } = createMainI18n();
    log('[electron] locale:', locale);
    registerProtocolClient(PROTOCOL, log);
    const updater = setupUpdater({ log, logWarn, logError, locale, t });
    setupAppMenu({
      onCheckUpdate: () => {
        updater.checkForUpdatesFromMenu();
      },
      onResetSkippedUpdate: () => {
        updater.clearSkippedVersionFromMenu();
      },
      onOpenUpdateDialogDebug: isDev
        ? () => {
            updater.openUpdateDialogDebug();
          }
        : undefined,
      checkForUpdatesLabel: t('menu.checkForUpdates'),
      resetSkippedUpdateLabel: t('menu.resetSkippedUpdate'),
      openUpdateDialogDebugLabel: t('menu.openUpdateDialogDebug'),
      openLogLabel: t('menu.openLog'),
      openLogFailedTitle: t('error.openLogFailed'),
    });

    const deepLinkArg = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (deepLinkArg) {
      log('[electron] pending deep link on ready:', deepLinkArg);
      setPendingAuthCallback(deepLinkArg);
    }

    launch();
    updater.startAutoUpdateChecks();
  });

  app.on('activate', () => {
    log('[electron] app activate');
    if (!hasMainWindow()) launch();
    focusMainWindow();
  });

  app.on('window-all-closed', () => {
    log('[electron] window-all-closed');
    if (process.platform !== 'darwin') app.quit();
  });
}

app.on('before-quit', () => {
  log('[electron] before-quit');
  setMainWindowQuitting(true);
  serverManager.stopStandaloneServer();
});

ipcMain.handle('auth:openExternal', async (_event, url: string) => {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('Invalid URL');
  }
  await shell.openExternal(url);
});
