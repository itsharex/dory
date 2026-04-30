import { z } from 'zod';
import { withUserAndOrganizationHandler } from '@/app/api/utils/with-organization-handler';
import { getApiLocale } from '@/app/api/utils/i18n';
import { proxyAiRouteIfNeeded } from '@/app/api/utils/cloud-ai-proxy';
import { buildResultInsightsPrompt } from '@/lib/ai/prompts';
import { runLLMJson } from '@/lib/copilot/action/server/llm-json';

export const runtime = 'nodejs';

const requestSchema = z.object({
    locale: z.string().min(2),
    sqlText: z.string().nullish(),
    summary: z
        .object({
            kind: z.string(),
            rowCount: z.number().nullable(),
            columnCount: z.number(),
            recommendedChart: z.string().nullable().optional(),
            primaryTimeColumn: z.string().nullable().optional(),
        })
        .passthrough(),
    keyColumns: z.object({
        time: z.string().optional(),
        measures: z.array(z.string()),
        dimensions: z.array(z.string()),
        identifiers: z.array(z.string()),
    }),
    facts: z.array(
        z.object({
            id: z.string(),
            type: z.string(),
            title: z.string().optional(),
            severity: z.enum(['info', 'warning', 'risk']).optional(),
            confidence: z.number(),
            columns: z.array(z.string()).optional(),
            metrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
            narrativeHint: z.string().optional(),
        }),
    ),
    patterns: z.array(
        z.object({
            id: z.string(),
            kind: z.enum(['spike', 'drop', 'outlier', 'correlation', 'segment_shift']),
            confidence: z.number(),
            columns: z.array(z.string()),
            summary: z.string(),
            metrics: z.record(z.string(), z.union([z.string(), z.number()])),
        }),
    ),
    profileColumns: z
        .array(
            z.object({
                name: z.string(),
                semanticRole: z.string(),
                distinctCount: z.number().nullable().optional(),
                topValueShare: z.number().nullable().optional(),
                topK: z.array(z.object({ value: z.string(), count: z.number() })).optional(),
            }),
        )
        .optional(),
    sampleRows: z.array(z.record(z.string(), z.unknown())).optional(),
});

const resultActionSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('filter'),
        title: z.string().min(1),
        params: z.object({
            column: z.string().min(1),
            operator: z.enum(['>', '<', '=', '>=', '<=']),
            value: z.union([z.number(), z.string()]),
        }),
    }),
    z.object({
        type: z.literal('group'),
        title: z.string().min(1),
        params: z.object({
            dimensions: z.array(z.string().min(1)).min(1).max(3),
            measure: z
                .object({
                    column: z.string().min(1),
                    aggregation: z.enum(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']),
                })
                .optional(),
            limit: z.number().int().positive().max(200).optional(),
        }),
    }),
    z.object({
        type: z.literal('trend'),
        title: z.string().min(1),
        params: z.object({
            timeColumn: z.string().min(1),
            measure: z
                .object({
                    column: z.string().min(1),
                    aggregation: z.enum(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']),
                })
                .optional(),
            limit: z.number().int().positive().max(200).optional(),
        }),
    }),
    z.object({
        type: z.literal('distribution'),
        title: z.string().min(1),
        params: z.object({
            column: z.string().min(1),
        }),
    }),
]);

const recommendedResultActionSchema = resultActionSchema.and(
    z.object({
        priority: z.enum(['primary', 'secondary']).optional(),
    }),
);
type RecommendedResultAction = z.infer<typeof recommendedResultActionSchema>;

const responseSchema = z.object({
    analysisState: z.enum(['invalid', 'weak', 'good', 'actionable']).optional(),
    quickSummary: z
        .object({
            title: z.string(),
            subtitle: z.string().optional(),
        })
        .optional(),
    primaryInsight: z.string().optional(),
    limitations: z.array(z.string()).max(5).optional(),
    recommendedSql: z.string().nullable().optional(),
    recommendedActions: z.array(z.unknown()).max(5).optional(),
    alternativeActions: z
        .array(
            z.object({
                id: z.string().optional(),
                label: z.string(),
                description: z.string(),
                kind: z.enum(['drilldown', 'trend', 'distribution', 'topk', 'compare']).optional(),
                recommendedSql: z.string().nullable().optional(),
            }),
        )
        .max(5)
        .optional(),
    autoRunPolicy: z.literal('confirm_required').optional(),
    insights: z
        .array(
            z.union([
                z.string(),
                z
                    .object({
                        title: z.string().optional(),
                        summary: z.string().optional(),
                        description: z.string().optional(),
                        insight: z.string().optional(),
                    })
                    .passthrough(),
            ]),
        )
        .min(1)
        .max(5),
    reasoning: z
        .object({
            priorities: z.array(z.string()),
        })
        .optional(),
});

function stringifyInsight(value: z.infer<typeof responseSchema>['insights'][number]) {
    if (typeof value === 'string') return value.trim();
    return (value.summary ?? value.insight ?? value.description ?? value.title ?? '').trim();
}

function actionColumns(action: RecommendedResultAction) {
    if (action.type === 'filter') return [action.params.column];
    if (action.type === 'group') return [...action.params.dimensions, action.params.measure?.column].filter((column): column is string => !!column);
    if (action.type === 'trend') return [action.params.timeColumn, action.params.measure?.column].filter((column): column is string => !!column);
    return [action.params.column];
}

function filterAllowedActions(actions: RecommendedResultAction[], allowedColumns: Set<string>) {
    return actions.filter(action => {
        if (!allowedColumns.size) return true;
        return actionColumns(action).every(column => allowedColumns.has(column));
    });
}

function actionSignature(action: RecommendedResultAction) {
    return `${action.type}:${JSON.stringify(action.params)}`;
}

function normalizeRecommendedActions(actions: RecommendedResultAction[]) {
    const seen = new Set<string>();
    const deduped = actions.filter(action => {
        const signature = actionSignature(action);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
    });

    return deduped.slice(0, 4).map((action, index) => ({
        ...action,
        priority: index === 0 ? 'primary' : 'secondary',
    }));
}

function title(locale: string, zh: string, en: string) {
    return locale.toLowerCase().startsWith('zh') ? zh : en;
}

function buildFallbackRecommendedActions(payload: z.infer<typeof requestSchema>, allowedColumns: Set<string>) {
    const locale = payload.locale;
    const actions: RecommendedResultAction[] = [];
    const isAllowedColumn = (column?: string | null) => !!column && (!allowedColumns.size || allowedColumns.has(column));
    const profileColumns = payload.profileColumns ?? [];
    const primaryMeasure =
        payload.keyColumns.measures.find(isAllowedColumn) ?? profileColumns.find(column => column.semanticRole === 'measure' && isAllowedColumn(column.name))?.name;
    const primaryDimension =
        payload.keyColumns.dimensions.find(isAllowedColumn) ?? profileColumns.find(column => column.semanticRole === 'dimension' && isAllowedColumn(column.name))?.name;
    const timeColumn =
        (isAllowedColumn(payload.keyColumns.time) ? payload.keyColumns.time : undefined) ??
        profileColumns.find(column => column.semanticRole === 'time' && isAllowedColumn(column.name))?.name;
    const outlierPattern = payload.patterns.find(pattern => pattern.kind === 'outlier');
    const outlierColumn = outlierPattern?.columns[0];
    const outlierValue = outlierPattern?.metrics.value;

    if (timeColumn) {
        actions.push({
            type: 'trend',
            title: title(locale, `查看 ${timeColumn} 趋势`, `View trend by ${timeColumn}`),
            params: {
                timeColumn,
                measure: primaryMeasure
                    ? {
                          column: primaryMeasure,
                          aggregation: 'SUM',
                      }
                    : undefined,
                limit: 50,
            },
        });
    }

    if (primaryDimension) {
        actions.push({
            type: 'group',
            title: title(locale, `按 ${primaryDimension} 分组分析`, `Analyze by ${primaryDimension}`),
            params: {
                dimensions: [primaryDimension],
                measure: primaryMeasure
                    ? {
                          column: primaryMeasure,
                          aggregation: 'SUM',
                      }
                    : undefined,
                limit: 20,
            },
        });
    }

    if (primaryMeasure) {
        actions.push({
            type: 'distribution',
            title: title(locale, `查看 ${primaryMeasure} 分布`, `View ${primaryMeasure} distribution`),
            params: {
                column: primaryMeasure,
            },
        });
    }

    if (outlierColumn && typeof outlierValue === 'number' && Number.isFinite(outlierValue) && (!allowedColumns.size || allowedColumns.has(outlierColumn))) {
        actions.push({
            type: 'filter',
            title: title(locale, `检查 ${outlierColumn} 高值行`, `Inspect high ${outlierColumn} rows`),
            params: {
                column: outlierColumn,
                operator: '>',
                value: outlierValue,
            },
        });
    }

    return normalizeRecommendedActions(filterAllowedActions(actions, allowedColumns));
}

function normalizeResultInsightResponse(input: z.infer<typeof responseSchema>, payload: z.infer<typeof requestSchema>) {
    const insights = input.insights.map(stringifyInsight).filter(Boolean).slice(0, 5);
    const fallbackTitle = input.primaryInsight ?? insights[0] ?? 'Analysis';
    const allowedColumns = new Set(payload.profileColumns?.map(column => column.name) ?? []);
    const aiRecommendedActions = (input.recommendedActions ?? [])
        .map(action => recommendedResultActionSchema.safeParse(action).data)
        .filter((action): action is RecommendedResultAction => !!action);
    const recommendedActions = normalizeRecommendedActions(filterAllowedActions(aiRecommendedActions, allowedColumns));
    const fallbackRecommendedActions = recommendedActions.length ? recommendedActions : buildFallbackRecommendedActions(payload, allowedColumns);
    const recommendedSql = input.recommendedSql?.trim() || null;

    return {
        ...input,
        quickSummary: input.quickSummary ?? {
            title: fallbackTitle,
            subtitle: payload.summary.rowCount != null ? `${payload.summary.rowCount.toLocaleString()} rows` : undefined,
        },
        primaryInsight: input.primaryInsight ?? insights[0],
        insights: insights.length >= 3 ? insights : [...insights, ...payload.facts.map(fact => fact.narrativeHint).filter((item): item is string => !!item)].slice(0, 5),
        recommendedSql,
        recommendedActions: fallbackRecommendedActions,
        autoRunPolicy: recommendedSql || fallbackRecommendedActions.length ? 'confirm_required' : input.autoRunPolicy,
    };
}

export const POST = withUserAndOrganizationHandler(async ({ req, organizationId, userId }) => {
    const proxied = await proxyAiRouteIfNeeded(req, '/api/ai/result-insights');
    if (proxied) return proxied;

    const locale = await getApiLocale();

    try {
        const raw = await req.json().catch(() => null);
        const payload = requestSchema.parse(raw);

        if (!payload.facts.length && !payload.patterns.length) {
            return new Response(JSON.stringify(null), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const result = await runLLMJson({
            prompt: buildResultInsightsPrompt({ payload, locale }),
            schema: responseSchema,
            temperature: 0.2,
            maxRetries: 1,
            context: {
                organizationId,
                userId,
                feature: 'result_insights',
            },
        });
        const normalized = normalizeResultInsightResponse(result, payload);

        return new Response(JSON.stringify(normalized), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[api/ai/result-insights] error:', error);
        return new Response(JSON.stringify(null), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
