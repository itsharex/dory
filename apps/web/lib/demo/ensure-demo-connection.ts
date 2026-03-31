import fs from 'node:fs';
import type { DBService } from '@/lib/database';
import { getDemoSqlitePath } from './paths';

const DEMO_CONNECTION_NAME = 'Demo Database';

/**
 * Ensure a "Demo Database" SQLite connection exists for the given organization.
 * Idempotent: skips if the connection already exists or if the demo.sqlite file is not available.
 */
export async function ensureDemoConnection(
    db: DBService,
    userId: string,
    organizationId: string,
): Promise<void> {
    const demoPath = getDemoSqlitePath();
    if (!demoPath || !fs.existsSync(demoPath)) {
        console.log('[demo] demo.sqlite not found, skipping demo connection creation');
        return;
    }

    const existing = await db.connections.list(organizationId);
    const hasDemoConnection = existing.some((c) => c.name === DEMO_CONNECTION_NAME);
    if (hasDemoConnection) {
        return;
    }

    console.log(`[demo] creating "${DEMO_CONNECTION_NAME}" connection for org ${organizationId}`);

    await db.connections.create(userId, organizationId, {
        connection: {
            organizationId,
            type: 'sqlite',
            engine: 'sqlite',
            name: DEMO_CONNECTION_NAME,
            description: 'Built-in demo database with sample users, orders, and logs data',
            host: null,
            port: null,
            database: 'main',
            path: demoPath,
            status: 'ready',
        },
        identities: [
            {
                name: 'Default',
                username: 'sqlite',
                isDefault: true,
                database: 'main',
                enabled: true,
                role: null,
                options: '{}',
            } as any,
        ],
    });

    console.log(`[demo] "${DEMO_CONNECTION_NAME}" connection created`);
}
