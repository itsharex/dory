import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';

let splashWindow: BrowserWindow | null = null;
let splashShownAt = 0;

const splashHtmlPath = fileURLToPath(new URL('./splash.html', import.meta.url));

export function createSplashWindow() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        return { splashWindow, splashShownAt };
    }

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

    splashWindow.loadFile(splashHtmlPath);
    splashShownAt = Date.now();

    splashWindow.on('closed', () => {
        splashWindow = null;
    });

    return { splashWindow, splashShownAt };
}

export function getSplashWindow() {
    return splashWindow;
}

export function getSplashShownAt() {
    return splashShownAt;
}
