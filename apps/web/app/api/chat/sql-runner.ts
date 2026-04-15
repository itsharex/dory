import { tool } from 'ai';
import { z } from 'zod';
import { ensureConnectionPoolForUser } from '../connection/utils';
import { isReadOnlyQuery } from '../utils/sql-readonly';
import { getDBService } from '@/lib/database';
import { Locale } from '@/lib/i18n/routing';
import { translateApi } from '@/app/api/utils/i18n';
import type { BaseConnection } from '@/lib/connection/base/base-connection';
import type { ConnectionType } from '@/types/connections';
import type { TableIndexInfo } from '@/types/table-info';

type CreateSqlRunnerOptions = {
    userId: string;
    organizationId: string;
    chatId: string;
    messageId?: string;
    datasourceId: string;
    defaultDatabase?: string | null;
    locale?: Locale;
};

const ROW_LIMIT = parsePositiveInt(process.env.CHATBOT_SQL_ROW_LIMIT, 200);


export function createSqlRunnerTool({
    userId,
    organizationId,
    datasourceId,
    messageId,
    chatId,
    defaultDatabase,
    locale,
}: CreateSqlRunnerOptions) {
    const t = (key: string, values?: Record<string, unknown>) => translateApi(key, values, locale);
    const description = t('Api.Chat.SqlRunner.Description');
    return tool({
        description,
        inputSchema: z.object({
            sql: z.string().min(1, t('Api.Chat.SqlRunner.SqlRequired')),
            database: z.string().optional(),
        }),
        execute: async ({ sql, database }) => {
            const requestedDatabase = sanitizeDatabase(database);

            if (!userId || !datasourceId) {
                return buildErrorResult(sql, requestedDatabase, t('Api.Chat.SqlRunner.MissingConnection'));
            }

            const trimmed = sql.trim();
            if (!trimmed) {
                return buildErrorResult(sql, requestedDatabase, t('Api.Chat.SqlRunner.SqlRequired'));
            }

            
            if (!isReadOnlyQuery(trimmed)) {
                return buildErrorResult(
                    trimmed,
                    requestedDatabase,
                    t('Api.Chat.SqlRunner.ReadOnlyOnly'),
                    undefined,
                    {
                        required: true,
                        reason: 'non-readonly-query',
                    },
                );
            }

            const baseAudit = {
                organizationId,
                user_id: userId,
                source: 'chatbot' as const,
                datasource_id: datasourceId,
                sql_text: sql,
                database_name: requestedDatabase,
                extra_json: {
                    chat_id: chatId,
                    message_id: messageId,
                },
            };
            const db = await getDBService();
            if (!db?.audit) {
                console.warn('[chat] Audit repository not available, skipping audit logging.');
            }

            try {
                
                const { entry, config } = await ensureConnectionPoolForUser(userId, organizationId, datasourceId, null);
                const instance = entry.instance;

                const targetDatabase = requestedDatabase ?? sanitizeDatabase(defaultDatabase) ?? sanitizeDatabase(config.database);
                const performanceGuardResult = await validateSqlPerformance({
                    sql: trimmed,
                    database: targetDatabase,
                    instance,
                    connectionType: config.type,
                    t,
                });

                if (performanceGuardResult) {
                    return performanceGuardResult;
                }

                const started = Date.now();
                const result = await instance.queryWithContext(trimmed, {
                    database: targetDatabase ?? undefined,
                });
                const durationMs = Date.now() - started;
                console.info('[chat][sqlRunner] executed', {
                    datasourceId,
                    durationMs,
                });

                const rows = Array.isArray(result.rows) ? result.rows : [];
                const previewRows = rows.slice(0, ROW_LIMIT).map(row => serializeRow(row));
                const truncated = rows.length > ROW_LIMIT;
                const columns =
                    result.columns && result.columns.length > 0
                        ? result.columns.map(col => ({
                              name: col.name,
                              type: col.type ?? null,
                          }))
                        : inferColumnsFromRows(previewRows);

                if (db?.audit) {
                    const rowsRead = Number(result.statistics?.rows_read);
                    const bytesRead = Number(result.statistics?.bytes_read);
                    await db.audit.logSuccess({
                        ...baseAudit,
                        durationMs: durationMs,
                        rowsRead: Number.isFinite(rowsRead) ? rowsRead : null,
                        bytesRead: Number.isFinite(bytesRead) ? bytesRead : null,
                        tabId: 'chatbot',
                        userId,
                        sqlText: sql,
                    });
                }

                const base: SqlResultBase = {
                    type: 'sql-result',
                    sql: trimmed,
                    database: targetDatabase ?? null,
                    timestamp: new Date().toISOString(),
                };

                const success: SqlResultOk = {
                    ...base,
                    ok: true,
                    rowCount: result.rowCount ?? rows.length,
                    sampleRowCount: previewRows.length,
                    hasMore: truncated,
                    previewRows,
                    columns,
                    durationMs,
                };

                return success;
            } catch (error: any) {
                console.error('[chat] sqlRunner failed', error);

                const rawMessage = String(error?.message ?? error ?? t('Api.Chat.SqlRunner.ExecuteFailed'));
                const code = extractErrorCode(rawMessage);
                const targetDatabase = requestedDatabase ?? sanitizeDatabase(defaultDatabase);

                
                if (db?.audit) {
                    await db.audit.logError({
                        ...baseAudit,
                        errorMessage: rawMessage,
                        tabId: 'chatbot',
                        userId,
                        sqlText: sql
                    });
                }

                return buildErrorResult(trimmed, targetDatabase, rawMessage, code);
            }
        },
    });
}

type SqlResultBase = {
    type: 'sql-result';
    sql: string;
    database: string | null;
    timestamp: string;
};

export type SqlResultOk = SqlResultBase & {
    ok: true;
    rowCount: number; 
    sampleRowCount: number; 
    hasMore: boolean; 
    previewRows: Array<Record<string, unknown>>;
    columns: Array<{ name: string; type: string | null }>;
    durationMs: number;
};

export type SqlResultError = SqlResultBase & {
    ok: false;
    manualExecution?: {
        required: boolean;
        reason: 'non-readonly-query';
    };
    error: {
        message: string;
        code?: number | null;
        raw?: string;
    };
};

export type SqlResult = SqlResultOk | SqlResultError;

function buildErrorResult(
    sql: string,
    database: string | null,
    message: string,
    code?: number | null,
    manualExecution?: SqlResultError['manualExecution'],
): SqlResultError {
    return {
        type: 'sql-result',
        sql,
        database,
        ok: false,
        manualExecution,
        error: {
            message,
            code,
            raw: message,
        },
        timestamp: new Date().toISOString(),
    };
}

export function isManualExecutionRequiredSqlResult(value: unknown): value is SqlResultError {
    if (!value || typeof value !== 'object') return false;
    if ((value as SqlResultError).type !== 'sql-result') return false;
    if ((value as SqlResultError).ok !== false) return false;
    return (value as SqlResultError).manualExecution?.required === true;
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
    }
    return fallback;
}

function sanitizeDatabase(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

async function validateSqlPerformance(params: {
    sql: string;
    database: string | null;
    instance: BaseConnection;
    connectionType?: ConnectionType | null;
    t: (key: string, values?: Record<string, unknown>) => string;
}): Promise<SqlResultError | null> {
    const { sql, database, instance, connectionType, t } = params;

    if (containsSelectWildcard(sql)) {
        return buildErrorResult(sql, database, t('Api.Chat.SqlRunner.SelectAllNotAllowed'));
    }

    const sortableQuery = extractSortableQuery(sql);
    if (!sortableQuery || !database) {
        return null;
    }

    const orderByColumns = sortableQuery.orderByColumns.filter(isSimpleColumnReference);
    if (!orderByColumns.length) {
        return null;
    }

    const indexCoverage = await assessOrderByIndexCoverage({
        instance,
        connectionType,
        database,
        table: sortableQuery.table,
        columns: orderByColumns,
    });

    if (indexCoverage === 'covered') {
        return null;
    }

    const messageKey =
        indexCoverage === 'missing'
            ? 'Api.Chat.SqlRunner.OrderByIndexMissing'
            : 'Api.Chat.SqlRunner.OrderByIndexUnknown';

    return buildErrorResult(
        sql,
        database,
        t(messageKey, {
            columns: orderByColumns.join(', '),
            table: sortableQuery.table,
        }),
    );
}

function containsSelectWildcard(sql: string): boolean {
    const match = sql.match(/^\s*select\s+([\s\S]+?)\s+from\b/i);
    if (!match) return false;

    const selectList = match[1];
    return /(^|,)\s*(?:[a-zA-Z_][\w$]*\s*\.\s*)?\*(\s*(,|$))/i.test(selectList);
}

function extractSortableQuery(sql: string): { table: string; orderByColumns: string[] } | null {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (!/^select\b/i.test(normalized)) return null;
    if (/\b(join|union|intersect|except)\b/i.test(normalized)) return null;
    if (/\bfrom\s*\(/i.test(normalized)) return null;
    if (!/\border\s+by\b/i.test(normalized) || !/\blimit\s+\d+\b/i.test(normalized)) return null;

    const fromMatch = normalized.match(/\bfrom\s+([`"a-zA-Z0-9_.]+)/i);
    const orderByMatch = normalized.match(/\border\s+by\s+(.+?)\s+limit\s+\d+\b/i);

    if (!fromMatch || !orderByMatch) {
        return null;
    }

    const table = stripIdentifierQuotes(fromMatch[1]);
    const orderByColumns = orderByMatch[1]
        .split(',')
        .map(part => part.replace(/\s+(asc|desc)\b/gi, '').trim())
        .map(part => stripIdentifierQuotes(part))
        .filter(Boolean);

    if (!table || !orderByColumns.length) {
        return null;
    }

    return { table, orderByColumns };
}

function stripIdentifierQuotes(value: string): string {
    return value.replace(/[`"]/g, '').trim();
}

function isSimpleColumnReference(value: string): boolean {
    return /^[a-zA-Z_][\w$]*(?:\.[a-zA-Z_][\w$]*)?$/.test(value);
}

async function assessOrderByIndexCoverage(params: {
    instance: BaseConnection;
    connectionType?: ConnectionType | null;
    database: string;
    table: string;
    columns: string[];
}): Promise<'covered' | 'missing' | 'unknown'> {
    const { instance, connectionType, database, table, columns } = params;
    const indexColumns = await getIndexedColumns(instance, connectionType, database, table);

    if (!indexColumns) {
        return 'unknown';
    }

    return columns.every(column => indexColumns.has(stripTableQualifier(column))) ? 'covered' : 'missing';
}

async function getIndexedColumns(
    instance: BaseConnection,
    connectionType: ConnectionType | null | undefined,
    database: string,
    table: string,
): Promise<Set<string> | null> {
    if (connectionType === 'mysql' || connectionType === 'mariadb') {
        return getMysqlIndexedColumns(instance, database, table);
    }

    const tableInfo = (instance.capabilities as any)?.tableInfo;
    if (!tableInfo || typeof tableInfo.indexes !== 'function') {
        return null;
    }

    try {
        const indexes = (await tableInfo.indexes(database, table)) as TableIndexInfo[];
        if (!Array.isArray(indexes) || !indexes.length) {
            return new Set();
        }

        const indexedColumns = new Set<string>();
        for (const index of indexes) {
            for (const column of extractColumnsFromIndexDefinition(index.definition)) {
                indexedColumns.add(column);
            }
        }

        return indexedColumns;
    } catch (error) {
        console.warn('[chat][sqlRunner] failed to inspect indexes', error);
        return null;
    }
}

async function getMysqlIndexedColumns(instance: BaseConnection, database: string, tableRef: string): Promise<Set<string> | null> {
    const { schema, table } = splitTableReference(tableRef);
    const tableSchema = schema ?? database;

    try {
        const result = await instance.queryWithContext<{ columns?: string | null }>(
            `
                SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columns
                FROM information_schema.statistics
                WHERE table_schema = ?
                  AND table_name = ?
                GROUP BY index_name
            `,
            {
                database,
                params: [tableSchema, table],
            },
        );

        const indexedColumns = new Set<string>();
        for (const row of Array.isArray(result.rows) ? result.rows : []) {
            const columns = String(row.columns ?? '')
                .split(',')
                .map(column => column.trim())
                .filter(Boolean);
            for (const column of columns) {
                indexedColumns.add(column);
            }
        }

        return indexedColumns;
    } catch (error) {
        console.warn('[chat][sqlRunner] failed to inspect mysql indexes', error);
        return null;
    }
}

function extractColumnsFromIndexDefinition(definition?: string | null): string[] {
    if (!definition) return [];

    const match = definition.match(/\((.+)\)/);
    if (!match) return [];

    return match[1]
        .split(',')
        .map(part => part.trim())
        .map(part => part.replace(/\s+(ASC|DESC)\b/gi, ''))
        .map(part => part.replace(/^.*\./, ''))
        .map(part => stripIdentifierQuotes(part))
        .filter(isSimpleColumnReference)
        .map(stripTableQualifier);
}

function splitTableReference(tableRef: string): { schema: string | null; table: string } {
    const clean = stripIdentifierQuotes(tableRef);
    const parts = clean.split('.');

    if (parts.length >= 2) {
        return {
            schema: parts[parts.length - 2] || null,
            table: parts[parts.length - 1] || clean,
        };
    }

    return {
        schema: null,
        table: clean,
    };
}

function stripTableQualifier(column: string): string {
    const parts = stripIdentifierQuotes(column).split('.');
    return parts[parts.length - 1] || column;
}

function extractErrorCode(message: string): number | null {
    const match = message.match(/Code:\s*(\d+)/i);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
}

function serializeRow(row: unknown): Record<string, unknown> {
    if (!row || typeof row !== 'object') {
        return { value: stringify(row) };
    }

    if (Array.isArray(row)) {
        const result: Record<string, unknown> = {};
        row.forEach((value, index) => {
            result[`col_${index}`] = stringify(value);
        });
        return result;
    }

    const obj = row as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = stringify(value);
    }
    return result;
}

function inferColumnsFromRows(rows: Array<Record<string, unknown>>) {
    if (!rows.length) return [];
    const keys = new Set<string>();
    rows.forEach(row => {
        Object.keys(row).forEach(key => keys.add(key));
    });
    return Array.from(keys).map(key => ({ name: key, type: null as string | null }));
}

function stringify(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
