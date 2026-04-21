import type { ActionIntent } from '@/lib/copilot/action/types';
import type { ResultColumnMeta, ResultSetStatsV1 } from './result-set-ai';

type InsightTranslate = (key: string, values?: Record<string, string | number>) => string;

export type InsightFactType =
    | 'dataset_shape'
    | 'distribution'
    | 'dominant_category'
    | 'risk_signal'
    | 'top_dimension'
    | 'top_message'
    | 'measure_spread'
    | 'trend_candidate'
    | 'outlier_candidate'
    | 'correlation_candidate';

export type InsightFact = {
    id: string;
    type: InsightFactType;
    title?: string;
    severity?: 'info' | 'warning' | 'risk';
    confidence: number;
    columns?: string[];
    metrics?: Record<string, number | string>;
    narrativeHint?: string;
};

export type InsightPattern = {
    id: string;
    kind: 'spike' | 'drop' | 'outlier' | 'correlation' | 'segment_shift';
    confidence: number;
    columns: string[];
    summary: string;
    metrics: Record<string, number | string>;
};

export type InsightAction =
    | {
          id:
              | 'inspect-outliers'
              | 'analyze-source'
              | 'view-distribution'
              | 'group-by-service'
              | 'view-time-trend'
              | 'filter-outliers'
              | 'top-messages'
              | 'pattern-follow-up';
          label: string;
          kind: 'analysis-suggestion';
          suggestionId:
              | 'inspect-outliers'
              | 'analyze-source'
              | 'view-distribution'
              | 'group-by-service'
              | 'view-time-trend'
              | 'filter-outliers'
              | 'top-messages'
              | 'pattern-follow-up';
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

export type InsightKeyColumns = {
    time?: string;
    measures: string[];
    dimensions: string[];
    identifiers: string[];
};

export type InsightDraft = {
    quickSummary: {
        title: string;
        subtitle?: string;
    };
    facts: InsightFact[];
    patterns: InsightPattern[];
    keyColumns: InsightKeyColumns;
    recommendedActions: InsightAction[];
};

export type InsightViewModel = {
    quickSummary: {
        title: string;
        subtitle?: string;
    };
    insights: string[];
    keyColumns: InsightKeyColumns;
    recommendedActions: InsightAction[];
    source: 'rules' | 'llm';
    advancedPatterns?: InsightPattern[];
};

export type InsightStructuredSignal = InsightFact | InsightPattern;

export type InsightStructuredFinding = {
    id: string;
    title: string;
    summary: string;
    severity: 'info' | 'warning' | 'critical';
    confidence: 'high' | 'medium' | 'low';
};

export type StructuredInsightView = {
    card: {
        headline: string;
        summaryLines: string[];
    };
    signals: InsightStructuredSignal[];
    findings: InsightStructuredFinding[];
    narrative: string;
    recommendedActions: InsightAction[];
};

export type InsightRewriteRequest = {
    locale: string;
    sqlText?: string | null;
    summary: ResultSetStatsV1['summary'];
    keyColumns: InsightKeyColumns;
    facts: InsightFact[];
    patterns: InsightPattern[];
    sampleRows?: Array<Record<string, unknown>>;
};

export type InsightRewriteResponse = {
    quickSummary: {
        title: string;
        subtitle?: string;
    };
    insights: string[];
    reasoning?: {
        priorities: string[];
    };
};

export type InsightRuleContext = {
    stats?: ResultSetStatsV1 | null;
    columns?: ResultColumnMeta[] | null;
    sqlText?: string | null;
    rows?: Array<Record<string, unknown>> | null;
    locale: string;
    t: InsightTranslate;
};

const RISK_TERMS = new Set(['error', 'errors', 'failed', 'failure', 'warning', 'warn', 'timeout', 'fatal']);
const MESSAGE_NAME_HINTS = ['message', 'msg', 'description', 'event', 'title'];
const SERVICE_NAME_HINTS = ['service', 'source', 'component', 'app', 'application'];
const LEVEL_NAME_HINTS = ['level', 'status', 'severity', 'state'];
const MAX_PATTERN_ROWS = 2000;

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

function looksLike(name: string, hints: string[]) {
    const lower = name.trim().toLowerCase();
    return hints.some(hint => lower === hint || lower.includes(hint));
}

function toNumericValue(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function toTimestamp(value: unknown) {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return value.getTime();
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isFinite(parsed.getTime()) ? parsed.getTime() : null;
    }

    return null;
}

function median(values: number[]) {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1]! + sorted[middle]!) / 2;
    }
    return sorted[middle]!;
}

function quantile(values: number[], q: number) {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const position = (sorted.length - 1) * q;
    const base = Math.floor(position);
    const rest = position - base;
    const current = sorted[base]!;
    const next = sorted[base + 1] ?? current;
    return current + rest * (next - current);
}

function pearsonCorrelation(points: Array<{ x: number; y: number }>) {
    if (points.length < 5) return null;

    const n = points.length;
    const sumX = points.reduce((total, point) => total + point.x, 0);
    const sumY = points.reduce((total, point) => total + point.y, 0);
    const sumXY = points.reduce((total, point) => total + point.x * point.y, 0);
    const sumX2 = points.reduce((total, point) => total + point.x * point.x, 0);
    const sumY2 = points.reduce((total, point) => total + point.y * point.y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (!Number.isFinite(denominator) || denominator === 0) {
        return null;
    }

    return numerator / denominator;
}

function sampleRows(rows?: Array<Record<string, unknown>> | null) {
    return (rows ?? []).slice(0, MAX_PATTERN_ROWS);
}

export function buildKeyColumns(columns: ResultColumnMeta[] | null | undefined, stats: ResultSetStatsV1 | null | undefined): InsightKeyColumns {
    const profiledColumns = columns ?? [];
    const timeColumn = stats?.summary.primaryTimeColumn ?? profiledColumns.find(column => column.semanticRole === 'time')?.name;

    return {
        time: timeColumn ?? undefined,
        measures: profiledColumns.filter(column => column.semanticRole === 'measure').map(column => column.name),
        dimensions: profiledColumns.filter(column => column.semanticRole === 'dimension' || column.semanticRole === 'text').map(column => column.name),
        identifiers: profiledColumns.filter(column => column.semanticRole === 'identifier').map(column => column.name),
    };
}

function buildQuickSummary(context: InsightRuleContext, keyColumns: InsightKeyColumns) {
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
    const subtitle = timeColumn
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
        subtitle,
    };
}

function findInterestingDimension(stats: ResultSetStatsV1 | null | undefined, columns: ResultColumnMeta[] | null | undefined) {
    const candidates = (columns ?? []).filter(column => column.semanticRole === 'dimension' || column.semanticRole === 'text');

    return candidates
        .map(column => {
            const profile = stats?.columns?.[column.name];
            const top = profile?.topK?.[0];
            const distinctCount = profile?.distinctCount ?? Number.MAX_SAFE_INTEGER;
            const name = column.name.toLowerCase();
            const priorityBoost = (looksLike(name, LEVEL_NAME_HINTS) ? 20 : 0) + (looksLike(name, SERVICE_NAME_HINTS) ? 12 : 0) + (looksLike(name, MESSAGE_NAME_HINTS) ? 8 : 0);

            return {
                column,
                profile,
                score: priorityBoost + (top?.count ?? 0) - Math.min(distinctCount, 100),
            };
        })
        .sort((left, right) => right.score - left.score)[0];
}

export function buildInsightFacts(context: InsightRuleContext): InsightFact[] {
    const { stats, columns, rows } = context;
    const facts: InsightFact[] = [];
    const summary = stats?.summary;
    const rowCount = summary?.rowCount ?? rows?.length ?? 0;
    const profiles = stats?.columns ?? {};

    if (summary) {
        facts.push({
            id: 'dataset-shape',
            type: 'dataset_shape',
            severity: 'info',
            confidence: 1,
            metrics: {
                kind: summary.kind,
                rowCount: summary.rowCount ?? 0,
                columnCount: summary.columnCount,
                recommendedChart: summary.recommendedChart ?? 'table',
            },
        });
    }

    const interestingDimension = findInterestingDimension(stats, columns);
    const dimensionTop = interestingDimension?.profile?.topK?.[0];
    if (interestingDimension && dimensionTop && rowCount > 0) {
        facts.push({
            id: `dominant:${interestingDimension.column.name}:${dimensionTop.value}`,
            type: 'dominant_category',
            severity: 'info',
            confidence: 0.9,
            columns: [interestingDimension.column.name],
            metrics: {
                value: dimensionTop.value,
                count: dimensionTop.count,
                share: dimensionTop.count / rowCount,
            },
            narrativeHint: 'Most rows cluster around a single dominant category.',
        });
    }

    const riskProfile = Object.values(profiles).find(profile => {
        if (!profile.topK?.length || (profile.distinctCount ?? Number.MAX_SAFE_INTEGER) > 12) {
            return false;
        }
        return profile.topK.some(item => RISK_TERMS.has(String(item.value).trim().toLowerCase()));
    });

    if (riskProfile?.topK && rowCount > 0) {
        const risky = riskProfile.topK.find(item => RISK_TERMS.has(String(item.value).trim().toLowerCase()));
        const share = risky ? risky.count / rowCount : 0;
        if (risky && share >= 0.1) {
            facts.push({
                id: `risk:${riskProfile.name}:${risky.value}`,
                type: 'risk_signal',
                severity: 'risk',
                confidence: Math.min(0.95, 0.5 + share),
                columns: [riskProfile.name],
                metrics: {
                    value: risky.value,
                    count: risky.count,
                    share,
                },
                narrativeHint: 'A risk-heavy category stands out and likely deserves investigation first.',
            });
        }
    }

    const topDimension = (columns ?? [])
        .filter(column => column.semanticRole === 'dimension')
        .map(column => ({ column, profile: profiles[column.name] }))
        .find(entry => entry.profile?.topK?.[0] && (entry.profile.distinctCount ?? Number.MAX_SAFE_INTEGER) <= 50);
    if (topDimension?.profile?.topK?.[0]) {
        const top = topDimension.profile.topK[0];
        facts.push({
            id: `top-dimension:${topDimension.column.name}:${top.value}`,
            type: 'top_dimension',
            severity: 'info',
            confidence: 0.82,
            columns: [topDimension.column.name],
            metrics: {
                value: top.value,
                count: top.count,
            },
            narrativeHint: 'One dimension value is noticeably more active than the rest.',
        });
    }

    const messageColumn = (columns ?? []).find(column => looksLike(column.name, MESSAGE_NAME_HINTS));
    const messageTop = messageColumn ? profiles[messageColumn.name]?.topK?.[0] : null;
    if (messageColumn && messageTop) {
        facts.push({
            id: `top-message:${messageColumn.name}:${messageTop.value}`,
            type: 'top_message',
            severity: 'info',
            confidence: 0.8,
            columns: [messageColumn.name],
            metrics: {
                value: messageTop.value,
                count: messageTop.count,
            },
            narrativeHint: 'A repeated text pattern can summarize a large share of the result.',
        });
    }

    const keyColumns = buildKeyColumns(columns, stats);
    if (keyColumns.time) {
        facts.push({
            id: `trend:${keyColumns.time}`,
            type: 'trend_candidate',
            severity: 'info',
            confidence: 0.85,
            columns: [keyColumns.time],
            metrics: {
                timeColumn: keyColumns.time,
            },
            narrativeHint: 'The result is suitable for time trend analysis.',
        });
    }

    const spreadMeasure = keyColumns.measures
        .map(name => profiles[name])
        .find(profile => profile && typeof profile.p50 === 'number' && typeof profile.p95 === 'number' && profile.p95 > profile.p50);
    if (spreadMeasure && typeof spreadMeasure.p50 === 'number' && typeof spreadMeasure.p95 === 'number') {
        facts.push({
            id: `measure-spread:${spreadMeasure.name}`,
            type: 'measure_spread',
            severity: 'warning',
            confidence: 0.78,
            columns: [spreadMeasure.name],
            metrics: {
                p50: spreadMeasure.p50,
                p95: spreadMeasure.p95,
            },
            narrativeHint: 'The measure has visible spread and likely includes tail behavior.',
        });
    }

    return facts;
}

export function detectAdvancedPatterns(context: InsightRuleContext): InsightPattern[] {
    const { rows, stats, columns } = context;
    const sampled = sampleRows(rows);
    const patterns: InsightPattern[] = [];
    const keyColumns = buildKeyColumns(columns, stats);

    if (sampled.length < 5) {
        return patterns;
    }

    if (keyColumns.time) {
        const measure = keyColumns.measures[0];
        if (measure) {
            const buckets = new Map<string, number>();
            for (const row of sampled) {
                const timeValue = toTimestamp(row[keyColumns.time]);
                const measureValue = toNumericValue(row[measure]);
                if (timeValue == null || measureValue == null) continue;
                const bucket = new Date(timeValue).toISOString().slice(0, 13);
                buckets.set(bucket, (buckets.get(bucket) ?? 0) + measureValue);
            }

            const series = [...buckets.entries()].map(([bucket, value]) => ({ bucket, value })).sort((left, right) => left.bucket.localeCompare(right.bucket));
            const values = series.map(item => item.value);
            const center = median(values);
            const q1 = quantile(values, 0.25);
            const q3 = quantile(values, 0.75);
            const iqr = q1 != null && q3 != null ? q3 - q1 : null;

            if (series.length >= 5 && center != null && iqr != null && iqr > 0) {
                const spike = series.find(item => item.value > (q3 ?? center) + 1.5 * iqr);
                if (spike) {
                    patterns.push({
                        id: `spike:${measure}:${spike.bucket}`,
                        kind: 'spike',
                        confidence: 0.84,
                        columns: [keyColumns.time, measure],
                        summary: 'A time bucket spikes above the recent baseline.',
                        metrics: {
                            bucket: spike.bucket,
                            value: spike.value,
                            baseline: center,
                        },
                    });
                }

                const drop = series.find(item => item.value < (q1 ?? center) - 1.5 * iqr);
                if (drop) {
                    patterns.push({
                        id: `drop:${measure}:${drop.bucket}`,
                        kind: 'drop',
                        confidence: 0.73,
                        columns: [keyColumns.time, measure],
                        summary: 'A time bucket drops below the recent baseline.',
                        metrics: {
                            bucket: drop.bucket,
                            value: drop.value,
                            baseline: center,
                        },
                    });
                }
            }
        }
    }

    for (const measure of keyColumns.measures.slice(0, 2)) {
        const numericValues = sampled.map(row => toNumericValue(row[measure])).filter((value): value is number => value != null);
        const q1 = quantile(numericValues, 0.25);
        const q3 = quantile(numericValues, 0.75);
        const iqr = q1 != null && q3 != null ? q3 - q1 : null;
        if (numericValues.length >= 8 && q3 != null && iqr != null && iqr > 0) {
            const outlier = numericValues.find(value => value > q3 + 1.5 * iqr);
            if (outlier != null) {
                patterns.push({
                    id: `outlier:${measure}`,
                    kind: 'outlier',
                    confidence: 0.77,
                    columns: [measure],
                    summary: 'A measure contains extreme high values compared with the rest of the sample.',
                    metrics: {
                        value: outlier,
                        q3,
                        iqr,
                    },
                });
            }
        }
    }

    if (keyColumns.measures.length >= 2) {
        const [leftMeasure, rightMeasure] = keyColumns.measures;
        if (leftMeasure && rightMeasure) {
            const points = sampled
                .map(row => ({
                    x: toNumericValue(row[leftMeasure]),
                    y: toNumericValue(row[rightMeasure]),
                }))
                .filter((point): point is { x: number; y: number } => point.x != null && point.y != null);

            const correlation = pearsonCorrelation(points);
            if (correlation != null && Math.abs(correlation) >= 0.6) {
                patterns.push({
                    id: `correlation:${leftMeasure}:${rightMeasure}`,
                    kind: 'correlation',
                    confidence: Math.min(0.9, Math.abs(correlation)),
                    columns: [leftMeasure, rightMeasure],
                    summary: 'Two measures tend to move together across the sampled rows.',
                    metrics: {
                        correlation,
                    },
                });
            }
        }
    }

    return patterns.slice(0, 4);
}

function actionFromPattern(context: InsightRuleContext, pattern: InsightPattern): InsightAction {
    const { t } = context;
    return {
        id: 'pattern-follow-up',
        label: t('Insights.Actions.PatternFollowUp'),
        kind: 'analysis-suggestion',
        suggestionId: 'pattern-follow-up',
    };
}

function buildRecommendedActions(context: InsightRuleContext, keyColumns: InsightKeyColumns, facts: InsightFact[], patterns: InsightPattern[]): InsightAction[] {
    const { t, sqlText } = context;
    const actions: InsightAction[] = [];
    const serviceColumn = keyColumns.dimensions.find(name => looksLike(name, SERVICE_NAME_HINTS));
    const messageColumn = keyColumns.dimensions.find(name => looksLike(name, MESSAGE_NAME_HINTS));
    const primaryMeasure = keyColumns.measures[0];
    const hasRiskSignal = facts.some(fact => fact.type === 'risk_signal');
    const hasOutlier = patterns.some(pattern => pattern.kind === 'outlier');
    const hasTimePattern = patterns.some(pattern => pattern.kind === 'spike' || pattern.kind === 'drop');

    if (patterns[0]) {
        actions.push(actionFromPattern(context, patterns[0]));
    }

    if (primaryMeasure && (hasOutlier || facts.some(fact => fact.type === 'measure_spread'))) {
        actions.push({
            id: 'inspect-outliers',
            label: t('Insights.Actions.InspectOutliers'),
            kind: 'analysis-suggestion',
            suggestionId: 'inspect-outliers',
        });
    }

    if (serviceColumn) {
        actions.push({
            id: 'group-by-service',
            label: t('Insights.Actions.GroupByService', {
                column: serviceColumn,
            }),
            kind: 'analysis-suggestion',
            suggestionId: 'group-by-service',
        });
    }

    if (serviceColumn || hasRiskSignal) {
        actions.push({
            id: 'analyze-source',
            label: t('Insights.Actions.AnalyzeSource'),
            kind: 'analysis-suggestion',
            suggestionId: 'analyze-source',
        });
    }

    if (primaryMeasure) {
        actions.push({
            id: 'view-distribution',
            label: t('Insights.Actions.ViewDistribution'),
            kind: 'analysis-suggestion',
            suggestionId: 'view-distribution',
        });
    }

    if (keyColumns.time && (hasRiskSignal || hasTimePattern || !!primaryMeasure)) {
        actions.push({
            id: 'view-time-trend',
            label: t('Insights.Actions.ViewTimeTrend'),
            kind: 'analysis-suggestion',
            suggestionId: 'view-time-trend',
        });
    }

    if (primaryMeasure) {
        actions.push({
            id: 'filter-outliers',
            label: t('Insights.Actions.FilterOutliers'),
            kind: 'analysis-suggestion',
            suggestionId: 'filter-outliers',
        });
    }

    if (messageColumn) {
        actions.push({
            id: 'top-messages',
            label: t('Insights.Actions.TopMessages'),
            kind: 'analysis-suggestion',
            suggestionId: 'top-messages',
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

    const deduped = actions.filter((action, index) => actions.findIndex(candidate => candidate.id === action.id) === index);
    return deduped.slice(0, 6);
}

function factToInsight(context: InsightRuleContext, fact: InsightFact) {
    const { locale, t } = context;
    switch (fact.type) {
        case 'dominant_category':
            return t('Insights.Messages.PrimaryCategory', {
                column: String(fact.columns?.[0] ?? ''),
                value: String(fact.metrics?.value ?? ''),
                share: formatPercent(locale, typeof fact.metrics?.share === 'number' ? fact.metrics.share : null),
            });
        case 'risk_signal':
            return t('Insights.Messages.RiskCategory', {
                value: String(fact.metrics?.value ?? ''),
                share: formatPercent(locale, typeof fact.metrics?.share === 'number' ? fact.metrics.share : null),
                column: String(fact.columns?.[0] ?? ''),
            });
        case 'top_dimension':
            return t('Insights.Messages.TopDimension', {
                column: String(fact.columns?.[0] ?? ''),
                value: String(fact.metrics?.value ?? ''),
                count: formatNumber(locale, typeof fact.metrics?.count === 'number' ? fact.metrics.count : null),
            });
        case 'top_message':
            return t('Insights.Messages.TopMessage', {
                value: String(fact.metrics?.value ?? ''),
                count: formatNumber(locale, typeof fact.metrics?.count === 'number' ? fact.metrics.count : null),
            });
        case 'trend_candidate':
            return t('Insights.Messages.TimeTrend', {
                column: String(fact.columns?.[0] ?? ''),
            });
        case 'measure_spread':
            return t('Insights.Messages.MeasureSpread', {
                column: String(fact.columns?.[0] ?? ''),
                p50: formatNumber(locale, typeof fact.metrics?.p50 === 'number' ? fact.metrics.p50 : null),
                p95: formatNumber(locale, typeof fact.metrics?.p95 === 'number' ? fact.metrics.p95 : null),
            });
        default:
            return null;
    }
}

function patternToInsight(context: InsightRuleContext, pattern: InsightPattern) {
    const { locale, t } = context;
    switch (pattern.kind) {
        case 'spike':
            return t('Insights.Messages.SpikePattern', {
                bucket: String(pattern.metrics.bucket ?? ''),
                value: formatNumber(locale, typeof pattern.metrics.value === 'number' ? pattern.metrics.value : null),
                baseline: formatNumber(locale, typeof pattern.metrics.baseline === 'number' ? pattern.metrics.baseline : null),
            });
        case 'drop':
            return t('Insights.Messages.DropPattern', {
                bucket: String(pattern.metrics.bucket ?? ''),
                value: formatNumber(locale, typeof pattern.metrics.value === 'number' ? pattern.metrics.value : null),
                baseline: formatNumber(locale, typeof pattern.metrics.baseline === 'number' ? pattern.metrics.baseline : null),
            });
        case 'outlier':
            return t('Insights.Messages.OutlierPattern', {
                column: String(pattern.columns[0] ?? ''),
                value: formatNumber(locale, typeof pattern.metrics.value === 'number' ? pattern.metrics.value : null),
            });
        case 'correlation':
            return t('Insights.Messages.CorrelationPattern', {
                left: String(pattern.columns[0] ?? ''),
                right: String(pattern.columns[1] ?? ''),
                correlation: typeof pattern.metrics.correlation === 'number' ? pattern.metrics.correlation.toFixed(2) : '—',
            });
        default:
            return null;
    }
}

export function buildInsightDraft(context: InsightRuleContext): InsightDraft {
    const keyColumns = buildKeyColumns(context.columns, context.stats);
    const facts = buildInsightFacts(context);
    const patterns = detectAdvancedPatterns(context);
    const recommendedActions = buildRecommendedActions(context, keyColumns, facts, patterns);

    return {
        quickSummary: buildQuickSummary(context, keyColumns),
        facts,
        patterns,
        keyColumns,
        recommendedActions,
    };
}

export function buildInsights(context: InsightRuleContext, rewritten?: InsightRewriteResponse | null): InsightViewModel {
    const draft = buildInsightDraft(context);

    if (rewritten?.insights?.length) {
        return {
            quickSummary: rewritten.quickSummary ?? draft.quickSummary,
            insights: rewritten.insights.slice(0, 5),
            keyColumns: draft.keyColumns,
            recommendedActions: draft.recommendedActions,
            source: 'llm',
            advancedPatterns: draft.patterns,
        };
    }

    const insightSet: string[] = [];
    for (const pattern of draft.patterns) {
        const insight = patternToInsight(context, pattern);
        if (insight && !insightSet.includes(insight)) insightSet.push(insight);
    }
    for (const fact of draft.facts) {
        const insight = factToInsight(context, fact);
        if (insight && !insightSet.includes(insight)) insightSet.push(insight);
    }

    return {
        quickSummary: draft.quickSummary,
        insights: insightSet.slice(0, 5),
        keyColumns: draft.keyColumns,
        recommendedActions: draft.recommendedActions,
        source: 'rules',
        advancedPatterns: draft.patterns,
    };
}

export function buildInsightRewriteRequest(context: InsightRuleContext): InsightRewriteRequest | null {
    if (!context.stats?.summary) {
        return null;
    }

    const draft = buildInsightDraft(context);

    return {
        locale: context.locale,
        sqlText: context.sqlText ?? null,
        summary: context.stats.summary,
        keyColumns: draft.keyColumns,
        facts: draft.facts,
        patterns: draft.patterns,
        sampleRows: sampleRows(context.rows).slice(0, 30),
    };
}

function confidenceBucket(value: number): 'high' | 'medium' | 'low' {
    if (value >= 0.8) return 'high';
    if (value >= 0.55) return 'medium';
    return 'low';
}

function findingSeverity(source: InsightFact | InsightPattern): 'info' | 'warning' | 'critical' {
    if ('severity' in source) {
        if (source.severity === 'risk') return 'critical';
        if (source.severity === 'warning') return 'warning';
        return 'info';
    }

    if ('kind' in source && (source.kind === 'spike' || source.kind === 'outlier')) return 'warning';
    return 'info';
}

function buildInsightCard(params: { context: InsightRuleContext; draft: InsightDraft; view: InsightViewModel; findings: InsightStructuredFinding[] }) {
    const { context, draft, findings } = params;
    const { locale, t } = context;
    const primaryMeasure = draft.keyColumns.measures[0];
    const outlierPattern = draft.patterns.find(pattern => pattern.kind === 'outlier');
    const spreadFact = draft.facts.find(fact => fact.type === 'measure_spread');
    const riskFact = draft.facts.find(fact => fact.type === 'risk_signal');
    const topDimensionFact = draft.facts.find(fact => fact.type === 'top_dimension' || fact.type === 'dominant_category');

    if (primaryMeasure && (outlierPattern || spreadFact)) {
        const headline = t('Insights.Card.OutlierHeadline', {
            column: primaryMeasure,
        });
        const summaryLines: string[] = [];
        if (outlierPattern && typeof outlierPattern.metrics.value === 'number') {
            summaryLines.push(
                t('Insights.Card.OutlierMaxLine', {
                    value: formatNumber(locale, outlierPattern.metrics.value),
                }),
            );
        }
        if (spreadFact && typeof spreadFact.metrics?.p95 === 'number' && typeof spreadFact.metrics?.p50 === 'number') {
            summaryLines.push(
                t('Insights.Card.LongTailLine', {
                    p50: formatNumber(locale, spreadFact.metrics.p50),
                    p95: formatNumber(locale, spreadFact.metrics.p95),
                }),
            );
        }

        return {
            headline,
            summaryLines: summaryLines.slice(0, 2),
        };
    }

    if (riskFact) {
        return {
            headline: t('Insights.Card.RiskHeadline', {
                column: String(riskFact.columns?.[0] ?? t('Insights.Card.CurrentResult')),
            }),
            summaryLines: [
                t('Insights.Card.RiskLine', {
                    value: String(riskFact.metrics?.value ?? ''),
                    share: formatPercent(locale, typeof riskFact.metrics?.share === 'number' ? riskFact.metrics.share : null),
                }),
            ],
        };
    }

    if (topDimensionFact) {
        return {
            headline: t('Insights.Card.DimensionHeadline', {
                column: String(topDimensionFact.columns?.[0] ?? t('Insights.Card.CurrentResult')),
            }),
            summaryLines: [
                topDimensionFact.metrics?.value
                    ? t('Insights.Card.DimensionLine', {
                          value: String(topDimensionFact.metrics.value),
                      })
                    : findings[0]?.summary ?? draft.quickSummary.subtitle ?? draft.quickSummary.title,
            ].filter(Boolean),
        };
    }

    return {
        headline: findings[0]?.title ?? draft.quickSummary.title,
        summaryLines: [draft.quickSummary.subtitle ?? findings[0]?.summary ?? t('Insights.KeyInsights.Empty')].filter(Boolean),
    };
}

export function buildStructuredInsightView(params: {
    context: InsightRuleContext;
    draft?: InsightDraft;
    view?: InsightViewModel;
}): StructuredInsightView {
    const draft = params.draft ?? buildInsightDraft(params.context);
    const view = params.view ?? buildInsights(params.context);
    const findingSources = [...draft.patterns, ...draft.facts];
    const findings = findingSources
        .map(source => {
            const summary = 'kind' in source ? patternToInsight(params.context, source) : factToInsight(params.context, source);
            if (!summary) return null;

            return {
                id: source.id,
                title: summary,
                summary,
                severity: findingSeverity(source),
                confidence: confidenceBucket(source.confidence),
            } satisfies InsightStructuredFinding;
        })
        .filter((item): item is InsightStructuredFinding => !!item)
        .slice(0, 5);

    return {
        card: buildInsightCard({
            context: params.context,
            draft,
            view,
            findings,
        }),
        signals: [...draft.facts, ...draft.patterns],
        findings,
        narrative: [view.quickSummary.title, view.quickSummary.subtitle, ...view.insights].filter(Boolean).join(' '),
        recommendedActions: view.recommendedActions,
    };
}
