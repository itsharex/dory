// scripts/bootstrap.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migratePgliteDB } from '../lib/database/pglite/migrate-pglite';
import { getDatabaseProvider } from '../lib/database/provider';
import { DEFAULT_PGLITE_DB_PATH, DESKTOP_PGLITE_DB_PATH } from '@/shared/data/app.data';
import { ensureFileUrl } from '@/lib/database/pglite/url';
import { isDesktopRuntime } from '@/lib/runtime/runtime';


async function ensureDirForFile(filePath: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function toFsPath(v: string) {
  if (v.startsWith("file:")) return fileURLToPath(v);
  return decodeURIComponent(v);
}

async function bootstrapPglite() {
  const defaultFile = isDesktopRuntime() ? DESKTOP_PGLITE_DB_PATH : DEFAULT_PGLITE_DB_PATH;
  const raw = process.env.PGLITE_DB_PATH ?? defaultFile;
  console.log("[bootstrap] raw PGLITE_DB_PATH =", raw);

  const dbFilePath = toFsPath(raw);

  // Keep a canonical file:// URL in env so downstream code resolves paths consistently.
  process.env.PGLITE_DB_PATH = ensureFileUrl(dbFilePath);
  console.log("[bootstrap] normalized PGLITE_DB_PATH =", process.env.PGLITE_DB_PATH);
  console.log("[bootstrap] resolved pglite fs path =", dbFilePath);

  await ensureDirForFile(dbFilePath);

  console.log("[bootstrap] running pglite migrate...");
  await migratePgliteDB();
}

export async function bootstrap() {
    const dbType = getDatabaseProvider();
    console.log('[bootstrap] DB_TYPE =', dbType);

    if (dbType === 'pglite') {
        await bootstrapPglite();
    } else {
        console.log('[bootstrap] skip bootstrap');
    }
}

bootstrap().catch(err => {
    console.error('[bootstrap] failed:', err);
    process.exit(1);
});
