// scripts/dev-bootstrap.ts
import 'dotenv/config'; // Equivalent to dotenv.config(), but more reliable
import fs from 'node:fs/promises';
import path from 'node:path';

import { migratePgliteDB } from '@/lib/database/pglite/migrate-pglite';
import { getDatabaseProvider } from '@/lib/database/provider';
import { ensureFileUrl, extractFilePath } from '@/lib/database/pglite/url';
import { resolveDemoSqlitePath } from '@/lib/demo/paths';
import { generateDemoSqlite } from '@/lib/demo/generate-demo-sqlite';

async function ensureDirForFile(filePath: string) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

async function bootstrapPglite() {
    /**
     * Your env should include at least:
     * - PGLITE_DB_PATH=file:/abs/path/db
     */
    const dbUrl = process.env.PGLITE_DB_PATH;

    if (!dbUrl) {
        throw new Error('[dev-bootstrap] DB_TYPE=pglite but PGLITE_DB_PATH is missing');
    }

    const dbFilePath = extractFilePath(dbUrl);
    process.env.PGLITE_DB_PATH = ensureFileUrl(dbFilePath);

    // 🔴 Key point: only create the parent directory
    await ensureDirForFile(dbFilePath);

    console.log('[dev] running pglite migrate...');
    await migratePgliteDB();
}

function bootstrapDemoSqlite() {
    try {
        const demoPath = resolveDemoSqlitePath();
        generateDemoSqlite(demoPath);
        process.env.DEMO_SQLITE_PATH = demoPath;
        console.log('[dev] DEMO_SQLITE_PATH =', demoPath);
    } catch (error) {
        console.warn('[dev] skipping demo sqlite:', error);
    }
}

export async function bootstrapLocalDev() {
    const dbType = getDatabaseProvider();

    console.log('[dev] DB_TYPE =', dbType);

    if (dbType === 'pglite') {
        await bootstrapPglite();
    } else {
        // Other types (postgres / mysql) usually don't need bootstrap in dev
        console.log('[dev] skip dev bootstrap');
    }

    bootstrapDemoSqlite();
}

// Allow direct tsx execution
bootstrapLocalDev().catch(err => {
    console.error('[dev-bootstrap] failed:', err);
    process.exit(1);
});
