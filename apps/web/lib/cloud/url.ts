function readEnv(name: keyof NodeJS.ProcessEnv): string | null {
    const value = process.env[name];
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed || null;
}

function stripTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function toCloudApiBaseUrl(value: string): string {
    const normalized = stripTrailingSlash(value);
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

export function getCloudApiBaseUrl(): string | null {
    const explicitApiUrl = readEnv('DORY_CLOUD_API_URL') ?? readEnv('NEXT_PUBLIC_DORY_CLOUD_API_URL');
    if (explicitApiUrl) {
        return stripTrailingSlash(explicitApiUrl);
    }

    const legacyCloudUrl = readEnv('DORY_AI_CLOUD_URL');
    if (legacyCloudUrl) {
        return toCloudApiBaseUrl(legacyCloudUrl);
    }

    return null;
}
