import Store from 'electron-store';
import type { UpdaterPreferences } from './types.js';

export const updaterPreferenceStore = new Store<UpdaterPreferences>({
    name: 'updater-preferences',
    defaults: {
        autoDownloadInstall: true,
        skippedVersion: null,
        remindLaterUntil: 0,
    },
});
