import type { InsightAction, InsightDraft, InsightFact, InsightKeyColumns, InsightPattern } from '@/lib/client/result-set-insights';
import type { AnalysisSuggestion, AnalysisSuggestionKind, ResultContext, TableRef } from './types';

const SERVICE_NAME_HINTS = ['service', 'source', 'component', 'app', 'application'];
const MESSAGE_NAME_HINTS = ['message', 'msg', 'description', 'event', 'title'];

function looksLike(name: string, hints: string[]) {
    const lower = name.trim().toLowerCase();
    return hints.some(hint => lower === hint || lower.includes(hint));
}

function clampPriority(value: number) {
    return Math.max(1, Math.min(100, value));
}

export function extractTableRefs(sqlText?: string | null, databaseName?: string | null): TableRef[] {
    const sql = sqlText?.trim();
    if (!sql) return [];

    const matches = [...sql.matchAll(/\b(?:from|join)\s+([a-zA-Z0-9_."]+)/gi)];
    const refs = matches
        .map(match => match[1]?.replace(/"/g, '').trim())
        .filter(Boolean)
        .map(raw => {
            const parts = raw!.split('.');
            if (parts.length >= 2) {
                return {
                    database: parts.slice(0, -1).join('.'),
                    table: parts[parts.length - 1]!,
                    confidence: 'medium' as const,
                };
            }

            return {
                database: databaseName ?? undefined,
                table: raw!,
                confidence: 'medium' as const,
            };
        });

    return refs.filter((ref, index) => refs.findIndex(candidate => candidate.database === ref.database && candidate.table === ref.table) === index);
}

function suggestionFromInsightAction(action: Extract<InsightAction, { kind: 'analysis-suggestion' }>): AnalysisSuggestion {
    const mapping: Record<string, { kind: AnalysisSuggestionKind; description: string; priority: number }> = {
        'time-error-trend': {
            kind: 'trend',
            description: 'Break the result down over time to validate whether the issue is concentrated in a period.',
            priority: 95,
        },
        'service-error-breakdown': {
            kind: 'drilldown',
            description: 'Split the result by service or source to identify which segment contributes most to the issue.',
            priority: 92,
        },
        'top-messages': {
            kind: 'topk',
            description: 'Inspect the most frequent message values to understand what is driving the result.',
            priority: 88,
        },
        'pattern-follow-up': {
            kind: 'compare',
            description: 'Follow up on the strongest detected pattern and compare the relevant segments.',
            priority: 80,
        },
    };

    const fallback = mapping[action.id] ?? {
        kind: 'drilldown' as const,
        description: 'Continue drilling into the current result.',
        priority: 75,
    };

    return {
        id: action.suggestionId,
        kind: fallback.kind,
        title: action.label,
        description: fallback.description,
        intent: {
            type: 'generate_sql',
            payload: {
                suggestionId: action.suggestionId,
            },
        },
        priority: fallback.priority,
    };
}

function suggestionExists(items: AnalysisSuggestion[], id: string) {
    return items.some(item => item.id === id);
}

function pushSuggestion(items: AnalysisSuggestion[], suggestion: AnalysisSuggestion | null | undefined) {
    if (!suggestion || suggestionExists(items, suggestion.id)) return;
    items.push(suggestion);
}

function topMeasure(keys: InsightKeyColumns) {
    return keys.measures[0] ?? null;
}

export function buildAnalysisSuggestions(params: {
    resultContext: ResultContext;
    draft?: InsightDraft | null;
    recommendedActions?: InsightAction[] | null;
}): AnalysisSuggestion[] {
    const suggestions: AnalysisSuggestion[] = [];
    const draft = params.draft ?? null;
    const recommendedActions = params.recommendedActions ?? [];

    for (const action of recommendedActions) {
        if (action.kind !== 'analysis-suggestion') continue;
        pushSuggestion(suggestions, suggestionFromInsightAction(action));
    }

    const keyColumns = draft?.keyColumns;
    if (!keyColumns) {
        return suggestions.sort((left, right) => right.priority - left.priority).slice(0, 5);
    }

    const riskSignal = draft.facts.some(fact => fact.type === 'risk_signal');
    const serviceColumn = keyColumns.dimensions.find(name => looksLike(name, SERVICE_NAME_HINTS));
    const messageColumn = keyColumns.dimensions.find(name => looksLike(name, MESSAGE_NAME_HINTS));
    const primaryMeasure = topMeasure(keyColumns);

    if (keyColumns.time && riskSignal && !suggestionExists(suggestions, 'time-error-trend')) {
        suggestions.push({
            id: 'time-error-trend',
            kind: 'trend',
            title: `Trend ${keyColumns.time} over time`,
            description: `Check whether the issue changes over ${keyColumns.time}.`,
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'time-error-trend',
                    timeColumn: keyColumns.time,
                },
            },
            priority: 95,
        });
    }

    if (serviceColumn && riskSignal && !suggestionExists(suggestions, 'service-error-breakdown')) {
        suggestions.push({
            id: 'service-error-breakdown',
            kind: 'drilldown',
            title: `Break down by ${serviceColumn}`,
            description: `Identify which ${serviceColumn} drives the issue most.`,
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'service-error-breakdown',
                    dimensionColumn: serviceColumn,
                },
            },
            priority: 92,
        });
    }

    if (messageColumn && !suggestionExists(suggestions, 'top-messages')) {
        suggestions.push({
            id: 'top-messages',
            kind: 'topk',
            title: `Inspect top ${messageColumn} values`,
            description: `See the most common ${messageColumn} values behind this result.`,
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'top-messages',
                    dimensionColumn: messageColumn,
                },
            },
            priority: 88,
        });
    }

    if (primaryMeasure && !suggestionExists(suggestions, 'measure-distribution')) {
        suggestions.push({
            id: 'measure-distribution',
            kind: 'distribution',
            title: `Profile ${primaryMeasure} distribution`,
            description: `Find the highest values and quantify the long tail for ${primaryMeasure}.`,
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'measure-distribution',
                    measureColumn: primaryMeasure,
                },
            },
            priority: 76,
        });
    }

    const dimensionColumn = keyColumns.dimensions.find(name => name !== serviceColumn && name !== messageColumn);
    if (dimensionColumn && primaryMeasure && !suggestionExists(suggestions, 'compare-by-dimension')) {
        suggestions.push({
            id: 'compare-by-dimension',
            kind: 'compare',
            title: `Compare ${primaryMeasure} by ${dimensionColumn}`,
            description: `Rank segments by ${primaryMeasure} to spot the highest-impact group.`,
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'compare-by-dimension',
                    dimensionColumn,
                    measureColumn: primaryMeasure,
                },
            },
            priority: 70,
        });
    }

    return suggestions
        .sort((left, right) => right.priority - left.priority)
        .slice(0, 5)
        .map(item => ({
            ...item,
            priority: clampPriority(item.priority),
        }));
}

export function buildAnalysisSummaryFromDraft(draft: InsightDraft, findings: string[]): string {
    return [draft.quickSummary.title, draft.quickSummary.subtitle, ...findings].filter(Boolean).join(' ');
}

export function topRiskFact(facts: InsightFact[]) {
    return facts.find(fact => fact.type === 'risk_signal') ?? null;
}

export function topPattern(patterns: InsightPattern[]) {
    return patterns[0] ?? null;
}
