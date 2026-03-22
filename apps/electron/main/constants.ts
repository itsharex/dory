import { app } from 'electron';

export type DoryDistribution = 'stable' | 'beta';

function readEnv(name: keyof NodeJS.ProcessEnv): string | null {
    const value = process.env[name];
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed || null;
}

export const DISTRIBUTION: DoryDistribution = readEnv('DORY_DISTRIBUTION') === 'beta' ? 'beta' : 'stable';
export const APP_ID = readEnv('DORY_ELECTRON_APP_ID') ?? (DISTRIBUTION === 'beta' ? 'com.dory.app.beta' : 'com.dory.app');
export const PROTOCOL = readEnv('DORY_PROTOCOL_SCHEME') ?? (DISTRIBUTION === 'beta' ? 'dory-beta' : 'dory');
export const APP_BASE_URL = readEnv('DORY_APP_BASE_URL');
export const isBetaDistribution = DISTRIBUTION === 'beta';
export const isDev = !app.isPackaged;
