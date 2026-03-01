import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    isPackaged: process.env.NODE_ENV === 'production' || process.env.ELECTRON_IS_PACKAGED === 'true',
});

contextBridge.exposeInMainWorld('authBridge', {
    openExternal: (url: string) => ipcRenderer.invoke('auth:openExternal', url),
    onCallback: (callback: (url: string) => void) => {
        const listener = (_event: unknown, url: string) => {
            console.log('[electron][preload] auth callback url:', url);
            callback(url);
        };
        ipcRenderer.on('auth:callback', listener);
        return () => ipcRenderer.removeListener('auth:callback', listener);
    },
});

contextBridge.exposeInMainWorld('themeBridge', {
    getTheme: () => ipcRenderer.invoke('theme:get'),
    setTheme: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
    onThemeChanged: (callback: (theme: 'light' | 'dark' | 'system') => void) => {
        const listener = (_event: unknown, theme: 'light' | 'dark' | 'system') => {
            callback(theme);
        };
        ipcRenderer.on('theme:changed', listener);
        return () => ipcRenderer.removeListener('theme:changed', listener);
    },
});

contextBridge.exposeInMainWorld('updateBridge', {
    getState: () => ipcRenderer.invoke('updater:get-state') as Promise<{ readyToInstall: boolean; version: string | null }>,
    restartAndInstall: () => ipcRenderer.invoke('updater:restart-and-install') as Promise<boolean>,
    onStateChanged: (callback: (state: { readyToInstall: boolean; version: string | null }) => void) => {
        const listener = (_event: unknown, state: { readyToInstall: boolean; version: string | null }) => {
            callback(state);
        };
        ipcRenderer.on('updater:state', listener);
        return () => ipcRenderer.removeListener('updater:state', listener);
    },
});
