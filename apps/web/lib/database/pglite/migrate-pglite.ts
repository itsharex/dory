import fs from 'node:fs/promises';
import path from 'node:path';
import type { MigrationConfig } from 'drizzle-orm/migrator';
import migrations from './migrations.json';
import { getPgliteClient, resetPgliteClient, resolvePgliteDataDir } from '../postgres/client/pglite';
import { translateDatabase } from '../i18n';
import { exportWorkspaceRecoverySnapshot, importWorkspaceRecoverySnapshot } from './workspace-recovery';

async function runDrizzleMigrate(db: any) {
    const dialect = db?.dialect;
    const session = db?.session;

    if (!dialect || typeof dialect.migrate !== 'function' || !session) {
        throw new Error(translateDatabase('Database.Errors.PgliteInvalidInstance'));
    }

    await dialect.migrate(migrations as any, session, {
        migrationsTable: 'drizzle_migrations',
    } satisfies Omit<MigrationConfig, 'migrationsFolder'>);
}

function createArchiveSuffix(date = new Date()) {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '-',
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join('');
}

async function archivePgliteDataDir(dataDir: string) {
    const archivedDataDir = path.join(
        path.dirname(dataDir),
        `${path.basename(dataDir)}.broken-${createArchiveSuffix()}`,
    );

    await fs.rename(dataDir, archivedDataDir);
    console.warn('[PGlite migrate] Archived broken data directory', {
        from: dataDir,
        to: archivedDataDir,
    });

    return archivedDataDir;
}

export async function migratePgliteDB() {
    const db = await getPgliteClient();

    try {
        await runDrizzleMigrate(db);
        return;
    } catch (err) {
        console.warn(translateDatabase('Database.Errors.PgliteMigrationFailed'), {
            error: err,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            cause:
                err instanceof Error && 'cause' in err
                    ? (err as Error & { cause?: unknown }).cause
                    : undefined,
        });

        const dataDir = await resolvePgliteDataDir();

        await resetPgliteClient();
        const archivedDataDir = await archivePgliteDataDir(dataDir);
        const snapshotPath = `${archivedDataDir}.workspace-recovery.json`;

        let recoverySnapshot: Awaited<ReturnType<typeof exportWorkspaceRecoverySnapshot>> | null = null;

        try {
            recoverySnapshot = await exportWorkspaceRecoverySnapshot(archivedDataDir, snapshotPath);
        } catch (recoveryError) {
            console.warn('[PGlite migrate] Workspace recovery export failed', {
                archivedDataDir,
                snapshotPath,
                recoveryError,
            });
        }

        const freshDb = await getPgliteClient();
        await runDrizzleMigrate(freshDb);

        if (recoverySnapshot) {
            try {
                await importWorkspaceRecoverySnapshot(freshDb, recoverySnapshot);
            } catch (recoveryError) {
                console.warn('[PGlite migrate] Workspace recovery import failed', {
                    snapshotPath,
                    recoveryError,
                });
            }
        }
    }
}
