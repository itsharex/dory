import { getClient } from '@/lib/database/postgres/client';
import { DatabaseError } from '@/lib/errors/DatabaseError';
import { PostgresDBClient } from '@/types';
import { and, eq, isNull, or } from 'drizzle-orm';
import { organizations } from '@/lib/database/schema';
import { ensureDemoConnection } from '@/lib/demo/ensure-demo-connection';
import { organizationMembers, user } from '../../schemas';
import { translateDatabase } from '@/lib/database/i18n';
import type { PostgresConnectionsRepository } from '../connections';

export class PostgresOrganizationsRepository {
    private db!: PostgresDBClient;
    async init() {
        try {
            this.db = (await getClient()) as PostgresDBClient;
            if (!this.db) {
                throw new DatabaseError(translateDatabase('Database.Errors.ConnectionFailed'), 500);
            }
        } catch (e) {
            console.error(translateDatabase('Database.Logs.InitFailed'), e);
            throw new DatabaseError(translateDatabase('Database.Errors.InitFailed'), 500);
        }
    }

    async listByUser(userId: string) {
        return this.db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));
    }

    async ensureOrganizationDefaults(
        userId: string,
        organizationId: string,
        connectionsRepository: PostgresConnectionsRepository,
    ) {
        return ensureDemoConnection(
            {
                connections: connectionsRepository,
            },
            userId,
            organizationId,
        );
    }

    async getOrganizationBySlugOrId(value: string) {
        const rows = await this.db
            .select()
            .from(organizations)
            .where(or(eq(organizations.id, value), eq(organizations.slug, value)))
            .limit(1);

        return rows[0] ?? null;
    }

    async getOrganizationOwnerEmail(organizationId: string): Promise<string | null> {
        const rows = await this.db
            .select({
                email: user.email,
            })
            .from(organizations)
            .innerJoin(user, eq(user.id, organizations.ownerUserId))
            .where(eq(organizations.id, organizationId))
            .limit(1);

        return rows[0]?.email ?? null;
    }

    async isUserInOrganization(userId: string, organizationId: string): Promise<boolean> {
        const rows = await this.db
            .select({ exists: organizationMembers.organizationId })
            .from(organizationMembers)
            .where(
                and(
                    eq(organizationMembers.organizationId, organizationId),
                    eq(organizationMembers.userId, userId),
                    or(eq(organizationMembers.status, 'active'), isNull(organizationMembers.status)),
                ),
            )
            .limit(1);

        return rows.length > 0;
    }
}
