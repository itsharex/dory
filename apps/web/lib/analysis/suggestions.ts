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
    const mapping: Record<
        string,
        {
            kind: AnalysisSuggestionKind;
            description: string;
            priority: number;
            goal: string;
            resultTitle: string;
            stepTemplates: AnalysisSuggestion['stepTemplates'];
        }
    > = {
        'view-time-trend': {
            kind: 'trend',
            description: 'Break the result down over time to validate whether the issue is concentrated in a period.',
            priority: 95,
            goal: 'Inspect change over time.',
            resultTitle: 'Time trend',
            stepTemplates: [
                { id: 'inspect-axis', title: '确认时间字段' },
                { id: 'bucket-series', title: '按时间聚合结果' },
                { id: 'summarize-trend', title: '生成趋势结论' },
            ],
        },
        'group-by-service': {
            kind: 'drilldown',
            description: 'Split the result by service or source to identify which segment contributes most to the issue.',
            priority: 92,
            goal: 'Locate the source of the anomaly.',
            resultTitle: 'Source breakdown',
            stepTemplates: [
                { id: 'pick-dimension', title: '识别来源字段' },
                { id: 'group-source', title: '按来源分组统计' },
                { id: 'summarize-source', title: '生成来源结论' },
            ],
        },
        'analyze-source': {
            kind: 'drilldown',
            description: 'Split the result by the most relevant dimension to identify the likely source.',
            priority: 91,
            goal: 'Find the segment behind the issue.',
            resultTitle: 'Source analysis',
            stepTemplates: [
                { id: 'pick-dimension', title: '识别关键维度' },
                { id: 'group-source', title: '执行来源拆解' },
                { id: 'summarize-source', title: '生成来源结论' },
            ],
        },
        'top-messages': {
            kind: 'topk',
            description: '找出出现最多的内容，先判断这次结果主要被哪类信息带动。',
            priority: 88,
            goal: '看看哪些文本出现得最多。',
            resultTitle: '高频内容',
            stepTemplates: [
                { id: 'pick-field', title: '识别文本字段' },
                { id: 'rank-values', title: '提取高频值' },
                { id: 'summarize-values', title: '生成高频值结论' },
            ],
        },
        'inspect-outliers': {
            kind: 'topk',
            description: 'Inspect the highest rows to understand what is producing extreme values.',
            priority: 94,
            goal: 'Locate anomalous rows.',
            resultTitle: 'Outlier samples',
            stepTemplates: [
                { id: 'find-peak', title: '查找最大值' },
                { id: 'extract-top', title: '提取 Top 20 行' },
                { id: 'summarize-outliers', title: '生成展示结果' },
            ],
        },
        'view-distribution': {
            kind: 'distribution',
            description: 'Quantify spread, tails, and concentration in the leading measure.',
            priority: 90,
            goal: 'Understand the distribution shape.',
            resultTitle: 'Distribution',
            stepTemplates: [
                { id: 'scan-distribution', title: '扫描分布区间' },
                { id: 'measure-tail', title: '识别长尾与峰值' },
                { id: 'summarize-distribution', title: '生成分布结论' },
            ],
        },
        'filter-outliers': {
            kind: 'compare',
            description: 'Filter the rows down to the anomalous subset for continued analysis.',
            priority: 76,
            goal: 'Focus on abnormal rows only.',
            resultTitle: 'Filtered anomaly set',
            stepTemplates: [
                { id: 'find-threshold', title: '确定异常阈值' },
                { id: 'filter-rows', title: '过滤异常数据' },
                { id: 'summarize-filtered', title: '生成过滤结果' },
            ],
        },
        'pattern-follow-up': {
            kind: 'compare',
            description: 'Follow up on the strongest detected pattern and compare the relevant segments.',
            priority: 80,
            goal: 'Continue investigating the strongest pattern.',
            resultTitle: 'Pattern follow-up',
            stepTemplates: [
                { id: 'inspect-pattern', title: '确认异常模式' },
                { id: 'compare-segments', title: '对比相关分组' },
                { id: 'summarize-pattern', title: '生成模式结论' },
            ],
        },
    };

    const fallback = mapping[action.id] ?? {
        kind: 'drilldown' as const,
        description: 'Continue drilling into the current result.',
        priority: 75,
        goal: 'Continue the current analysis.',
        resultTitle: 'Analysis result',
        stepTemplates: [
            { id: 'inspect-result', title: '检查当前结果' },
            { id: 'run-analysis', title: '执行分析查询' },
            { id: 'summarize-analysis', title: '生成分析结论' },
        ],
    };

    return {
        id: action.suggestionId,
        kind: fallback.kind,
        title: action.label,
        description: fallback.description,
        label: action.label,
        goal: fallback.goal,
        resultTitle: fallback.resultTitle,
        stepTemplates: fallback.stepTemplates,
        followupPolicy: 'chain',
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

export function buildAnalysisSuggestions(params: { resultContext: ResultContext; draft?: InsightDraft | null; recommendedActions?: InsightAction[] | null }): AnalysisSuggestion[] {
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
            id: 'view-time-trend',
            kind: 'trend',
            title: `Trend ${keyColumns.time} over time`,
            description: `Check whether the issue changes over ${keyColumns.time}.`,
            label: `查看时间趋势`,
            goal: 'Inspect change over time.',
            resultTitle: 'Time trend',
            stepTemplates: [
                { id: 'inspect-axis', title: '确认时间字段' },
                { id: 'bucket-series', title: '按时间聚合结果' },
                { id: 'summarize-trend', title: '生成趋势结论' },
            ],
            followupPolicy: 'chain',
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'view-time-trend',
                    timeColumn: keyColumns.time,
                },
            },
            priority: 95,
        });
    }

    if (serviceColumn && !suggestionExists(suggestions, 'group-by-service')) {
        suggestions.push({
            id: 'group-by-service',
            kind: 'drilldown',
            title: `Break down by ${serviceColumn}`,
            description: `Identify which ${serviceColumn} drives the issue most.`,
            label: `按 ${serviceColumn} 分组分析`,
            goal: 'Locate the source of the anomaly.',
            resultTitle: 'Source breakdown',
            stepTemplates: [
                { id: 'pick-dimension', title: '识别来源字段' },
                { id: 'group-source', title: '按来源分组统计' },
                { id: 'summarize-source', title: '生成来源结论' },
            ],
            followupPolicy: 'chain',
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'group-by-service',
                    dimensionColumn: serviceColumn,
                },
            },
            priority: 92,
        });
    }

    if (riskSignal && !suggestionExists(suggestions, 'analyze-source')) {
        suggestions.push({
            id: 'analyze-source',
            kind: 'drilldown',
            title: 'Analyze likely source',
            description: 'Identify which segment is most likely driving the issue.',
            label: '分析来源',
            goal: 'Find the segment behind the issue.',
            resultTitle: 'Source analysis',
            stepTemplates: [
                { id: 'pick-dimension', title: '识别关键维度' },
                { id: 'group-source', title: '执行来源拆解' },
                { id: 'summarize-source', title: '生成来源结论' },
            ],
            followupPolicy: 'chain',
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'analyze-source',
                },
            },
            priority: 89,
        });
    }

    if (messageColumn && !suggestionExists(suggestions, 'top-messages')) {
        suggestions.push({
            id: 'top-messages',
            kind: 'topk',
            title: `查看 ${messageColumn} 里出现最多的内容`,
            description: `找出出现最多的 ${messageColumn} 内容，先判断这次结果主要被哪类信息带动。`,
            label: '看哪些内容最多',
            goal: '看看哪些文本出现得最多。',
            resultTitle: '高频内容',
            stepTemplates: [
                { id: 'pick-field', title: '识别文本字段' },
                { id: 'rank-values', title: '提取高频值' },
                { id: 'summarize-values', title: '生成高频值结论' },
            ],
            followupPolicy: 'chain',
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
            id: 'view-distribution',
            kind: 'distribution',
            title: `Profile ${primaryMeasure} distribution`,
            description: `Find the highest values and quantify the long tail for ${primaryMeasure}.`,
            label: '查看分布',
            goal: 'Understand the distribution shape.',
            resultTitle: 'Distribution',
            stepTemplates: [
                { id: 'scan-distribution', title: '扫描分布区间' },
                { id: 'measure-tail', title: '识别长尾与峰值' },
                { id: 'summarize-distribution', title: '生成分布结论' },
            ],
            followupPolicy: 'chain',
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'view-distribution',
                    measureColumn: primaryMeasure,
                },
            },
            priority: 76,
        });
    }

    if (primaryMeasure && !suggestionExists(suggestions, 'inspect-outliers')) {
        suggestions.push({
            id: 'inspect-outliers',
            kind: 'topk',
            title: `Inspect outliers in ${primaryMeasure}`,
            description: `Review the highest rows for ${primaryMeasure}.`,
            label: '查看异常样本',
            goal: 'Locate anomalous rows.',
            resultTitle: 'Outlier samples',
            stepTemplates: [
                { id: 'find-peak', title: '查找最大值' },
                { id: 'extract-top', title: '提取 Top 20 行' },
                { id: 'summarize-outliers', title: '生成展示结果' },
            ],
            followupPolicy: 'chain',
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'inspect-outliers',
                    measureColumn: primaryMeasure,
                },
            },
            priority: 94,
        });
    }

    const dimensionColumn = keyColumns.dimensions.find(name => name !== serviceColumn && name !== messageColumn);
    if (dimensionColumn && primaryMeasure && !suggestionExists(suggestions, 'filter-outliers')) {
        suggestions.push({
            id: 'filter-outliers',
            kind: 'compare',
            title: `Filter high ${primaryMeasure} rows`,
            description: `Keep the abnormal rows and continue analyzing them by ${dimensionColumn}.`,
            label: '过滤异常数据',
            goal: 'Focus on abnormal rows only.',
            resultTitle: 'Filtered anomaly set',
            stepTemplates: [
                { id: 'find-threshold', title: '确定异常阈值' },
                { id: 'filter-rows', title: '过滤异常数据' },
                { id: 'summarize-filtered', title: '生成过滤结果' },
            ],
            followupPolicy: 'chain',
            intent: {
                type: 'generate_sql',
                payload: {
                    suggestionId: 'filter-outliers',
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
