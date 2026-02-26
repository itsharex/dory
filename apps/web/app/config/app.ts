export const X_CONNECTION_ID_KEY = 'X-Connection-ID';

export const USE_CLOUD_AI =
    (process.env.NEXT_PUBLIC_DORY_RUNTIME?.trim() ?? '') === 'desktop';
