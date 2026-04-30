import { z } from 'zod';
import { withUserAndOrganizationHandler } from '@/app/api/utils/with-organization-handler';
import { getApiLocale } from '@/app/api/utils/i18n';
import { proxyAiRouteIfNeeded } from '@/app/api/utils/cloud-ai-proxy';
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
                nonNullCount: z.number(),
                distinctCount: z.number().nullable().optional(),
                distinctRatio: z.number().nullable().optional(),
                entropy: z.number().nullable().optional(),
                topValueShare: z.number().nullable().optional(),
                informationDensity: z.enum(['none', 'low', 'medium', 'high']).optional(),
                topK: z.array(z.object({ value: z.string(), count: z.number() })).optional(),
            }),
        )
        .optional(),
    sampleRows: z.array(z.record(z.string(), z.unknown())).optional(),
});

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

function normalizeResultInsightResponse(input: z.infer<typeof responseSchema>, payload: z.infer<typeof requestSchema>) {
    const insights = input.insights.map(stringifyInsight).filter(Boolean).slice(0, 5);
    const fallbackTitle = input.primaryInsight ?? insights[0] ?? 'Analysis';

    return {
        ...input,
        quickSummary: input.quickSummary ?? {
            title: fallbackTitle,
            subtitle: payload.summary.rowCount != null ? `${payload.summary.rowCount.toLocaleString()} rows` : undefined,
        },
        primaryInsight: input.primaryInsight ?? insights[0],
        insights: insights.length >= 3 ? insights : [...insights, ...payload.facts.map(fact => fact.narrativeHint).filter((item): item is string => !!item)].slice(0, 5),
        autoRunPolicy: input.recommendedSql ? 'confirm_required' : input.autoRunPolicy,
    };
}

function buildPrompt(input: z.infer<typeof requestSchema>, locale: string) {
    return [
        `You rewrite structured data insights into concise user-facing analysis.`,
        `Return valid JSON only.`,
        `Locale: ${locale}.`,
        `Rules:`,
        `- Use only the provided facts and patterns.`,
        `- Treat profileColumns as the deterministic fact layer. Use entropy, distinctRatio, topValueShare, and informationDensity to decide whether the result is invalid, weak, good, or actionable.`,
        `- If a column has entropy 0, informationDensity none, or topValueShare 1, do not call the top value an insight. Explain the lack of variance and recommend a better next step.`,
        `- For weak raw-row results, prefer a concrete aggregation query over another explanation.`,
        `- Recommend which Action cards should be shown. Keep each action label short and each description one sentence.`,
        `- Put the best next action in recommendedSql. Put other useful actions in alternativeActions, with recommendedSql when possible.`,
        `- Any recommendedSql must be a single read-only SELECT that only uses columns present in profileColumns and may wrap the current SQL as a subquery.`,
        `- autoRunPolicy must be confirm_required when recommendedSql is present.`,
        `- Do not invent values, ratios, anomalies, or correlations.`,
        `- Do not claim causation.`,
        `- Keep insights short, natural, and actionable.`,
        `- Produce 3 to 5 insights.`,
        ``,
        `Input:`,
        JSON.stringify(input, null, 2),
    ].join('\n');
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
            prompt: buildPrompt(payload, locale),
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
