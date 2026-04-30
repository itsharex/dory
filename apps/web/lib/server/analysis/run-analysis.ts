import { randomUUID } from 'node:crypto';
import type { BaseConnection } from '@/lib/connection/base/base-connection';
import { translate } from '@/lib/i18n/i18n';
import { routing, type Locale } from '@/lib/i18n/routing';
import type {
    AnalysisOutcome,
    AnalysisQueryPayload,
    AnalysisSession,
    AnalysisStep,
    AnalysisSuggestion,
    AnalysisStepTemplate,
    ResultContext,
    ResultContextColumn,
    RunAnalysisRequest,
    RunAnalysisResponse,
} from '@/lib/analysis/types';
import { actionToSql } from '@/lib/analysis/result-actions';
import { enhanceAnalysisSummaryWithAi } from './ai-summary';

function nowIso() {
    return new Date().toISOString();
}

function parseSqlOp(sql: string): string {
    const first = sql.trim().split(/\s+/)[0]?.toUpperCase() || 'SQL';
    if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(first)) return first;
    if (['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME'].includes(first)) return 'DDL';
    if (['BEGIN', 'START', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE'].includes(first)) return 'TXN';
    return first;
}

function makeTitle(sql: string): string {
    const preview = sql.trim().slice(0, 48).replace(/\s+/g, ' ');
    return `${parseSqlOp(sql)}: ${preview}`;
}

function quoted(name: string) {
    return `"${name.replace(/"/g, '""')}"`;
}

function sourceQuery(sqlText?: string) {
    if (!sqlText?.trim()) {
        throw new Error('Analysis requires a source SQL statement.');
    }

    return `(\n${sqlText.trim().replace(/;+\s*$/, '')}\n) AS analysis_source`;
}

function bySemantic(columns: ResultContextColumn[], semanticType: ResultContextColumn['semanticType']) {
    return columns.find(column => column.semanticType === semanticType)?.name ?? null;
}

function byName(columns: ResultContextColumn[], patterns: string[]) {
    return (
        columns.find(column => {
            const lower = column.name.toLowerCase();
            return patterns.some(pattern => lower === pattern || lower.includes(pattern));
        })?.name ?? null
    );
}

function detectDimensionColumn(context: ResultContext, kind: 'service' | 'message' | 'any') {
    if (kind === 'service') {
        return byName(context.columns, ['service', 'source', 'component', 'app', 'application']);
    }
    if (kind === 'message') {
        return byName(context.columns, ['message', 'msg', 'description', 'event', 'title']);
    }
    return context.columns.find(column => column.semanticType === 'dimension')?.name ?? null;
}

function detectMeasureColumn(context: ResultContext) {
    return bySemantic(context.columns, 'measure') ?? byName(context.columns, ['duration', 'latency', 'count', 'total', 'value', 'rows']);
}

function detectTimeColumn(context: ResultContext) {
    return bySemantic(context.columns, 'time') ?? byName(context.columns, ['time', 'timestamp', 'created_at', 'date', 'hour', 'day']);
}

function limitClause(limit = 20) {
    return `LIMIT ${limit}`;
}

function isReadOnlySelect(sql: string) {
    const trimmed = sql.trim();
    if (!/^select\b/i.test(trimmed)) return false;
    const withoutTrailingSemicolon = trimmed.replace(/;+\s*$/, '');
    if (withoutTrailingSemicolon.includes(';')) return false;
    return !/\b(insert|update|delete|merge|replace|create|alter|drop|truncate|grant|revoke|copy|call|execute)\b/i.test(withoutTrailingSemicolon);
}

function formatValue(value: unknown) {
    if (value == null) return '—';
    if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

function genericAiDrivenSpec(params: { suggestionId: string; sqlPreview: string; context: ResultContext; locale: Locale }): AnalysisSpec {
    const t = (key: string, values?: Record<string, unknown>) => translate(params.locale, `SqlConsole.Insights.Analysis.Server.${key}`, values);
    const title = params.suggestionId === 'ai-primary-next-step' ? t('ContinueRecommendedAnalysis') : t('RunRecommendedAnalysis');
    return {
        suggestionId: params.suggestionId,
        title,
        kind: 'drilldown',
        goal: t('RecommendedAnalysisGoal'),
        description: t('RecommendedAnalysisDescription'),
        resultTitle: title,
        stepTemplates: [
            { id: 'inspect-profile', title: t('Steps.InspectProfile') },
            { id: 'run-next-sql', title: t('Steps.RunNextSql') },
            { id: 'summarize-next-step', title: t('Steps.SummarizeNextStep') },
        ],
        buildSql() {
            if (!isReadOnlySelect(params.sqlPreview)) {
                throw new Error(t('ReadOnlySelectError'));
            }
            return params.sqlPreview.trim().replace(/;+\s*$/, '');
        },
        summarize({ rows, columns }) {
            const firstNumeric = columns.find(column => /count|total|events|rows|value/i.test(column.name))?.name ?? columns.find(column => column.name !== columns[0]?.name)?.name;
            const firstLabel = columns.find(column => column.name !== firstNumeric)?.name ?? columns[0]?.name;
            const first = rows[0] ?? {};
            const leader = firstLabel ? formatValue(first[firstLabel]) : t('FirstGroup');
            const leaderValue = firstNumeric ? formatValue(first[firstNumeric]) : null;
            return {
                analysisState: rows.length ? 'good' : 'invalid',
                limitations: rows.length ? [] : [t('NoRecommendedRowsLimitation')],
                summary: rows.length ? (leaderValue ? t('LeaderSummaryWithValue', { leader, value: leaderValue }) : t('LeaderSummary', { leader })) : t('NoRecommendedRowsSummary'),
                headline: rows.length ? t('LeaderHeadline', { leader }) : t('NoRecommendedRowsHeadline'),
                keyFindings: rows.length
                    ? [
                          leaderValue ? t('LeaderFindingWithValue', { leader, value: leaderValue }) : t('LeaderFinding', { leader }),
                          t('CandidateGroupsFinding', { count: formatValue(rows.length) }),
                      ]
                    : [t('NoUsableRowsFinding')],
                recordHighlights: rows.slice(0, 5).map((row, index) => ({
                    label: firstLabel ? formatValue(row[firstLabel]) : `row_${index + 1}`,
                    value: firstNumeric ? formatValue(row[firstNumeric]) : formatValue(row[columns[0]?.name ?? 'value']),
                })),
                sections: [
                    {
                        id: 'recommended-sql-result',
                        title: t('RecommendedSqlResultTitle'),
                        items: rows.slice(0, 5).map((row, index) => {
                            const label = firstLabel ? formatValue(row[firstLabel]) : `row_${index + 1}`;
                            const value = firstNumeric ? formatValue(row[firstNumeric]) : '';
                            return value ? `${label} → ${value}` : label;
                        }),
                    },
                ],
            };
        },
        buildFollowups: buildFollowups,
    };
}

type AnalysisSpec = {
    suggestionId: string;
    title: string;
    kind: AnalysisSuggestion['kind'];
    goal: string;
    description: string;
    resultTitle: string;
    stepTemplates: AnalysisStepTemplate[];
    buildSql: (context: ResultContext) => string;
    summarize: (params: {
        rows: Array<Record<string, unknown>>;
        columns: Array<{ name: string; type: string | null }>;
        context: ResultContext;
    }) => Omit<AnalysisOutcome, 'artifacts' | 'followups'>;
    buildFollowups: (params: {
        context: ResultContext;
        resultRef: { sessionId: string; setIndex: number };
        columns: Array<{ name: string; type: string | null }>;
        rowCount: number;
        sqlText: string;
    }) => AnalysisSuggestion[];
};

function buildSuggestion(params: {
    id: string;
    kind: AnalysisSuggestion['kind'];
    title: string;
    description: string;
    label: string;
    goal: string;
    resultTitle: string;
    stepTemplates: AnalysisStepTemplate[];
    priority: number;
}) {
    return {
        id: params.id,
        kind: params.kind,
        title: params.title,
        description: params.description,
        label: params.label,
        goal: params.goal,
        resultTitle: params.resultTitle,
        stepTemplates: params.stepTemplates,
        followupPolicy: 'chain' as const,
        intent: { type: 'generate_sql' as const, payload: { suggestionId: params.id } },
        priority: params.priority,
    };
}

function buildFollowups(params: {
    context: ResultContext;
    resultRef: { sessionId: string; setIndex: number };
    columns: Array<{ name: string; type: string | null }>;
    rowCount: number;
    sqlText: string;
}): AnalysisSuggestion[] {
    const nextContext: ResultContext = {
        resultSetId: params.resultRef,
        sqlText: params.sqlText,
        databaseName: params.context.databaseName ?? null,
        tableRefs: [],
        rowCount: params.rowCount,
        columns: params.columns.map(column => ({
            name: column.name,
            dataType: column.type ?? 'unknown',
            semanticType: /time|date/i.test(column.name)
                ? 'time'
                : /service|source|message|dimension|group/i.test(column.name)
                  ? 'dimension'
                  : /duration|count|total|avg|max|min|value|rows/i.test(column.name)
                    ? 'measure'
                    : 'dimension',
        })),
    };

    const timeColumn = detectTimeColumn(nextContext);
    const measureColumn = detectMeasureColumn(nextContext);
    const serviceColumn = detectDimensionColumn(nextContext, 'service');
    const suggestions: AnalysisSuggestion[] = [];

    if (serviceColumn) {
        suggestions.push(
            buildSuggestion({
                id: 'group-by-service',
                kind: 'drilldown',
                title: `Break down by ${serviceColumn}`,
                description: `Identify which ${serviceColumn} contributes most.`,
                label: '按 service 分组分析',
                goal: 'Locate the source of the anomaly.',
                resultTitle: 'Source breakdown',
                stepTemplates: [
                    { id: 'pick-dimension', title: '识别来源字段' },
                    { id: 'group-source', title: '按来源分组统计' },
                    { id: 'summarize-source', title: '生成来源结论' },
                ],
                priority: 92,
            }),
        );
    }

    if (timeColumn) {
        suggestions.push(
            buildSuggestion({
                id: 'view-time-trend',
                kind: 'trend',
                title: `Trend ${timeColumn} over time`,
                description: `Track whether the pattern changes over ${timeColumn}.`,
                label: '查看时间趋势',
                goal: 'Inspect change over time.',
                resultTitle: 'Time trend',
                stepTemplates: [
                    { id: 'inspect-axis', title: '确认时间字段' },
                    { id: 'bucket-series', title: '按时间聚合结果' },
                    { id: 'summarize-trend', title: '生成趋势结论' },
                ],
                priority: 88,
            }),
        );
    }

    if (measureColumn) {
        suggestions.push(
            buildSuggestion({
                id: 'view-distribution',
                kind: 'distribution',
                title: `Profile ${measureColumn} distribution`,
                description: `Quantify the spread and tail of ${measureColumn}.`,
                label: '查看分布',
                goal: 'Understand the distribution shape.',
                resultTitle: 'Distribution',
                stepTemplates: [
                    { id: 'scan-distribution', title: '扫描分布区间' },
                    { id: 'measure-tail', title: '识别长尾与峰值' },
                    { id: 'summarize-distribution', title: '生成分布结论' },
                ],
                priority: 85,
            }),
        );
    }

    if (measureColumn) {
        suggestions.push(
            buildSuggestion({
                id: 'filter-outliers',
                kind: 'compare',
                title: `Filter high ${measureColumn} rows`,
                description: `Keep the anomalous rows for the next analysis step.`,
                label: '过滤异常数据',
                goal: 'Focus on abnormal rows only.',
                resultTitle: 'Filtered anomaly set',
                stepTemplates: [
                    { id: 'find-threshold', title: '确定异常阈值' },
                    { id: 'filter-rows', title: '过滤异常数据' },
                    { id: 'summarize-filtered', title: '生成过滤结果' },
                ],
                priority: 82,
            }),
        );
    }

    return suggestions.filter((item, index) => suggestions.findIndex(candidate => candidate.id === item.id) === index).slice(0, 4);
}

function distributionSummary(rows: Array<Record<string, unknown>>, columns: Array<{ name: string; type: string | null }>) {
    const labels = columns.map(column => column.name);
    const first = rows[0] ?? {};
    return labels.slice(0, 3).map(label => `${label}: ${formatValue(first[label])}`);
}

function specsForContext(context: ResultContext): Record<string, AnalysisSpec> {
    const source = sourceQuery(context.sqlText);
    const timeColumn = detectTimeColumn(context);
    const serviceColumn = detectDimensionColumn(context, 'service');
    const messageColumn = detectDimensionColumn(context, 'message');
    const dimensionColumn = detectDimensionColumn(context, 'any');
    const measureColumn = detectMeasureColumn(context);

    return {
        'inspect-outliers': {
            suggestionId: 'inspect-outliers',
            title: '定位异常样本',
            kind: 'topk',
            goal: 'Locate anomalous rows.',
            description: 'Review the highest rows to understand what is driving the extreme values.',
            resultTitle: 'Outlier samples',
            stepTemplates: [
                { id: 'find-peak', title: '查找最大值' },
                { id: 'extract-top', title: '提取 Top 20 行' },
                { id: 'summarize-outliers', title: '生成展示结果' },
            ],
            buildSql() {
                if (!measureColumn) {
                    throw new Error('Cannot inspect outliers without a measure column.');
                }
                return `SELECT *
FROM ${source}
ORDER BY ${quoted(measureColumn)} DESC
${limitClause(20)}`;
            },
            summarize({ rows, columns }) {
                const measure = measureColumn ?? columns[0]?.name;
                const maxValue = measure ? rows[0]?.[measure] : null;
                return {
                    summary: rows.length
                        ? `Found ${formatValue(maxValue)} as the highest observed value and collected the top anomalous rows.`
                        : 'No anomalous rows were returned.',
                    headline: measure ? `发现 ${formatValue(maxValue)} 为最高值` : '已定位异常样本',
                    keyFindings: [
                        measure ? `${measure} 的最高值为 ${formatValue(maxValue)}` : '已返回最高值样本',
                        rows.length ? `共提取 ${rows.length} 行异常候选样本` : '没有返回可展示的异常样本',
                    ],
                    recordHighlights: rows.slice(0, 5).map((row, index) => ({
                        label: String(row[serviceColumn ?? dimensionColumn ?? columns[0]?.name ?? `row_${index + 1}`] ?? `row_${index + 1}`),
                        value: measure ? formatValue(row[measure]) : formatValue(row[columns[0]?.name ?? 'value']),
                        note: columns
                            .slice(0, 2)
                            .map(column => `${column.name}: ${formatValue(row[column.name])}`)
                            .join(' · '),
                    })),
                    sections: [
                        {
                            id: 'top-records',
                            title: 'Top records',
                            items: rows.slice(0, 3).map((row, index) => {
                                const label = row[serviceColumn ?? dimensionColumn ?? columns[0]?.name ?? `row_${index + 1}`];
                                const value = measure ? row[measure] : row[columns[0]?.name ?? 'value'];
                                return `${formatValue(label)} → ${formatValue(value)}`;
                            }),
                        },
                    ],
                };
            },
            buildFollowups: buildFollowups,
        },
        'analyze-source': {
            suggestionId: 'analyze-source',
            title: '分析来源',
            kind: 'drilldown',
            goal: 'Find the segment behind the issue.',
            description: 'Break the result down by the most relevant dimension to find the likely source.',
            resultTitle: 'Source analysis',
            stepTemplates: [
                { id: 'pick-dimension', title: '识别关键维度' },
                { id: 'group-source', title: '执行来源拆解' },
                { id: 'summarize-source', title: '生成来源结论' },
            ],
            buildSql() {
                const column = serviceColumn ?? dimensionColumn;
                if (!column) {
                    throw new Error('Cannot analyze source without a dimension column.');
                }
                return `SELECT ${quoted(column)} AS dimension, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`;
            },
            summarize({ rows }) {
                const first = rows[0] ?? {};
                return {
                    summary: rows.length
                        ? `The leading segment is ${formatValue(first.dimension)} with ${formatValue(first.total_rows)} rows.`
                        : 'No source segments were returned.',
                    headline: rows.length ? `主要来源为 ${formatValue(first.dimension)}` : '未找到异常来源',
                    keyFindings: rows.length
                        ? [`${formatValue(first.dimension)} 的行数最高，为 ${formatValue(first.total_rows)}`, `已返回 ${rows.length} 个来源分组`]
                        : ['未返回可用的来源分组'],
                    recordHighlights: rows.slice(0, 5).map(row => ({
                        label: formatValue(row.dimension),
                        value: formatValue(row.total_rows),
                    })),
                    sections: [
                        {
                            id: 'source-ranking',
                            title: 'Source ranking',
                            items: rows.slice(0, 5).map(row => `${formatValue(row.dimension)} → ${formatValue(row.total_rows)}`),
                        },
                    ],
                };
            },
            buildFollowups: buildFollowups,
        },
        'group-by-service': {
            suggestionId: 'group-by-service',
            title: '按 service 分组分析',
            kind: 'drilldown',
            goal: 'Locate the source of the anomaly.',
            description: 'Break the result down by service to identify the main contributor.',
            resultTitle: 'Service breakdown',
            stepTemplates: [
                { id: 'pick-dimension', title: '识别来源字段' },
                { id: 'group-source', title: '按来源分组统计' },
                { id: 'summarize-source', title: '生成来源结论' },
            ],
            buildSql() {
                const column = serviceColumn ?? dimensionColumn;
                if (!column) {
                    throw new Error('Cannot group by service without a service or dimension column.');
                }
                return `SELECT ${quoted(column)} AS service, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`;
            },
            summarize({ rows }) {
                const first = rows[0] ?? {};
                return {
                    summary: rows.length
                        ? `${formatValue(first.service)} is the largest service bucket with ${formatValue(first.total_rows)} rows.`
                        : 'No service groups were returned.',
                    headline: rows.length ? `${formatValue(first.service)} 是主要异常来源` : '未找到 service 来源',
                    keyFindings: rows.length ? [`${formatValue(first.service)} 的 total_rows 最高`, `前 ${rows.length} 个 service 已完成排序`] : ['没有返回 service 分组结果'],
                    recordHighlights: rows.slice(0, 5).map(row => ({
                        label: formatValue(row.service),
                        value: formatValue(row.total_rows),
                    })),
                    sections: [
                        {
                            id: 'service-ranking',
                            title: 'Service ranking',
                            items: rows.slice(0, 5).map(row => `${formatValue(row.service)} → ${formatValue(row.total_rows)}`),
                        },
                    ],
                };
            },
            buildFollowups: buildFollowups,
        },
        'view-distribution': {
            suggestionId: 'view-distribution',
            title: '查看分布',
            kind: 'distribution',
            goal: 'Understand the distribution shape.',
            description: 'Quantify the leading measure distribution and tail behavior.',
            resultTitle: 'Distribution',
            stepTemplates: [
                { id: 'scan-distribution', title: '扫描分布区间' },
                { id: 'measure-tail', title: '识别长尾与峰值' },
                { id: 'summarize-distribution', title: '生成分布结论' },
            ],
            buildSql() {
                if (!measureColumn) {
                    throw new Error('Cannot inspect a distribution without a measure column.');
                }
                return `SELECT
    MIN(${quoted(measureColumn)}) AS min_value,
    AVG(${quoted(measureColumn)}) AS avg_value,
    MAX(${quoted(measureColumn)}) AS max_value,
    COUNT(*) AS total_rows
FROM ${source}`;
            },
            summarize({ rows, columns }) {
                const row = rows[0] ?? {};
                return {
                    summary: rows.length
                        ? `The measure spans from ${formatValue(row.min_value)} to ${formatValue(row.max_value)} with an average of ${formatValue(row.avg_value)}.`
                        : 'No distribution summary was returned.',
                    headline: rows.length ? `分布最高值为 ${formatValue(row.max_value)}` : '未生成分布结果',
                    keyFindings: rows.length
                        ? [`最大值 ${formatValue(row.max_value)} 明显高于最小值 ${formatValue(row.min_value)}`, `平均值约为 ${formatValue(row.avg_value)}`]
                        : ['没有返回分布摘要'],
                    recordHighlights: rows.length
                        ? [
                              { label: 'Min', value: formatValue(row.min_value) },
                              { label: 'Avg', value: formatValue(row.avg_value) },
                              { label: 'Max', value: formatValue(row.max_value) },
                              { label: 'Rows', value: formatValue(row.total_rows) },
                          ]
                        : [],
                    sections: [
                        {
                            id: 'distribution-summary',
                            title: 'Distribution summary',
                            items: distributionSummary(rows, columns),
                        },
                    ],
                };
            },
            buildFollowups: buildFollowups,
        },
        'view-time-trend': {
            suggestionId: 'view-time-trend',
            title: '查看时间趋势',
            kind: 'trend',
            goal: 'Inspect change over time.',
            description: 'Aggregate over time and check whether the pattern clusters in a period.',
            resultTitle: 'Time trend',
            stepTemplates: [
                { id: 'inspect-axis', title: '确认时间字段' },
                { id: 'bucket-series', title: '按时间聚合结果' },
                { id: 'summarize-trend', title: '生成趋势结论' },
            ],
            buildSql() {
                const bucketColumn = timeColumn ?? dimensionColumn;
                if (!bucketColumn) {
                    throw new Error('Cannot build a time trend without a time or dimension column.');
                }
                return `SELECT ${quoted(bucketColumn)} AS bucket, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY 1 ASC
${limitClause(50)}`;
            },
            summarize({ rows }) {
                const first = rows[0] ?? {};
                const last = rows[rows.length - 1] ?? {};
                return {
                    summary: rows.length
                        ? `The series spans ${rows.length} buckets, from ${formatValue(first.bucket)} to ${formatValue(last.bucket)}.`
                        : 'No time buckets were returned.',
                    headline: rows.length ? `趋势覆盖 ${rows.length} 个时间分桶` : '未返回趋势数据',
                    keyFindings: rows.length
                        ? [`起始分桶 ${formatValue(first.bucket)}，结束分桶 ${formatValue(last.bucket)}`, `已返回 ${rows.length} 个时间点`]
                        : ['没有返回趋势数据'],
                    recordHighlights: rows.slice(0, 5).map(row => ({
                        label: formatValue(row.bucket),
                        value: formatValue(row.total_rows),
                    })),
                    sections: [
                        {
                            id: 'trend-points',
                            title: 'Trend points',
                            items: rows.slice(0, 5).map(row => `${formatValue(row.bucket)} → ${formatValue(row.total_rows)}`),
                        },
                    ],
                };
            },
            buildFollowups: buildFollowups,
        },
        'filter-outliers': {
            suggestionId: 'filter-outliers',
            title: '过滤异常数据',
            kind: 'compare',
            goal: 'Focus on abnormal rows only.',
            description: 'Keep the highest rows so the next step can focus on the anomalous subset.',
            resultTitle: 'Filtered anomaly set',
            stepTemplates: [
                { id: 'find-threshold', title: '确定异常阈值' },
                { id: 'filter-rows', title: '过滤异常数据' },
                { id: 'summarize-filtered', title: '生成过滤结果' },
            ],
            buildSql() {
                if (!measureColumn) {
                    throw new Error('Cannot filter outliers without a measure column.');
                }
                return `SELECT *
FROM ${source}
WHERE ${quoted(measureColumn)} = (
    SELECT MAX(${quoted(measureColumn)}) FROM ${source}
)
${limitClause(50)}`;
            },
            summarize({ rows, columns }) {
                return {
                    summary: rows.length ? `Filtered ${rows.length} rows into the anomaly-focused subset.` : 'No rows matched the anomaly filter.',
                    headline: rows.length ? `已过滤出 ${rows.length} 行异常数据` : '没有符合条件的异常数据',
                    keyFindings: rows.length ? ['异常子集已准备好用于继续分析', `当前子集大小为 ${rows.length} 行`] : ['没有返回符合条件的异常子集'],
                    recordHighlights: rows.slice(0, 5).map((row, index) => ({
                        label: formatValue(row[columns[0]?.name ?? `row_${index + 1}`]),
                        value: formatValue(row[measureColumn ?? columns[1]?.name ?? columns[0]?.name ?? 'value']),
                    })),
                    sections: [
                        {
                            id: 'filtered-preview',
                            title: 'Filtered preview',
                            items: rows.slice(0, 3).map(
                                (row, index) =>
                                    columns
                                        .slice(0, 3)
                                        .map(column => `${column.name}: ${formatValue(row[column.name])}`)
                                        .join(' · ') || `row_${index + 1}`,
                            ),
                        },
                    ],
                };
            },
            buildFollowups: buildFollowups,
        },
        'top-messages': {
            suggestionId: 'top-messages',
            title: '看哪些内容最多',
            kind: 'topk',
            goal: '看看哪些文本出现得最多。',
            description: '找出出现最多的内容，先判断这次结果主要被哪类信息带动。',
            resultTitle: '高频内容',
            stepTemplates: [
                { id: 'pick-field', title: '识别文本字段' },
                { id: 'rank-values', title: '提取高频值' },
                { id: 'summarize-values', title: '生成高频值结论' },
            ],
            buildSql() {
                const column = messageColumn ?? dimensionColumn;
                if (!column) {
                    throw new Error('Cannot inspect top values without a text or dimension column.');
                }
                return `SELECT ${quoted(column)} AS value, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`;
            },
            summarize({ rows }) {
                const first = rows[0] ?? {};
                const totalRows = rows.reduce((sum, row) => {
                    const value = typeof row.total_rows === 'number' ? row.total_rows : Number(row.total_rows);
                    return Number.isFinite(value) ? sum + value : sum;
                }, 0);
                const firstCount = typeof first.total_rows === 'number' ? first.total_rows : Number(first.total_rows);
                const firstShare = totalRows > 0 && Number.isFinite(firstCount) ? firstCount / totalRows : null;
                const singleValue = rows.length === 1 || firstShare === 1;
                if (rows.length && singleValue) {
                    return {
                        analysisState: 'weak',
                        limitations: [`${formatValue(first.value)} 覆盖当前结果的全部返回行，该字段没有区分度。`],
                        summary: `${formatValue(first.total_rows)} / ${formatValue(totalRows || first.total_rows)} 行都是 ${formatValue(first.value)}，继续分析这个字段没有信息增益。建议转向更有区分度的参与者、仓库或时间维度。`,
                        headline: '当前结果缺少字段多样性',
                        keyFindings: [`${formatValue(first.value)} 覆盖全部返回行`, '该字段分布不适合作为继续分析目标', '建议直接进入聚合或时间趋势分析'],
                        recordHighlights: rows.slice(0, 5).map(row => ({
                            label: formatValue(row.value),
                            value: formatValue(row.total_rows),
                        })),
                        sections: [
                            {
                                id: 'low-variance-profile',
                                title: 'Profile fact',
                                items: [`${formatValue(first.value)} → ${formatValue(first.total_rows)}`, 'Top value share: 100%'],
                            },
                        ],
                    };
                }
                return {
                    analysisState: rows.length ? 'good' : 'invalid',
                    limitations: rows.length ? [] : ['没有返回高频值，无法继续解释分布。'],
                    summary: rows.length ? `${formatValue(first.value)} is the most common value with ${formatValue(first.total_rows)} rows.` : 'No top values were returned.',
                    headline: rows.length ? `${formatValue(first.value)} 是最常见的值` : '未返回高频值',
                    keyFindings: rows.length ? [`最高频值为 ${formatValue(first.value)}`, `频次为 ${formatValue(first.total_rows)}`] : ['没有返回高频值'],
                    recordHighlights: rows.slice(0, 5).map(row => ({
                        label: formatValue(row.value),
                        value: formatValue(row.total_rows),
                    })),
                    sections: [
                        {
                            id: 'top-values',
                            title: 'Top values',
                            items: rows.slice(0, 5).map(row => `${formatValue(row.value)} → ${formatValue(row.total_rows)}`),
                        },
                    ],
                };
            },
            buildFollowups: buildFollowups,
        },
        'pattern-follow-up': {
            suggestionId: 'pattern-follow-up',
            title: '继续分析这个模式',
            kind: 'compare',
            goal: 'Continue investigating the strongest pattern.',
            description: 'Compare the strongest detected pattern against the most relevant dimension.',
            resultTitle: 'Pattern follow-up',
            stepTemplates: [
                { id: 'inspect-pattern', title: '确认异常模式' },
                { id: 'compare-segments', title: '对比相关分组' },
                { id: 'summarize-pattern', title: '生成模式结论' },
            ],
            buildSql() {
                const column = dimensionColumn;
                if (!column) {
                    throw new Error('Cannot continue the pattern analysis without a dimension column.');
                }
                if (measureColumn) {
                    return `SELECT ${quoted(column)} AS dimension, AVG(${quoted(measureColumn)}) AS avg_value, MAX(${quoted(measureColumn)}) AS max_value, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`;
                }
                return `SELECT ${quoted(column)} AS dimension, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`;
            },
            summarize({ rows }) {
                const first = rows[0] ?? {};
                return {
                    summary: rows.length ? `The strongest segment remains ${formatValue(first.dimension)}.` : 'No pattern comparison rows were returned.',
                    headline: rows.length ? `${formatValue(first.dimension)} 仍然是主要分组` : '未返回模式对比结果',
                    keyFindings: rows.length ? ['已完成模式相关分组对比'] : ['没有返回模式对比结果'],
                    recordHighlights: rows.slice(0, 5).map(row => ({
                        label: formatValue(row.dimension),
                        value: formatValue(row.max_value ?? row.total_rows),
                        note: row.avg_value != null ? `avg ${formatValue(row.avg_value)}` : undefined,
                    })),
                    sections: [
                        {
                            id: 'pattern-ranking',
                            title: 'Pattern comparison',
                            items: rows.slice(0, 5).map(row => `${formatValue(row.dimension)} → ${formatValue(row.max_value ?? row.total_rows)}`),
                        },
                    ],
                };
            },
            buildFollowups: buildFollowups,
        },
    };
}

function buildSteps(stepTemplates: AnalysisStepTemplate[], startedAt: string): AnalysisStep[] {
    return stepTemplates.map((step, index) => ({
        id: step.id,
        type: index === stepTemplates.length - 1 ? 'summary' : index === stepTemplates.length - 2 ? 'execution' : 'reasoning',
        title: step.title,
        status: index === 0 ? 'running' : 'pending',
        startedAt: index === 0 ? startedAt : undefined,
    }));
}

function markStep(steps: AnalysisStep[], stepId: string, patch: Partial<AnalysisStep>) {
    return steps.map(step => (step.id === stepId ? { ...step, ...patch } : step));
}

export async function runAnalysis(params: {
    request: RunAnalysisRequest;
    connection: BaseConnection;
    connectionId: string;
    tabId?: string | null;
    locale?: Locale;
    organizationId?: string | null;
    userId?: string | null;
}): Promise<RunAnalysisResponse> {
    const analysisRunId = randomUUID();
    const resultSessionId = randomUUID();
    const createdAt = nowIso();
    const specs = specsForContext(params.request.context.resultContext);
    const sqlPreview = params.request.trigger.sqlPreview?.trim();
    const spec = sqlPreview
        ? genericAiDrivenSpec({
              suggestionId: params.request.trigger.suggestionId,
              sqlPreview,
              context: params.request.context.resultContext,
              locale: params.locale ?? routing.defaultLocale,
          })
        : params.request.trigger.action
          ? {
                ...(specs[params.request.trigger.suggestionId] ?? {
                    suggestionId: params.request.trigger.suggestionId,
                    title: params.request.trigger.action.title,
                    kind: 'drilldown' as const,
                    goal: params.request.trigger.action.title,
                    description: params.request.trigger.action.title,
                    resultTitle: params.request.trigger.action.title,
                    stepTemplates: [
                        { id: 'inspect-profile', title: '读取 Profile 信号' },
                        { id: 'run-next-sql', title: '执行推荐 SQL' },
                        { id: 'summarize-next-step', title: '生成下一步结论' },
                    ],
                    summarize({ rows, columns }) {
                        const first = rows[0] ?? {};
                        const firstColumn = columns[0]?.name;
                        return {
                            analysisState: rows.length ? 'good' : 'invalid',
                            limitations: rows.length ? [] : ['没有返回可分析结果。'],
                            summary: rows.length ? `已执行推荐操作，返回 ${rows.length} 行结果。` : '推荐操作没有返回结果。',
                            headline: params.request.trigger.action!.title,
                            keyFindings: rows.length ? [`返回 ${rows.length} 行结果`] : ['没有返回结果'],
                            recordHighlights: rows.slice(0, 5).map((row, index) => ({
                                label: firstColumn ? formatValue(row[firstColumn]) : `row_${index + 1}`,
                                value: formatValue(row[columns[1]?.name ?? firstColumn ?? 'value']),
                            })),
                            sections: [
                                {
                                    id: 'action-result',
                                    title: 'Action result',
                                    items: rows.slice(0, 5).map(
                                        (row, index) =>
                                            columns
                                                .slice(0, 3)
                                                .map(column => `${column.name}: ${formatValue(row[column.name])}`)
                                                .join(' · ') || `row_${index + 1}`,
                                    ),
                                },
                            ],
                        };
                    },
                    buildFollowups,
                }),
                suggestionId: params.request.trigger.suggestionId,
                title: params.request.trigger.action.title,
                resultTitle: params.request.trigger.action.title,
                buildSql(context: ResultContext) {
                    return actionToSql(params.request.trigger.action!, context.sqlText ?? '');
                },
            }
          : (specs[params.request.trigger.suggestionId] ?? null);

    if (!spec) {
        throw new Error(`Unsupported analysis suggestion: ${params.request.trigger.suggestionId}`);
    }

    const session: AnalysisSession = {
        id: analysisRunId,
        title: spec.title,
        trigger: params.request.trigger,
        contextRef: params.request.context.resultRef,
        status: 'running',
        steps: buildSteps(spec.stepTemplates, createdAt),
        createdAt,
        updatedAt: createdAt,
    };

    try {
        const sqlStartedAt = nowIso();
        const sql = spec.buildSql(params.request.context.resultContext);
        session.steps = markStep(session.steps, spec.stepTemplates[0]!.id, {
            status: 'done',
            endedAt: sqlStartedAt,
        });
        session.steps = markStep(session.steps, spec.stepTemplates[1]!.id, {
            status: 'running',
            startedAt: sqlStartedAt,
            data: { sql, suggestionId: spec.suggestionId },
        });

        const executionStartedAt = new Date();
        const perfStart = performance.now();
        const result = await params.connection.queryWithContext(sql, {
            database: params.request.context.databaseName ?? undefined,
            queryId: resultSessionId,
        });
        const executionFinishedAt = new Date();
        const durationMs = Math.round(performance.now() - perfStart);

        const rows = Array.isArray(result.rows) ? (result.rows as Array<Record<string, unknown>>) : [];
        const columns = (result.columns ?? []).map(column => ({
            name: column.name,
            type: column.type ?? null,
        }));

        session.steps = markStep(session.steps, spec.stepTemplates[1]!.id, {
            status: 'done',
            endedAt: executionStartedAt.toISOString(),
        });
        session.steps = markStep(session.steps, spec.stepTemplates[2]!.id, {
            status: 'done',
            startedAt: executionStartedAt.toISOString(),
            endedAt: executionFinishedAt.toISOString(),
            data: {
                rowCount: result.rowCount ?? rows.length,
                durationMs,
            },
        });

        const ruleOutcomeCore = spec.summarize({
            rows,
            columns,
            context: params.request.context.resultContext,
        });
        const rowCount = result.rowCount ?? rows.length;
        const outcomeCore = await enhanceAnalysisSummaryWithAi({
            locale: params.locale ?? routing.defaultLocale,
            organizationId: params.organizationId ?? null,
            userId: params.userId ?? null,
            sql,
            suggestion: {
                title: spec.title,
                goal: spec.goal,
                description: spec.description,
                resultTitle: spec.resultTitle,
            },
            context: params.request.context.resultContext,
            columns,
            rows,
            rowCount,
            fallback: ruleOutcomeCore,
        });
        const followups = spec.buildFollowups({
            context: params.request.context.resultContext,
            resultRef: { sessionId: resultSessionId, setIndex: 0 },
            columns,
            rowCount,
            sqlText: sql,
        });

        const outcome: AnalysisOutcome = {
            ...outcomeCore,
            recommendedActions: followups,
            artifacts: [
                { type: 'sql', sql },
                { type: 'result_ref', resultRef: { sessionId: resultSessionId, setIndex: 0 } },
                { type: 'text', content: outcomeCore.summary },
            ],
            followups,
        };

        session.status = 'done';
        session.updatedAt = nowIso();
        session.outcome = outcome;

        const query: AnalysisQueryPayload = {
            session: {
                sessionId: resultSessionId,
                tabId: params.tabId ?? null,
                connectionId: params.connectionId,
                database: params.request.context.databaseName ?? null,
                sqlText: sql,
                status: 'success',
                errorMessage: null,
                startedAt: executionStartedAt.toISOString(),
                finishedAt: executionFinishedAt.toISOString(),
                durationMs,
                resultSetCount: 1,
                stopOnError: true,
                source: 'analysis',
            },
            queryResultSets: [
                {
                    sessionId: resultSessionId,
                    setIndex: 0,
                    sqlText: sql,
                    sqlOp: parseSqlOp(sql),
                    title: makeTitle(sql),
                    columns,
                    rowCount,
                    limited: result.limited ?? false,
                    limit: result.limit ?? null,
                    affectedRows: null,
                    status: 'success',
                    errorMessage: null,
                    errorCode: null,
                    errorSqlState: null,
                    errorMeta: null,
                    warnings: null,
                    startedAt: executionStartedAt.toISOString(),
                    finishedAt: executionFinishedAt.toISOString(),
                    durationMs,
                },
            ],
            results: [rows],
        };

        return {
            session,
            query,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Analysis failed.';
        const updatedAt = nowIso();
        const runningStep = session.steps.find(step => step.status === 'running')?.id ?? session.steps[session.steps.length - 1]?.id;
        session.status = 'error';
        session.updatedAt = updatedAt;
        session.steps = session.steps.map(step => {
            if (step.id === runningStep) {
                return {
                    ...step,
                    status: 'error',
                    endedAt: updatedAt,
                    error: message,
                };
            }
            if (step.status === 'pending') {
                return {
                    ...step,
                    status: 'error',
                    endedAt: updatedAt,
                    error: message,
                };
            }
            return step;
        });
        session.outcome = {
            summary: message,
            headline: '分析执行失败',
            keyFindings: [message],
            recordHighlights: [],
            sections: [
                {
                    id: 'error',
                    title: 'Error',
                    items: [message],
                },
            ],
            artifacts: [{ type: 'text', content: message }],
            followups: [],
        };

        return {
            session,
            query: {
                session: {
                    sessionId: resultSessionId,
                    tabId: params.tabId ?? null,
                    connectionId: params.connectionId,
                    database: params.request.context.databaseName ?? null,
                    sqlText: '',
                    status: 'error',
                    errorMessage: message,
                    startedAt: updatedAt,
                    finishedAt: updatedAt,
                    durationMs: 0,
                    resultSetCount: 1,
                    stopOnError: true,
                    source: 'analysis',
                },
                queryResultSets: [
                    {
                        sessionId: resultSessionId,
                        setIndex: 0,
                        sqlText: '',
                        sqlOp: 'SELECT',
                        title: 'Analysis Error',
                        columns: [{ name: 'error', type: 'text' }],
                        rowCount: 1,
                        limited: false,
                        limit: null,
                        affectedRows: null,
                        status: 'error',
                        errorMessage: message,
                        errorCode: null,
                        errorSqlState: null,
                        errorMeta: null,
                        warnings: null,
                        startedAt: updatedAt,
                        finishedAt: updatedAt,
                        durationMs: 0,
                    },
                ],
                results: [[{ error: message }]],
            },
        };
    }
}
