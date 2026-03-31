import path from 'node:path';

const DEMO_SQLITE_FILENAME = 'demo.sqlite';
const DEMO_SQLITE_DIR = path.join('public', 'resources');
const DEMO_SQLITE_RELATIVE_PATH = path.join(DEMO_SQLITE_DIR, DEMO_SQLITE_FILENAME);
export const DEMO_SQLITE_CONNECTION_PATH = 'dory://demo-sqlite';

/**
 * Resolve the absolute path for the bundled demo SQLite file.
 * The file is treated as a fixed app resource rather than a generated runtime artifact.
 */
export function resolveDemoSqlitePath(): string {
    return path.resolve(process.cwd(), DEMO_SQLITE_RELATIVE_PATH);
}

export function isDemoSqliteConnectionPath(value: string | null | undefined): boolean {
    return value?.trim() === DEMO_SQLITE_CONNECTION_PATH;
}

export function resolveStoredSqlitePath(value: string | null | undefined): string | undefined {
    const normalized = value?.trim();
    if (!normalized) return undefined;
    if (isDemoSqliteConnectionPath(normalized)) {
        return resolveDemoSqlitePath();
    }
    return normalized;
}

/**
 * Get the fixed absolute path for demo.sqlite.
 */
export function getDemoSqlitePath(): string | undefined {
    return resolveDemoSqlitePath();
}
