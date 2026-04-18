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
    sampleRows: z.array(z.record(z.string(), z.unknown())).optional(),
});

const responseSchema = z.object({
    quickSummary: z.object({
        title: z.string(),
        subtitle: z.string().optional(),
    }),
    insights: z.array(z.string()).min(3).max(5),
    reasoning: z
        .object({
            priorities: z.array(z.string()),
        })
        .optional(),
});

function buildPrompt(input: z.infer<typeof requestSchema>, locale: string) {
    return [
        `You rewrite structured data insights into concise user-facing analysis.`,
        `Return valid JSON only.`,
        `Locale: ${locale}.`,
        `Rules:`,
        `- Use only the provided facts and patterns.`,
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

        return new Response(JSON.stringify(result), {
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
