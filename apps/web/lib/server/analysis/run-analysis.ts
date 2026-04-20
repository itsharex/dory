import 'server-only';

import { randomUUID } from 'node:crypto';
import type { BaseConnection } from '@/lib/connection/base/base-connection';
import type { AnalysisQueryPayload, AnalysisSession, AnalysisStep, AnalysisSuggestion, ResultContext, ResultContextColumn, RunAnalysisRequest, RunAnalysisResponse } from '@/lib/analysis/types';

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
    return bySemantic(context.columns, 'measure') ?? byName(context.columns, ['duration', 'latency', 'count', 'total', 'value']);
}

function detectTimeColumn(context: ResultContext) {
    return bySemantic(context.columns, 'time') ?? byName(context.columns, ['time', 'timestamp', 'created_at', 'date', 'hour', 'day']);
}

function limitClause(limit = 20) {
    return `LIMIT ${limit}`;
}

function buildSuggestionSql(suggestionId: string, context: ResultContext) {
    const source = sourceQuery(context.sqlText);
    const timeColumn = detectTimeColumn(context);
    const serviceColumn = detectDimensionColumn(context, 'service');
    const messageColumn = detectDimensionColumn(context, 'message');
    const dimensionColumn = detectDimensionColumn(context, 'any');
    const measureColumn = detectMeasureColumn(context);

    switch (suggestionId) {
        case 'time-error-trend': {
            const bucketColumn = timeColumn ?? dimensionColumn;
            if (!bucketColumn) {
                throw new Error('Cannot build a trend analysis without a time or dimension column.');
            }

            return {
                title: `Trend by ${bucketColumn}`,
                sql: `SELECT ${quoted(bucketColumn)} AS bucket, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY 1 ASC
${limitClause(50)}`,
            };
        }
        case 'service-error-breakdown': {
            const column = serviceColumn ?? dimensionColumn;
            if (!column) {
                throw new Error('Cannot build a breakdown without a dimension column.');
            }

            return {
                title: `Breakdown by ${column}`,
                sql: `SELECT ${quoted(column)} AS dimension, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`,
            };
        }
        case 'top-messages': {
            const column = messageColumn ?? dimensionColumn;
            if (!column) {
                throw new Error('Cannot inspect top values without a message or dimension column.');
            }

            return {
                title: `Top ${column} values`,
                sql: `SELECT ${quoted(column)} AS value, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`,
            };
        }
        case 'measure-distribution': {
            if (!measureColumn) {
                throw new Error('Cannot build a distribution without a measure column.');
            }

            return {
                title: `Highest ${measureColumn} values`,
                sql: `SELECT *
FROM ${source}
ORDER BY ${quoted(measureColumn)} DESC
${limitClause(20)}`,
            };
        }
        case 'compare-by-dimension':
        case 'pattern-follow-up': {
            if (!dimensionColumn) {
                throw new Error('Cannot compare segments without a dimension column.');
            }

            if (measureColumn) {
                return {
                    title: `Compare ${measureColumn} by ${dimensionColumn}`,
                    sql: `SELECT ${quoted(dimensionColumn)} AS dimension, AVG(${quoted(measureColumn)}) AS avg_value, MAX(${quoted(measureColumn)}) AS max_value, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`,
                };
            }

            return {
                title: `Compare ${dimensionColumn}`,
                sql: `SELECT ${quoted(dimensionColumn)} AS dimension, COUNT(*) AS total_rows
FROM ${source}
GROUP BY 1
ORDER BY total_rows DESC, 1 ASC
${limitClause(20)}`,
            };
        }
        default:
            throw new Error(`Unsupported analysis suggestion: ${suggestionId}`);
    }
}

function summarizeRows(rows: Array<Record<string, unknown>>, columns: Array<{ name: string; type: string | null }>) {
    if (!rows.length) {
        return 'The analysis completed successfully, but the follow-up query returned no rows.';
    }

    const primaryColumn = columns[0]?.name;
    const secondaryColumn = columns[1]?.name;
    const firstRow = rows[0] ?? {};

    if (primaryColumn && secondaryColumn) {
        return `The strongest segment is ${String(firstRow[primaryColumn] ?? 'unknown')} with ${String(firstRow[secondaryColumn] ?? 'n/a')} in the leading metric.`;
    }

    if (primaryColumn) {
        return `The analysis returned ${rows.length} rows. The first result is ${String(firstRow[primaryColumn] ?? 'unknown')}.`;
    }

    return `The analysis returned ${rows.length} rows.`;
}

function followupSuggestionsFromColumns(params: {
    resultRef: { sessionId: string; setIndex: number };
    sqlText: string;
    databaseName?: string | null;
    columns: Array<{ name: string; type: string | null }>;
    rowCount: number;
}): AnalysisSuggestion[] {
    const context: ResultContext = {
        resultSetId: params.resultRef,
        sqlText: params.sqlText,
        databaseName: params.databaseName ?? null,
        tableRefs: [],
        rowCount: params.rowCount,
        columns: params.columns.map(column => ({
            name: column.name,
            dataType: column.type ?? 'unknown',
            semanticType: /time|date/i.test(column.name)
                ? 'time'
                : /duration|count|total|avg|max|min|value/i.test(column.name)
                  ? 'measure'
                  : 'dimension',
        })),
    };

    const suggestions: AnalysisSuggestion[] = [];
    const nextDimension = detectDimensionColumn(context, 'any');
    const nextMeasure = detectMeasureColumn(context);
    const nextTime = detectTimeColumn(context);

    if (nextDimension) {
        suggestions.push({
            id: 'compare-by-dimension',
            kind: 'compare',
            title: `Compare by ${nextDimension}`,
            description: `Compare the leading segments for ${nextDimension}.`,
            intent: { type: 'generate_sql', payload: { suggestionId: 'compare-by-dimension' } },
            priority: 82,
        });
    }

    if (nextTime) {
        suggestions.push({
            id: 'time-error-trend',
            kind: 'trend',
            title: `Trend ${nextTime} over time`,
            description: `Track whether the pattern changes over ${nextTime}.`,
            intent: { type: 'generate_sql', payload: { suggestionId: 'time-error-trend' } },
            priority: 78,
        });
    }

    if (nextMeasure) {
        suggestions.push({
            id: 'measure-distribution',
            kind: 'distribution',
            title: `Inspect ${nextMeasure} outliers`,
            description: `Look at the highest-impact rows for ${nextMeasure}.`,
            intent: { type: 'generate_sql', payload: { suggestionId: 'measure-distribution' } },
            priority: 75,
        });
    }

    return suggestions.filter((item, index) => suggestions.findIndex(candidate => candidate.id === item.id) === index).slice(0, 4);
}

function buildSteps(now: string): AnalysisStep[] {
    return [
        { id: 'reasoning', type: 'reasoning', title: 'Understand the current finding', status: 'done', startedAt: now, endedAt: now },
        { id: 'sql_generation', type: 'sql_generation', title: 'Generate analysis SQL', status: 'pending' },
        { id: 'execution', type: 'execution', title: 'Execute SQL', status: 'pending' },
        { id: 'summary', type: 'summary', title: 'Summarize result and next steps', status: 'pending' },
    ];
}

export async function runAnalysis(params: {
    request: RunAnalysisRequest;
    connection: BaseConnection;
    connectionId: string;
    tabId?: string | null;
}): Promise<RunAnalysisResponse> {
    const analysisRunId = randomUUID();
    const resultSessionId = randomUUID();
    const createdAt = nowIso();
    const steps = buildSteps(createdAt);

    const session: AnalysisSession = {
        id: analysisRunId,
        title: 'Analysis',
        trigger: params.request.trigger,
        contextRef: params.request.context.resultRef,
        status: 'running',
        steps,
        createdAt,
        updatedAt: createdAt,
    };

    try {
        const selected = buildSuggestionSql(params.request.trigger.suggestionId, params.request.context.resultContext);
        session.title = selected.title;
        session.steps[1] = {
            ...session.steps[1]!,
            status: 'done',
            startedAt: createdAt,
            endedAt: nowIso(),
            data: {
                sql: selected.sql,
                suggestionId: params.request.trigger.suggestionId,
            },
        };

        const executionStartedAt = new Date();
        const perfStart = performance.now();
        const result = await params.connection.queryWithContext(selected.sql, {
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

        session.steps[2] = {
            ...session.steps[2]!,
            status: 'done',
            startedAt: executionStartedAt.toISOString(),
            endedAt: executionFinishedAt.toISOString(),
            data: {
                rowCount: result.rowCount ?? rows.length,
                durationMs,
            },
        };

        const summary = summarizeRows(rows, columns);
        const followups = followupSuggestionsFromColumns({
            resultRef: { sessionId: resultSessionId, setIndex: 0 },
            sqlText: selected.sql,
            databaseName: params.request.context.databaseName ?? null,
            columns,
            rowCount: result.rowCount ?? rows.length,
        });

        const updatedAt = nowIso();
        session.steps[3] = {
            ...session.steps[3]!,
            status: 'done',
            startedAt: updatedAt,
            endedAt: updatedAt,
            data: {
                summary,
                followupCount: followups.length,
            },
        };
        session.status = 'done';
        session.updatedAt = updatedAt;
        session.outcome = {
            summary,
            artifacts: [
                { type: 'sql', sql: selected.sql },
                { type: 'result_ref', resultRef: { sessionId: resultSessionId, setIndex: 0 } },
                { type: 'text', content: summary },
            ],
            followups,
        };

        const query: AnalysisQueryPayload = {
            session: {
                sessionId: resultSessionId,
                tabId: params.tabId ?? null,
                connectionId: params.connectionId,
                database: params.request.context.databaseName ?? null,
                sqlText: selected.sql,
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
                    sqlText: selected.sql,
                    sqlOp: parseSqlOp(selected.sql),
                    title: makeTitle(selected.sql),
                    columns,
                    rowCount: result.rowCount ?? rows.length,
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
        session.status = 'error';
        session.updatedAt = updatedAt;
        session.steps = session.steps.map(step => (step.status === 'pending' ? { ...step, status: 'error', error: message, endedAt: updatedAt } : step));
        session.outcome = {
            summary: message,
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
                        columns: [
                            { name: 'error', type: 'text' },
                        ],
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
