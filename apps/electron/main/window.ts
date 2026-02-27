import { BrowserWindow, shell } from 'electron';
import type { LogFn } from './logger.js';

let mainWindow: BrowserWindow | null = null;
let pendingAuthCallback: string | null = null;
let splashWindow: BrowserWindow | null = null;
let splashShownAt = 0;

interface CreateMainWindowOptions {
  preloadPath: string;
  targetUrl: string;
  log: LogFn;
}

export function createMainWindow({ preloadPath, targetUrl, log }: CreateMainWindowOptions) {
  log('[electron] createMainWindow ->', targetUrl);

  createSplashWindow();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hiddenInset',
    show: false,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(targetUrl);

  mainWindow.once('ready-to-show', () => {
    const minSplashMs = 800;
    const elapsed = Date.now() - splashShownAt;
    const remaining = Math.max(0, minSplashMs - elapsed);
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      splashWindow = null;
      mainWindow?.show();
    }, remaining);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (!pendingAuthCallback) return;
    mainWindow?.webContents.send('auth:callback', pendingAuthCallback);
    pendingAuthCallback = null;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return;

  splashWindow = new BrowserWindow({
    width: 520,
    height: 360,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#050814',
    show: true,
    alwaysOnTop: true,
    center: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const splashHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Loading</title>
  <style>
    :root {
      color-scheme: dark;
    }
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      background: radial-gradient(120% 90% at 20% 10%, #1b2550 0%, #050814 55%, #050814 100%);
      color: #e9f0ff;
      overflow: hidden;
    }
    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
    }
    .glow {
      position: absolute;
      width: 260px;
      height: 260px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(6,182,212,0.2) 40%, rgba(59,130,246,0) 65%);
      filter: blur(2px);
      animation: pulse 2.2s ease-in-out infinite;
    }
    .ring {
      position: absolute;
      width: 170px;
      height: 170px;
      border-radius: 50%;
      border: 2px solid rgba(59, 130, 246, 0.55);
      animation: spin 4s linear infinite;
    }
    .ring::after {
      content: "";
      position: absolute;
      top: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #06b6d4;
      box-shadow: 0 0 12px rgba(6, 182, 212, 0.8);
    }
    .title {
      position: relative;
      font-size: 40px;
      letter-spacing: 4px;
      text-transform: uppercase;
      font-weight: 600;
      animation: rise 1.2s ease forwards;
    }
    .title span {
      display: inline-block;
      background: linear-gradient(90deg, #cce1ff 0%, #3b82f6 45%, #06b6d4 70%, #cce1ff 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: shimmer 1.6s ease-in-out infinite;
    }
    .subtitle {
      margin-top: 10px;
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(233, 240, 255, 0.65);
      animation: fade 1.2s ease 0.4s forwards;
      opacity: 0;
    }
    .progress {
      margin-top: 18px;
      width: 220px;
      height: 6px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.18);
      overflow: hidden;
      box-shadow: inset 0 0 8px rgba(6, 182, 212, 0.12);
    }
    .progress::after {
      content: "";
      display: block;
      height: 100%;
      width: 40%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.9) 45%, rgba(6,182,212,0.9) 100%);
      animation: progress 1.6s ease-in-out infinite;
    }
    .status {
      margin-top: 10px;
      font-size: 12px;
      letter-spacing: 1.5px;
      color: rgba(233, 240, 255, 0.6);
      text-transform: uppercase;
      animation: fade 1.2s ease 0.6s forwards;
      opacity: 0;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.05); opacity: 1; }
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes rise {
      0% { transform: translateY(10px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes fade {
      100% { opacity: 1; }
    }
    @keyframes shimmer {
      0% { filter: brightness(0.9); }
      50% { filter: brightness(1.3); }
      100% { filter: brightness(0.9); }
    }
    @keyframes progress {
      0% { transform: translateX(-80%); }
      50% { transform: translateX(10%); }
      100% { transform: translateX(160%); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="glow"></div>
    <div class="ring"></div>
    <div class="stack">
      <div class="title"><span>Dory</span></div>
      <div class="subtitle">Loading your workspace</div>
      <div class="progress"></div>
      <div class="status">Starting app</div>
    </div>
  </div>
</body>
</html>`;

  const splashUrl = `data:text/html;charset=UTF-8,${encodeURIComponent(splashHtml)}`;
  splashWindow.loadURL(splashUrl);
  splashShownAt = Date.now();

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

export function sendAuthCallback(url: string, logWarn: LogFn) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    logWarn('[electron] main window unavailable, queueing auth callback:', url);
    pendingAuthCallback = url;
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  logWarn('[electron] sending auth callback to renderer:', url);
  mainWindow.webContents.send('auth:callback', url);
}

export function setPendingAuthCallback(url: string) {
  pendingAuthCallback = url;
}

export function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

export function hasMainWindow() {
  return Boolean(mainWindow && !mainWindow.isDestroyed());
}
