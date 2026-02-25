
import { X_CONNECTION_ID_KEY } from '@/app/config/app';
import { getAuthBaseUrl, isAuthPath } from './auth-runtime';
import { getAuthToken } from './auth-token';

function getStoredConnectionId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem('currentConnection');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.connection?.id ?? null;
    } catch {
        return null;
    }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const headers = new Headers(init.headers ?? {});
    const token = await getAuthToken();
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const storedConnectionId = getStoredConnectionId();
    if (storedConnectionId && !headers.has(X_CONNECTION_ID_KEY)) {
        headers.set(X_CONNECTION_ID_KEY, storedConnectionId);
    }

    let resolvedInput: RequestInfo | URL = input;
    const authBaseUrl = getAuthBaseUrl();

    if (authBaseUrl) {
        if (typeof input === 'string' && isAuthPath(input)) {
            resolvedInput = new URL(input, authBaseUrl).toString();
        } else if (input instanceof URL && isAuthPath(input.pathname)) {
            resolvedInput = new URL(input.pathname + input.search, authBaseUrl).toString();
        }
    }

    return fetch(resolvedInput, { ...init, headers });
}
