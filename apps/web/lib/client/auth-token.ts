import { TOKEN_COOKIE_KEY } from "@/shared/data/app.data";

const TOKEN_STORAGE_KEY = 'auth_token';

export async function getAuthToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    document.cookie = `dory_access_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
}

export async function clearAuthToken(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    document.cookie = `${TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0`;
}
