import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { PostgresDBClient } from '@/types';
import { getServerLocale } from '@/lib/i18n/server-locale';
import { translate } from '@/lib/i18n/i18n';
import { getClient } from '@/lib/database/postgres/client';
import type { OrganizationProvisioningKind } from '@/lib/database/postgres/schemas';
import { schema } from '@/lib/database/schema';
import { mergeAnonymousOrganizationIntoExistingOrganization, migrateAnonymousOrganizationOwnership } from '@/lib/database/postgres/impl/organization/anonymous-resource-merge';
import { resolveAnonymousOrganizationLinkDecision } from './anonymous-link-strategy';
import { createProvisionedOrganization } from './organization-provisioning';

type AuthSessionLike = {
    session?: {
        token?: string | null;
        activeOrganizationId?: string | null;
    } | null;
    user?: {
        id?: string | null;
        email?: string | null;
        isAnonymous?: boolean | null;
    } | null;
};

export const anonymousDeleteCleanupTableCoverage = {
    connectionIdentityScoped: ['connectionIdentitySecrets'],
    connectionScoped: ['connectionSsh', 'tabs', 'aiSchemaCache', 'syncOperations'],
    organizationScoped: [
        'chatMessages',
        'chatSessionState',
        'chatSessions',
        'savedQueries',
        'savedQueryFolders',
        'queryAudit',
        'aiUsageEvents',
        'aiUsageTraces',
        'invitation',
        'organizationMembers',
        'connectionIdentities',
        'connections',
        'organizations',
    ],
} as const;

type AnonymousOrganizationRow = {
    id: string;
    slug: string | null;
    name: string;
    provisioningKind: OrganizationProvisioningKind | null;
};

function slugifyOrganizationName(name: string) {
    const normalized = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || 'workspace';
}

async function buildAnonymousOrganizationValues(userId: string) {
    const locale = await getServerLocale();
    const t = (key: string, values?: Record<string, unknown>) => translate(locale, key, values);
    const name = t('Auth.AnonymousWorkspace.Name');

    return {
        name,
        slug: `${slugifyOrganizationName(name)}-${userId.slice(0, 8)}`,
    };
}

async function getDb() {
    return (await getClient()) as PostgresDBClient;
}

async function findFirstActiveOrganizationIdForUser(db: PostgresDBClient, userId: string) {
    const [membership] = await db
        .select({ organizationId: schema.organizationMembers.organizationId })
        .from(schema.organizationMembers)
        .where(and(eq(schema.organizationMembers.userId, userId), or(eq(schema.organizationMembers.status, 'active'), isNull(schema.organizationMembers.status))))
        .limit(1);

    return membership?.organizationId ?? null;
}

async function findOwnedOrganizationIdsForUser(db: Pick<PostgresDBClient, 'select'>, userId: string) {
    const organizations = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.ownerUserId, userId));

    return organizations.map(organization => organization.id);
}

async function findAnonymousOrganizationIdsForLink(
    db: PostgresDBClient,
    params: {
        anonymousUserId: string;
        anonymousActiveOrganizationId?: string | null;
    },
) {
    const organizationIds = [
        params.anonymousActiveOrganizationId ?? null,
        await findFirstActiveOrganizationIdForUser(db, params.anonymousUserId),
        ...(await findOwnedOrganizationIdsForUser(db, params.anonymousUserId)),
    ].filter((organizationId): organizationId is string => Boolean(organizationId));

    return [...new Set(organizationIds)];
}

export async function cleanupAnonymousUserOrganizations(userId: string) {
    const db = await getDb();
    const organizationIds = await findOwnedOrganizationIdsForUser(db, userId);

    if (organizationIds.length === 0) {
        return { organizationIds: [], deletedOrganizations: 0 };
    }

    await db.transaction(async tx => {
        const connections = await tx.select({ id: schema.connections.id }).from(schema.connections).where(inArray(schema.connections.organizationId, organizationIds));

        const connectionIds = connections.map(connection => connection.id);

        const connectionIdentities = connectionIds.length
            ? await tx.select({ id: schema.connectionIdentities.id }).from(schema.connectionIdentities).where(inArray(schema.connectionIdentities.connectionId, connectionIds))
            : [];
        const connectionIdentityIds = connectionIdentities.map(identity => identity.id);

        if (connectionIdentityIds.length > 0) {
            await tx.delete(schema.connectionIdentitySecrets).where(inArray(schema.connectionIdentitySecrets.identityId, connectionIdentityIds));
        }

        if (connectionIds.length > 0) {
            await tx.delete(schema.connectionSsh).where(inArray(schema.connectionSsh.connectionId, connectionIds));
            await tx.delete(schema.tabs).where(inArray(schema.tabs.connectionId, connectionIds));
            await tx.delete(schema.aiSchemaCache).where(inArray(schema.aiSchemaCache.connectionId, connectionIds));
            await tx.delete(schema.syncOperations).where(and(eq(schema.syncOperations.entityType, 'connection'), inArray(schema.syncOperations.entityId, connectionIds)));
        }

        if (connectionIdentityIds.length > 0) {
            await tx
                .delete(schema.syncOperations)
                .where(and(eq(schema.syncOperations.entityType, 'connection_identity'), inArray(schema.syncOperations.entityId, connectionIdentityIds)));
        }

        if (organizationIds.length > 0) {
            await tx.delete(schema.chatMessages).where(inArray(schema.chatMessages.organizationId, organizationIds));
            await tx.delete(schema.chatSessionState).where(inArray(schema.chatSessionState.organizationId, organizationIds));
            await tx.delete(schema.chatSessions).where(inArray(schema.chatSessions.organizationId, organizationIds));
            await tx.delete(schema.savedQueries).where(inArray(schema.savedQueries.organizationId, organizationIds));
            await tx.delete(schema.savedQueryFolders).where(inArray(schema.savedQueryFolders.organizationId, organizationIds));
            await tx.delete(schema.queryAudit).where(inArray(schema.queryAudit.organizationId, organizationIds));
            await tx.delete(schema.aiUsageEvents).where(inArray(schema.aiUsageEvents.organizationId, organizationIds));
            await tx.delete(schema.aiUsageTraces).where(inArray(schema.aiUsageTraces.organizationId, organizationIds));
            await tx.delete(schema.invitation).where(inArray(schema.invitation.organizationId, organizationIds));
            await tx.delete(schema.organizationMembers).where(inArray(schema.organizationMembers.organizationId, organizationIds));
            await tx.delete(schema.connectionIdentities).where(inArray(schema.connectionIdentities.organizationId, organizationIds));
            await tx.delete(schema.connections).where(inArray(schema.connections.organizationId, organizationIds));
            await tx.delete(schema.organizations).where(inArray(schema.organizations.id, organizationIds));
        }
    });

    return {
        organizationIds,
        deletedOrganizations: organizationIds.length,
    };
}

async function normalizeAnonymousSourceOrganizations(tx: Pick<PostgresDBClient, 'update'>, organizations: AnonymousOrganizationRow[]) {
    const organizationIdsToBackfill = organizations.filter(organization => organization.provisioningKind == null).map(organization => organization.id);

    if (organizationIdsToBackfill.length > 0) {
        await tx
            .update(schema.organizations)
            .set({
                provisioningKind: 'anonymous',
                updatedAt: new Date(),
            })
            .where(inArray(schema.organizations.id, organizationIdsToBackfill));
    }

    return organizations.map(organization => ({
        ...organization,
        provisioningKind: organization.provisioningKind ?? 'anonymous',
    }));
}

export async function buildDefaultOrganizationValues(userId: string, email: string | null | undefined) {
    const locale = await getServerLocale();
    const t = (key: string, values?: Record<string, unknown>) => translate(locale, key, values);
    const name = t('Auth.TeamName', { name: email ?? t('Auth.TeamDefaultName') });

    return {
        name,
        slug: `${slugifyOrganizationName(name)}-${userId.slice(0, 8)}`,
    };
}

export async function bootstrapAnonymousOrganization(params: { auth: any; session: AuthSessionLike; headers?: Headers }) {
    const db = await getDb();
    const userId = params.session.user?.id ?? null;
    const sessionToken = params.session.session?.token ?? null;

    if (!userId || !sessionToken) {
        throw new Error('missing_anonymous_session');
    }

    let organizationId = params.session.session?.activeOrganizationId ?? (await findFirstActiveOrganizationIdForUser(db, userId));

    if (!organizationId) {
        const defaults = await buildAnonymousOrganizationValues(userId);
        const created = await createProvisionedOrganization({
            auth: params.auth,
            headers: params.headers,
            userId,
            name: defaults.name,
            slug: defaults.slug,
            provisioningKind: 'anonymous',
        });

        organizationId = created?.id ?? null;
        if (!organizationId) {
            throw new Error(`failed_to_create_default_organization_for_${userId}`);
        }
    }

    const [organization] = await db
        .select({
            id: schema.organizations.id,
            slug: schema.organizations.slug,
            name: schema.organizations.name,
            provisioningKind: schema.organizations.provisioningKind,
        })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .limit(1);

    if (!organization) {
        throw new Error(`organization_not_found_for_${organizationId}`);
    }

    await db
        .update(schema.session)
        .set({
            activeOrganizationId: organization.id,
            updatedAt: new Date(),
        })
        .where(eq(schema.session.token, sessionToken));

    return organization;
}

export async function linkAnonymousOrganizationToUser(params: {
    anonymousUserId: string;
    anonymousActiveOrganizationId?: string | null;
    newUserId: string;
    newSessionToken?: string | null;
    newActiveOrganizationId?: string | null;
}) {
    const db = await getDb();
    const sourceOrganizationIds = await findAnonymousOrganizationIdsForLink(db, {
        anonymousUserId: params.anonymousUserId,
        anonymousActiveOrganizationId: params.anonymousActiveOrganizationId,
    });

    if (sourceOrganizationIds.length === 0) {
        return null;
    }

    const primarySourceOrganizationId = sourceOrganizationIds[0];

    const resultOrganization = await db.transaction(async tx => {
        const preexistingMemberships = await tx
            .select({ organizationId: schema.organizationMembers.organizationId })
            .from(schema.organizationMembers)
            .where(and(eq(schema.organizationMembers.userId, params.newUserId), or(eq(schema.organizationMembers.status, 'active'), isNull(schema.organizationMembers.status))));

        const sourceOrganizationsRaw = await tx
            .select({
                id: schema.organizations.id,
                slug: schema.organizations.slug,
                name: schema.organizations.name,
                provisioningKind: schema.organizations.provisioningKind,
            })
            .from(schema.organizations)
            .where(inArray(schema.organizations.id, sourceOrganizationIds));

        const sourceOrganizationOrder = new Map(sourceOrganizationIds.map((organizationId, index) => [organizationId, index]));
        const sourceOrganizations = (await normalizeAnonymousSourceOrganizations(tx, sourceOrganizationsRaw)).sort(
            (left, right) => (sourceOrganizationOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (sourceOrganizationOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        );

        if (sourceOrganizations.length === 0) {
            return null;
        }

        const primarySourceOrganization = sourceOrganizations.find(organization => organization.id === primarySourceOrganizationId) ?? sourceOrganizations[0]!;
        const targetCandidateOrganizationIds = [...new Set(preexistingMemberships.map(membership => membership.organizationId))];
        const targetCandidateOrganizations = targetCandidateOrganizationIds.length
            ? await tx
                  .select({
                      id: schema.organizations.id,
                      slug: schema.organizations.slug,
                      name: schema.organizations.name,
                      provisioningKind: schema.organizations.provisioningKind,
                  })
                  .from(schema.organizations)
                  .where(inArray(schema.organizations.id, targetCandidateOrganizationIds))
            : [];

        const linkDecision = resolveAnonymousOrganizationLinkDecision({
            sourceOrganizations,
            userOrganizations: targetCandidateOrganizations,
            newActiveOrganizationId: params.newActiveOrganizationId,
        });

        if (!linkDecision) {
            return null;
        }

        if (linkDecision.action === 'merge' && linkDecision.targetOrganizationId) {
            const mergeResults = [];

            for (const sourceOrganization of sourceOrganizations) {
                const mergeResult = await mergeAnonymousOrganizationIntoExistingOrganization(tx, {
                    sourceOrganizationId: sourceOrganization.id,
                    targetOrganizationId: linkDecision.targetOrganizationId,
                    anonymousUserId: params.anonymousUserId,
                    newUserId: params.newUserId,
                });

                await tx.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, sourceOrganization.id));

                await tx.delete(schema.organizations).where(eq(schema.organizations.id, sourceOrganization.id));

                mergeResults.push(mergeResult);
            }

            if (params.newSessionToken) {
                await tx
                    .update(schema.session)
                    .set({
                        activeOrganizationId: linkDecision.targetOrganizationId,
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.session.token, params.newSessionToken));
            }

            console.log('[auth] merged guest organizations into existing organization', mergeResults);

            const [targetOrganization] = await tx
                .select({
                    id: schema.organizations.id,
                    slug: schema.organizations.slug,
                    name: schema.organizations.name,
                    provisioningKind: schema.organizations.provisioningKind,
                })
                .from(schema.organizations)
                .where(eq(schema.organizations.id, linkDecision.targetOrganizationId))
                .limit(1);

            return targetOrganization ?? null;
        }

        const migrationResults = [];

        for (const sourceOrganization of sourceOrganizations) {
            await tx
                .update(schema.organizations)
                .set({
                    ownerUserId: params.newUserId,
                    provisioningKind: 'anonymous_promoted',
                    updatedAt: new Date(),
                })
                .where(eq(schema.organizations.id, sourceOrganization.id));

            const [existingMembership] = await tx
                .select({ id: schema.organizationMembers.id })
                .from(schema.organizationMembers)
                .where(and(eq(schema.organizationMembers.organizationId, sourceOrganization.id), eq(schema.organizationMembers.userId, params.newUserId)))
                .limit(1);

            if (existingMembership) {
                await tx
                    .update(schema.organizationMembers)
                    .set({
                        role: 'owner',
                        status: 'active',
                        joinedAt: new Date(),
                    })
                    .where(eq(schema.organizationMembers.id, existingMembership.id));
            } else {
                await tx.insert(schema.organizationMembers).values({
                    userId: params.newUserId,
                    organizationId: sourceOrganization.id,
                    role: 'owner',
                    status: 'active',
                    joinedAt: new Date(),
                });
            }

            const migrationResult = await migrateAnonymousOrganizationOwnership(tx, {
                sourceOrganizationId: sourceOrganization.id,
                targetOrganizationId: sourceOrganization.id,
                anonymousUserId: params.anonymousUserId,
                newUserId: params.newUserId,
            });

            migrationResults.push(migrationResult);
        }

        if (params.newSessionToken) {
            await tx
                .update(schema.session)
                .set({
                    activeOrganizationId: linkDecision.primarySourceOrganizationId,
                    updatedAt: new Date(),
                })
                .where(eq(schema.session.token, params.newSessionToken));
        }

        console.log('[auth] reassigned guest organization ownership to linked user', migrationResults);

        return sourceOrganizations.find(sourceOrganization => sourceOrganization.id === linkDecision.primarySourceOrganizationId) ?? primarySourceOrganization;
    });

    return resultOrganization;
}
