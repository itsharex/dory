'use client';

import type { ActionIntent } from '@/lib/copilot/action/types';
import type { ResultColumnMeta, ResultSetStatsV1 } from './result-set-ai';

type InsightTranslate = (key: string, values?: Record<string, string | number>) => string;

type InsightMessageKey =
    | 'Insights.Messages.PrimaryCategory'
    | 'Insights.Messages.RiskCategory'
    | 'Insights.Messages.TopDimension'
    | 'Insights.Messages.TopMessage'
    | 'Insights.Messages.TimeTrend'
    | 'Insights.Messages.MeasureSpread'
    | 'Insights.Messages.HighCardinality';

export type InsightAction =
    | {
          id: 'time-error-trend' | 'service-error-breakdown' | 'top-messages';
          label: string;
          kind: 'copilot-prompt';
          prompt: string;
      }
    | {
          id: 'explain-result';
          label: string;
          kind: 'copilot-prompt';
          prompt: string;
      }
    | {
          id: 'fix-sql-error' | 'optimize-performance' | 'rewrite-sql' | 'to-aggregation';
          label: string;
          kind: 'quick-action';
          intent: ActionIntent;
      };

export type InsightViewModel = {
    quickSummary: {
        title: string;
        subtitle?: string;
    };
    insights: string[];
    keyColumns: {
        time?: string;
        measures: string[];
        dimensions: string[];
        identifiers: string[];
    };
    recommendedActions: InsightAction[];
};

export type InsightRuleContext = {
    stats?: ResultSetStatsV1 | null;
    columns?: ResultColumnMeta[] | null;
    sqlText?: string | null;
    locale: string;
    t: InsightTranslate;
};

const RISK_TERMS = new Set(['error', 'errors', 'failed', 'failure', 'warning', 'warn', 'timeout', 'fatal']);
const MESSAGE_NAME_HINTS = ['message', 'msg', 'description', 'event', 'title'];
const SERVICE_NAME_HINTS = ['service', 'source', 'component', 'app', 'application'];
const LEVEL_NAME_HINTS = ['level', 'status', 'severity', 'state'];

function formatNumber(locale: string, value?: number | null) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
    }

    return value.toLocaleString(locale);
}

function formatPercent(locale: string, ratio?: number | null, digits = 0) {
    if (typeof ratio !== 'number' || !Number.isFinite(ratio)) {
        return '—';
    }

    return new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: digits,
    }).format(ratio);
}

function labelForKind(kind: ResultSetStatsV1['summary']['kind'], t: InsightTranslate) {
    switch (kind) {
        case 'single_value':
            return t('Insights.Kinds.SingleValue');
        case 'time_series':
            return t('Insights.Kinds.TimeSeries');
        case 'aggregated_table':
            return t('Insights.Kinds.AggregatedTable');
        case 'detail_table':
            return t('Insights.Kinds.DetailTable');
        default:
            return t('Insights.Kinds.Unknown');
    }
}

function labelForChart(chart: ResultSetStatsV1['summary']['recommendedChart'], t: InsightTranslate) {
    switch (chart) {
        case 'table':
            return t('Insights.Charts.Table');
        case 'bar':
            return t('Insights.Charts.Bar');
        case 'line':
            return t('Insights.Charts.Line');
        case 'pie':
            return t('Insights.Charts.Pie');
        case 'metric':
            return t('Insights.Charts.Metric');
        case 'scatter':
            return t('Insights.Charts.Scatter');
        default:
            return t('Insights.Charts.Unknown');
    }
}

function buildQuickSummary(context: InsightRuleContext, keyColumns: InsightViewModel['keyColumns']) {
    const { stats, columns, locale, t } = context;
    const summary = stats?.summary;
    const rowCount = summary?.rowCount ?? null;
    const columnCount = summary?.columnCount ?? columns?.length ?? 0;
    const kindLabel = labelForKind(summary?.kind ?? 'unknown', t);
    const chartStatus = summary?.isGoodForChart ? t('Insights.QuickSummary.ChartReady') : t('Insights.QuickSummary.ExplorationReady');

    const title = t('Insights.QuickSummary.Title', {
        kind: kindLabel,
        rows: formatNumber(locale, rowCount),
        columns: formatNumber(locale, columnCount),
        chartStatus,
    });

    const timeColumn = summary?.primaryTimeColumn ?? keyColumns.time;
    const timeProfile = timeColumn ? stats?.columns?.[timeColumn] : null;
    const timeDetail = timeColumn
        ? t('Insights.QuickSummary.TimeDetail', {
              column: timeColumn,
              grain: timeProfile?.inferredTimeGrain
                  ? t('Insights.TimeGrain.Detail', {
                        grain: t(`Insights.TimeGrain.${timeProfile.inferredTimeGrain}`),
                    })
                  : t('Insights.TimeGrain.EventLevel'),
          })
        : t('Insights.QuickSummary.ChartHint', {
              chart: labelForChart(summary?.recommendedChart ?? null, t),
          });

    return {
        title,
        subtitle: timeDetail,
    };
}

function looksLike(name: string, hints: string[]) {
    const lower = name.trim().toLowerCase();
    return hints.some(hint => lower === hint || lower.includes(hint));
}

function findInterestingDimension(stats: ResultSetStatsV1 | null | undefined, columns: ResultColumnMeta[] | null | undefined) {
    const candidates = (columns ?? []).filter(column => column.semanticRole === 'dimension' || column.semanticRole === 'text');

    const scored = candidates
        .map(column => {
            const profile = stats?.columns?.[column.name];
            const top = profile?.topK?.[0];
            const distinctCount = profile?.distinctCount ?? Number.MAX_SAFE_INTEGER;
            const topCount = top?.count ?? 0;
            const name = column.name.toLowerCase();
            const priorityBoost = (looksLike(name, LEVEL_NAME_HINTS) ? 20 : 0) + (looksLike(name, SERVICE_NAME_HINTS) ? 12 : 0) + (looksLike(name, MESSAGE_NAME_HINTS) ? 8 : 0);

            return {
                column,
                profile,
                score: priorityBoost + topCount - Math.min(distinctCount, 100),
            };
        })
        .sort((left, right) => right.score - left.score);

    return scored[0] ?? null;
}

function maybePushInsight(target: string[], next?: string | null) {
    if (!next) return;
    if (target.includes(next)) return;
    target.push(next);
}

function buildInsightsList(context: InsightRuleContext, keyColumns: InsightViewModel['keyColumns']) {
    const { stats, columns, locale, t } = context;
    const insights: string[] = [];
    const profiles = stats?.columns ?? {};
    const rowCount = stats?.summary.rowCount ?? null;

    const interestingDimension = findInterestingDimension(stats, columns);
    const dimensionTop = interestingDimension?.profile?.topK?.[0];

    if (interestingDimension?.profile?.topK && dimensionTop && rowCount && rowCount > 0) {
        maybePushInsight(
            insights,
            t('Insights.Messages.PrimaryCategory', {
                column: interestingDimension.column.name,
                value: dimensionTop.value,
                share: formatPercent(locale, dimensionTop.count / rowCount),
            }),
        );
    }

    const riskProfile = Object.values(profiles).find(profile => {
        if (!profile.topK?.length || (profile.distinctCount ?? Number.MAX_SAFE_INTEGER) > 12) {
            return false;
        }

        return profile.topK.some(item => RISK_TERMS.has(String(item.value).trim().toLowerCase()));
    });

    if (riskProfile?.topK && rowCount && rowCount > 0) {
        const risky = riskProfile.topK.find(item => RISK_TERMS.has(String(item.value).trim().toLowerCase()));
        const ratio = risky ? risky.count / rowCount : 0;
        if (risky && ratio >= 0.1) {
            maybePushInsight(
                insights,
                t('Insights.Messages.RiskCategory', {
                    value: risky.value,
                    share: formatPercent(locale, ratio),
                    column: riskProfile.name,
                }),
            );
        }
    }

    const topDimension = (columns ?? [])
        .filter(column => column.semanticRole === 'dimension')
        .map(column => ({
            column,
            profile: profiles[column.name],
        }))
        .find(entry => entry.profile?.topK?.[0] && (entry.profile.distinctCount ?? Number.MAX_SAFE_INTEGER) <= 50);

    if (topDimension?.profile?.topK?.[0]) {
        maybePushInsight(
            insights,
            t('Insights.Messages.TopDimension', {
                column: topDimension.column.name,
                value: topDimension.profile.topK[0].value,
                count: formatNumber(locale, topDimension.profile.topK[0].count),
            }),
        );
    }

    const messageColumn = (columns ?? []).find(column => looksLike(column.name, MESSAGE_NAME_HINTS));
    const messageTop = messageColumn ? profiles[messageColumn.name]?.topK?.[0] : null;
    if (messageColumn && messageTop) {
        maybePushInsight(
            insights,
            t('Insights.Messages.TopMessage', {
                value: messageTop.value,
                count: formatNumber(locale, messageTop.count),
            }),
        );
    }

    if (keyColumns.time) {
        maybePushInsight(
            insights,
            t('Insights.Messages.TimeTrend', {
                column: keyColumns.time,
            }),
        );
    }

    const measureColumn = keyColumns.measures
        .map(name => profiles[name])
        .find(profile => profile && typeof profile.p95 === 'number' && typeof profile.p50 === 'number' && profile.p95 > profile.p50);

    if (measureColumn && typeof measureColumn.p50 === 'number' && typeof measureColumn.p95 === 'number') {
        maybePushInsight(
            insights,
            t('Insights.Messages.MeasureSpread', {
                column: measureColumn.name,
                p50: formatNumber(locale, measureColumn.p50),
                p95: formatNumber(locale, measureColumn.p95),
            }),
        );
    }

    const highCardinality = (columns ?? []).find(column => profiles[column.name]?.isHighCardinality && column.semanticRole === 'dimension');
    if (insights.length < 3 && highCardinality) {
        maybePushInsight(
            insights,
            t('Insights.Messages.HighCardinality', {
                column: highCardinality.name,
            }),
        );
    }

    return insights.slice(0, 5);
}

function buildKeyColumns(columns: ResultColumnMeta[] | null | undefined, stats: ResultSetStatsV1 | null | undefined): InsightViewModel['keyColumns'] {
    const profiledColumns = columns ?? [];
    const timeColumn = stats?.summary.primaryTimeColumn ?? profiledColumns.find(column => column.semanticRole === 'time')?.name;

    return {
        time: timeColumn ?? undefined,
        measures: profiledColumns.filter(column => column.semanticRole === 'measure').map(column => column.name),
        dimensions: profiledColumns.filter(column => column.semanticRole === 'dimension' || column.semanticRole === 'text').map(column => column.name),
        identifiers: profiledColumns.filter(column => column.semanticRole === 'identifier').map(column => column.name),
    };
}

function buildRecommendedActions(context: InsightRuleContext, keyColumns: InsightViewModel['keyColumns']) {
    const { t, sqlText } = context;
    const actions: InsightAction[] = [];
    const serviceColumn = keyColumns.dimensions.find(name => looksLike(name, SERVICE_NAME_HINTS));
    const messageColumn = keyColumns.dimensions.find(name => looksLike(name, MESSAGE_NAME_HINTS));

    if (keyColumns.time) {
        actions.push({
            id: 'time-error-trend',
            label: t('Insights.Actions.TimeErrorTrend'),
            kind: 'copilot-prompt',
            prompt: t('Insights.ActionPrompts.TimeErrorTrend', {
                timeColumn: keyColumns.time,
                sql: sqlText?.trim() || t('Insights.ActionPrompts.CurrentResult'),
            }),
        });
    }

    if (serviceColumn) {
        actions.push({
            id: 'service-error-breakdown',
            label: t('Insights.Actions.ServiceErrorBreakdown'),
            kind: 'copilot-prompt',
            prompt: t('Insights.ActionPrompts.ServiceErrorBreakdown', {
                serviceColumn,
                sql: sqlText?.trim() || t('Insights.ActionPrompts.CurrentResult'),
            }),
        });
    }

    if (messageColumn) {
        actions.push({
            id: 'top-messages',
            label: t('Insights.Actions.TopMessages'),
            kind: 'copilot-prompt',
            prompt: t('Insights.ActionPrompts.TopMessages', {
                messageColumn,
                sql: sqlText?.trim() || t('Insights.ActionPrompts.CurrentResult'),
            }),
        });
    }

    actions.push({
        id: 'explain-result',
        label: t('Insights.Actions.ExplainResult'),
        kind: 'copilot-prompt',
        prompt: t('Insights.ActionPrompts.ExplainResult', {
            sql: sqlText?.trim() || t('Insights.ActionPrompts.CurrentResult'),
        }),
    });

    return actions.slice(0, 4);
}

export function buildInsights(context: InsightRuleContext): InsightViewModel {
    const keyColumns = buildKeyColumns(context.columns, context.stats);

    return {
        quickSummary: buildQuickSummary(context, keyColumns),
        insights: buildInsightsList(context, keyColumns),
        keyColumns,
        recommendedActions: buildRecommendedActions(context, keyColumns),
    };
}
