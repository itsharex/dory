import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';

export type MainLocale = 'zh-CN' | 'en-US' | 'ja-JP' | 'es-ES';

const localeStore = new Store<{ locale: MainLocale }>({
    name: 'preferences',
});

function normalizeMainLocale(rawLocale: string | undefined): MainLocale {
    if (!rawLocale) return 'en-US';
    const lower = rawLocale.toLowerCase();
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('ja')) return 'ja-JP';
    if (lower.startsWith('es')) return 'es-ES';
    return 'en-US';
}

export function getSystemLocale(): MainLocale {
    return normalizeMainLocale(app.getLocale());
}

export function isMainLocale(value: unknown): value is MainLocale {
    return value === 'zh-CN' || value === 'en-US' || value === 'ja-JP' || value === 'es-ES';
}

export function getStoredLocale(): MainLocale {
    const stored = localeStore.get('locale');
    return isMainLocale(stored) ? stored : getSystemLocale();
}

export function setStoredLocale(locale: MainLocale) {
    localeStore.set('locale', locale);
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('locale:changed', locale);
    }
}

export function registerLocaleIpc(onLocaleChanged?: (locale: MainLocale) => void) {
    ipcMain.removeHandler('locale:get');
    ipcMain.handle('locale:get', () => getStoredLocale());

    ipcMain.removeHandler('locale:set');
    ipcMain.handle('locale:set', (_event, locale: MainLocale) => {
        if (!isMainLocale(locale)) {
            return getStoredLocale();
        }

        if (locale !== getStoredLocale()) {
            setStoredLocale(locale);
            onLocaleChanged?.(locale);
        }

        return getStoredLocale();
    });
}
