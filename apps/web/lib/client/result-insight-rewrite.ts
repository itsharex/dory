import type { InsightRewriteRequest, InsightRewriteResponse } from './result-set-insights';

const insightRewriteCache = new Map<string, InsightRewriteResponse | null>();
const insightRewriteInflight = new Map<string, Promise<InsightRewriteResponse | null>>();

export function makeInsightRewriteCacheKey(request: InsightRewriteRequest | null | undefined) {
    return request ? JSON.stringify(request) : null;
}

export function getCachedInsightRewrite(cacheKey: string | null | undefined) {
    return cacheKey ? insightRewriteCache.get(cacheKey) : undefined;
}

export async function fetchInsightRewrite(cacheKey: string) {
    if (insightRewriteCache.has(cacheKey)) {
        return insightRewriteCache.get(cacheKey) ?? null;
    }

    const inflight = insightRewriteInflight.get(cacheKey);
    if (inflight) return inflight;

    const request = fetch('/api/ai/result-insights', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: cacheKey,
    })
        .then(async response => {
            const payload = (await response.json().catch(() => null)) as InsightRewriteResponse | null;
            if (payload) {
                insightRewriteCache.set(cacheKey, payload);
            }
            return payload ?? null;
        })
        .catch(() => {
            return null;
        })
        .finally(() => {
            insightRewriteInflight.delete(cacheKey);
        });

    insightRewriteInflight.set(cacheKey, request);
    return request;
}
