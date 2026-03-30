import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { schema } from '@/lib/database/schema';
import type { PostgresDBClient } from '@/types';

type TxLike = Pick<PostgresDBClient, 'select' | 'update' | 'delete'>;

export type AnonymousOrganizationMergeResult = {
    sourceOrganizationId: string;
    targetOrganizationId: string;
    renamedConnections: Array<{
        id: string;
        from: string;
        to: string;
    }>;
    tabsMoved: number;
    chatSessionsMoved: number;
    chatMessagesMoved: number;
    chatSessionStateMoved: number;
    savedQueriesMoved: number;
    savedQueryFoldersMoved: number;
    connectionsMoved: number;
    connectionIdentitiesMoved: number;
    aiSchemaCacheMoved: number;
    syncOperationsMoved: number;
};

function buildImportedConnectionName(baseName: string, occupiedNames: Set<string>) {
    const normalizedBaseName = baseName.trim() || 'Imported connection';
    let candidate = normalizedBaseName;
    let counter = 2;

    while (occupiedNames.has(candidate)) {
        candidate = `${normalizedBaseName} (${counter})`;
        counter += 1;
    }

    occupiedNames.add(candidate);
    return candidate;
}

export async function mergeAnonymousOrganizationIntoExistingOrganization(
    tx: TxLike,
    params: {
        sourceOrganizationId: string;
        targetOrganizationId: string;
        anonymousUserId: string;
        newUserId: string;
    },
): Promise<AnonymousOrganizationMergeResult> {
    const sourceConnections = await tx
        .select({
            id: schema.connections.id,
            name: schema.connections.name,
            createdByUserId: schema.connections.createdByUserId,
        })
        .from(schema.connections)
        .where(and(eq(schema.connections.organizationId, params.sourceOrganizationId), isNull(schema.connections.deletedAt)));

    const targetConnections = await tx
        .select({
            id: schema.connections.id,
            name: schema.connections.name,
        })
        .from(schema.connections)
        .where(and(eq(schema.connections.organizationId, params.targetOrganizationId), isNull(schema.connections.deletedAt)));

    const occupiedConnectionNames = new Set(targetConnections.map(connection => connection.name));
    const renamedConnections: AnonymousOrganizationMergeResult['renamedConnections'] = [];

    for (const sourceConnection of sourceConnections) {
        if (!occupiedConnectionNames.has(sourceConnection.name)) {
            occupiedConnectionNames.add(sourceConnection.name);
            continue;
        }

        const renamedConnection = buildImportedConnectionName(sourceConnection.name, occupiedConnectionNames);
        await tx
            .update(schema.connections)
            .set({
                name: renamedConnection,
                updatedAt: new Date(),
            })
            .where(eq(schema.connections.id, sourceConnection.id));

        renamedConnections.push({
            id: sourceConnection.id,
            from: sourceConnection.name,
            to: renamedConnection,
        });
    }

    const connectionIds = sourceConnections.map(connection => connection.id);

    let connectionsMoved = 0;
    if (connectionIds.length > 0) {
        const movedConnections = await tx
            .update(schema.connections)
            .set({
                organizationId: params.targetOrganizationId,
                createdByUserId: params.newUserId,
                updatedAt: new Date(),
            })
            .where(eq(schema.connections.organizationId, params.sourceOrganizationId))
            .returning({ id: schema.connections.id });

        connectionsMoved = movedConnections.length;
    }

    const sourceIdentities = connectionIds.length
        ? await tx
              .select({ id: schema.connectionIdentities.id })
              .from(schema.connectionIdentities)
              .where(inArray(schema.connectionIdentities.connectionId, connectionIds))
        : [];

    const identityIds = sourceIdentities.map(identity => identity.id);

    let connectionIdentitiesMoved = 0;
    if (connectionIds.length > 0) {
        const movedIdentities = await tx
            .update(schema.connectionIdentities)
            .set({
                organizationId: params.targetOrganizationId,
                createdByUserId: params.newUserId,
                updatedAt: new Date(),
            })
            .where(inArray(schema.connectionIdentities.connectionId, connectionIds))
            .returning({ id: schema.connectionIdentities.id });

        connectionIdentitiesMoved = movedIdentities.length;
    }

    let savedQueryFoldersMoved = 0;
    const movedFolders = await tx
        .update(schema.savedQueryFolders)
        .set({
            organizationId: params.targetOrganizationId,
            userId: params.newUserId,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(schema.savedQueryFolders.organizationId, params.sourceOrganizationId),
                eq(schema.savedQueryFolders.userId, params.anonymousUserId),
            ),
        )
        .returning({ id: schema.savedQueryFolders.id });
    savedQueryFoldersMoved = movedFolders.length;

    let savedQueriesMoved = 0;
    const movedQueries = await tx
        .update(schema.savedQueries)
        .set({
            organizationId: params.targetOrganizationId,
            userId: params.newUserId,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(schema.savedQueries.organizationId, params.sourceOrganizationId),
                eq(schema.savedQueries.userId, params.anonymousUserId),
            ),
        )
        .returning({ id: schema.savedQueries.id });
    savedQueriesMoved = movedQueries.length;

    let chatSessionsMoved = 0;
    const movedSessions = await tx
        .update(schema.chatSessions)
        .set({
            organizationId: params.targetOrganizationId,
            userId: params.newUserId,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(schema.chatSessions.organizationId, params.sourceOrganizationId),
                eq(schema.chatSessions.userId, params.anonymousUserId),
            ),
        )
        .returning({ id: schema.chatSessions.id });
    chatSessionsMoved = movedSessions.length;

    let chatMessagesMoved = 0;
    const movedMessages = await tx
        .update(schema.chatMessages)
        .set({
            organizationId: params.targetOrganizationId,
            userId: params.newUserId,
        })
        .where(
            and(
                eq(schema.chatMessages.organizationId, params.sourceOrganizationId),
                eq(schema.chatMessages.userId, params.anonymousUserId),
            ),
        )
        .returning({ id: schema.chatMessages.id });
    chatMessagesMoved = movedMessages.length;

    let chatSessionStateMoved = 0;
    const movedSessionState = await tx
        .update(schema.chatSessionState)
        .set({
            organizationId: params.targetOrganizationId,
            updatedAt: new Date(),
        })
        .where(eq(schema.chatSessionState.organizationId, params.sourceOrganizationId))
        .returning({ sessionId: schema.chatSessionState.sessionId });
    chatSessionStateMoved = movedSessionState.length;

    let tabsMoved = 0;
    if (connectionIds.length > 0) {
        const movedTabs = await tx
            .update(schema.tabs)
            .set({
                userId: params.newUserId,
                updatedAt: new Date(),
            })
            .where(and(eq(schema.tabs.userId, params.anonymousUserId), inArray(schema.tabs.connectionId, connectionIds)))
            .returning({ tabId: schema.tabs.tabId });
        tabsMoved = movedTabs.length;
    }

    let aiSchemaCacheMoved = 0;
    if (connectionIds.length > 0) {
        const movedCaches = await tx
            .update(schema.aiSchemaCache)
            .set({
                organizationId: params.targetOrganizationId,
                updatedAt: new Date().toISOString(),
            })
            .where(
                and(
                    eq(schema.aiSchemaCache.organizationId, params.sourceOrganizationId),
                    inArray(schema.aiSchemaCache.connectionId, connectionIds),
                ),
            )
            .returning({ id: schema.aiSchemaCache.id });
        aiSchemaCacheMoved = movedCaches.length;
    }

    let syncOperationsMoved = 0;
    if (connectionIds.length > 0 || identityIds.length > 0) {
        const syncConditions = [];
        if (connectionIds.length > 0) {
            syncConditions.push(and(eq(schema.syncOperations.entityType, 'connection'), inArray(schema.syncOperations.entityId, connectionIds)));
        }
        if (identityIds.length > 0) {
            syncConditions.push(and(eq(schema.syncOperations.entityType, 'connection_identity'), inArray(schema.syncOperations.entityId, identityIds)));
        }

        const movedSyncOperations = await tx
            .update(schema.syncOperations)
            .set({
                organizationId: params.targetOrganizationId,
                updatedAt: new Date(),
            })
            .where(and(eq(schema.syncOperations.organizationId, params.sourceOrganizationId), or(...syncConditions)))
            .returning({ id: schema.syncOperations.id });
        syncOperationsMoved = movedSyncOperations.length;
    }

    return {
        sourceOrganizationId: params.sourceOrganizationId,
        targetOrganizationId: params.targetOrganizationId,
        renamedConnections,
        tabsMoved,
        chatSessionsMoved,
        chatMessagesMoved,
        chatSessionStateMoved,
        savedQueriesMoved,
        savedQueryFoldersMoved,
        connectionsMoved,
        connectionIdentitiesMoved,
        aiSchemaCacheMoved,
        syncOperationsMoved,
    };
}
