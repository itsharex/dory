import 'server-only';

import { buildSchemaContextForTables } from '@/lib/ai/prompts';
import { inferSqlDraftContext } from '@/app/(app)/[team]/[connectionId]/chatbot/copilot/infer-sql-context';
import type { ActionContext } from '../types';

export async function hydrateActionContext(ctx: ActionContext): Promise<ActionContext> {
    if (!ctx.teamId || !ctx.userId || !ctx.connectionId) {
        return ctx;
    }

    const inferred = inferSqlDraftContext({
        dialect: ctx.dialect,
        editorText: ctx.sql,
        baselineDatabase: ctx.database ?? null,
    });

    if (!inferred.tables.length) {
        return ctx;
    }

    const schemaContext = await buildSchemaContextForTables({
        userId: ctx.userId,
        teamId: ctx.teamId,
        datasourceId: ctx.connectionId,
        database: inferred.database ?? ctx.database ?? null,
        tables: inferred.tables.map(table => ({
            database: table.database ?? inferred.database ?? ctx.database ?? null,
            name: table.name,
        })),
    });

    if (!schemaContext) {
        return ctx;
    }

    return {
        ...ctx,
        schemaContext,
    };
}
