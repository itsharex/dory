import { defineConfig } from 'drizzle-kit';
import path from 'path';
import { extractFilePath } from './lib/database/pglite/url';

const pgliteDataDir = process.env.PGLITE_DB_PATH
    ? extractFilePath(process.env.PGLITE_DB_PATH)
    : './data/dory.db';

export default defineConfig({
    dialect: 'postgresql',
    driver: 'pglite',
    schema: ['./lib/database/postgres/schemas/index.ts'],
    out: './lib/database/pglite/migrations',
    dbCredentials: {
        url: path.resolve(process.cwd(), pgliteDataDir),
    },
});
