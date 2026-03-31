import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEMO_SQLITE_FILENAME = 'demo.sqlite';

/**
 * Resolve the absolute path for demo.sqlite based on PGLITE_DB_PATH.
 * The demo file lives as a sibling of the PGlite data directory.
 *
 * Example: PGLITE_DB_PATH = "file:///app/data/dory" → "/app/data/demo.sqlite"
 */
export function resolveDemoSqlitePath(): string {
    const raw = process.env.PGLITE_DB_PATH;
    if (!raw) {
        throw new Error('[demo] PGLITE_DB_PATH is not set, cannot resolve demo.sqlite path');
    }

    const fsPath = raw.startsWith('file:') ? fileURLToPath(raw) : decodeURIComponent(raw);
    const parentDir = path.dirname(path.resolve(fsPath));
    return path.join(parentDir, DEMO_SQLITE_FILENAME);
}

/**
 * Get the demo.sqlite path from the environment variable set during bootstrap.
 */
export function getDemoSqlitePath(): string | undefined {
    return process.env.DEMO_SQLITE_PATH || undefined;
}
