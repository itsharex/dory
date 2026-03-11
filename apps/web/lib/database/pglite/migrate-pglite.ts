import type { MigrationConfig } from 'drizzle-orm/migrator';
import migrations from './migrations.json';
import { getPgliteClient } from '../postgres/client/pglite';
import { translateDatabase } from '../i18n';

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
    }
}
