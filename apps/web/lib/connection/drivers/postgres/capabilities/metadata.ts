import type {
    ConnectionMetadataAPI,
    ConnectionSchemaMap,
    DatabaseFunctionMeta,
    DatabaseObjectRow,
    DatabaseSummary,
    DatabaseSummaryOptions,
    TableColumnInfo,
} from '@/lib/connection/base/types';
import { normalizePostgresTableKind } from '../postgres-driver';
import type { PostgresDatasource } from '../PostgresDatasource';

export type PostgresMetadataAPI = ConnectionMetadataAPI & {
    getTableColumns: (database: string, table: string) => Promise<TableColumnInfo[]>;
    getTablesOnly: (database: string) => Promise<DatabaseObjectRow[]>;
    getViews: (database: string) => Promise<DatabaseObjectRow[]>;
    getMaterializedViews: (database: string) => Promise<DatabaseObjectRow[]>;
    getFunctions: (database?: string) => Promise<DatabaseFunctionMeta[]>;
    getDatabaseSummary: (options: DatabaseSummaryOptions) => Promise<DatabaseSummary>;
    getDatabaseTablesDetail: (database: string) => Promise<DatabaseObjectRow[]>;
};

type ObjectRow = {
    schemaName?: string;
    name?: string;
    relkind?: string;
    totalBytes?: number | string | null;
    totalRows?: number | string | null;
    comment?: string | null;
    lastModified?: string | null;
};

type FunctionRow = {
    schemaName?: string;
    name?: string;
};

const SYSTEM_SCHEMA_FILTER = `
    n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname NOT LIKE 'pg_toast%'
`;

function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toIsoString(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function qualifyName(schemaName: string | undefined, objectName: string | undefined): string | null {
    if (!objectName) return null;
    if (!schemaName || schemaName === 'public') {
        return objectName;
    }
    return `${schemaName}.${objectName}`;
}

function normalizeObjectRow(row: ObjectRow): DatabaseObjectRow | null {
    const name = qualifyName(row.schemaName, row.name);
    if (!name) return null;

    return {
        name,
        engine: normalizePostgresTableKind(row.relkind),
        totalBytes: toNumberOrNull(row.totalBytes),
        totalRows: toNumberOrNull(row.totalRows),
        comment: row.comment ?? null,
        lastModified: toIsoString(row.lastModified),
    };
}

function isTableLike(engine?: string | null) {
    return engine === 'table' || engine === 'partitioned' || engine === 'foreign_table';
}

function parseTableName(table: string): { schema: string | null; name: string } {
    const trimmed = table.trim();
    const [schema, ...rest] = trimmed.split('.');
    if (rest.length === 0) {
        return { schema: null, name: schema };
    }
    return {
        schema,
        name: rest.join('.'),
    };
}

async function getDatabases(datasource: PostgresDatasource) {
    const result = await datasource.query<{
        databaseName: string;
    }>(
        `
            SELECT datname AS "databaseName"
            FROM pg_database
            WHERE datallowconn
              AND NOT datistemplate
            ORDER BY datname
        `,
    );

    return result.rows.map(row => ({
        value: row.databaseName,
        label: row.databaseName,
    }));
}

async function getTables(datasource: PostgresDatasource, database?: string) {
    const result = await datasource.queryWithContext<{
        schemaName: string;
        tableName: string;
    }>(
        `
            SELECT
                table_schema AS "schemaName",
                table_name AS "tableName"
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
              AND table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
        `,
        { database },
    );

    return result.rows
        .map(row => {
            const value = qualifyName(row.schemaName, row.tableName);
            if (!value) return null;
            return {
                value,
                label: value,
                database,
            };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

async function getSchema(datasource: PostgresDatasource, database?: string): Promise<ConnectionSchemaMap> {
    const result = await datasource.queryWithContext<{
        schemaName: string;
        tableName: string;
        columnName: string;
    }>(
        `
            SELECT
                table_schema AS "schemaName",
                table_name AS "tableName",
                column_name AS "columnName"
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name, ordinal_position
        `,
        { database },
    );

    return result.rows.reduce<ConnectionSchemaMap>((acc, row) => {
        const tableName = qualifyName(row.schemaName, row.tableName);
        const columnName = row.columnName?.trim();
        if (!tableName || !columnName) {
            return acc;
        }
        if (!acc[tableName]) {
            acc[tableName] = [];
        }
        acc[tableName].push(columnName);
        return acc;
    }, {});
}

async function getTableColumns(datasource: PostgresDatasource, database: string, table: string): Promise<TableColumnInfo[]> {
    const parsed = parseTableName(table);
    const result = await datasource.queryWithContext<TableColumnInfo>(
        `
            SELECT
                cols.column_name AS "columnName",
                cols.udt_name AS "columnType",
                CASE WHEN cols.column_default IS NULL THEN NULL ELSE 'DEFAULT' END AS "defaultKind",
                cols.column_default AS "defaultExpression",
                EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                     AND tc.table_schema = kcu.table_schema
                     AND tc.table_name = kcu.table_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                      AND tc.table_schema = cols.table_schema
                      AND tc.table_name = cols.table_name
                      AND kcu.column_name = cols.column_name
                ) AS "isPrimaryKey",
                pgd.description AS comment
            FROM information_schema.columns cols
            JOIN pg_catalog.pg_class cls
              ON cls.relname = cols.table_name
            JOIN pg_catalog.pg_namespace ns
              ON ns.oid = cls.relnamespace
             AND ns.nspname = cols.table_schema
            LEFT JOIN pg_catalog.pg_description pgd
              ON pgd.objoid = cls.oid
             AND pgd.objsubid = cols.ordinal_position
            WHERE cols.table_schema = COALESCE($1, current_schema())
              AND cols.table_name = $2
            ORDER BY cols.ordinal_position
        `,
        {
            database,
            params: [parsed.schema, parsed.name],
        },
    );

    return Array.isArray(result.rows) ? result.rows : [];
}

async function getDatabaseTablesDetail(datasource: PostgresDatasource, database: string): Promise<DatabaseObjectRow[]> {
    const result = await datasource.queryWithContext<ObjectRow>(
        `
            SELECT
                n.nspname AS "schemaName",
                c.relname AS name,
                c.relkind AS relkind,
                pg_total_relation_size(c.oid) AS "totalBytes",
                COALESCE(s.n_live_tup, c.reltuples) AS "totalRows",
                obj_description(c.oid, 'pg_class') AS comment,
                GREATEST(s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze) AS "lastModified"
            FROM pg_class c
            JOIN pg_namespace n
              ON n.oid = c.relnamespace
            LEFT JOIN pg_stat_user_tables s
              ON s.relid = c.oid
            WHERE ${SYSTEM_SCHEMA_FILTER}
              AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
            ORDER BY n.nspname, c.relname
        `,
        { database },
    );

    return result.rows
        .map(normalizeObjectRow)
        .filter((row): row is DatabaseObjectRow => Boolean(row));
}

async function getTablesOnly(datasource: PostgresDatasource, database: string): Promise<DatabaseObjectRow[]> {
    const rows = await getDatabaseTablesDetail(datasource, database);
    return rows.filter(row => isTableLike(row.engine));
}

async function getViews(datasource: PostgresDatasource, database: string): Promise<DatabaseObjectRow[]> {
    const rows = await getDatabaseTablesDetail(datasource, database);
    return rows.filter(row => row.engine === 'view');
}

async function getMaterializedViews(datasource: PostgresDatasource, database: string): Promise<DatabaseObjectRow[]> {
    const rows = await getDatabaseTablesDetail(datasource, database);
    return rows.filter(row => row.engine === 'materialized_view');
}

async function getFunctions(datasource: PostgresDatasource, database?: string) {
    const result = await datasource.queryWithContext<FunctionRow>(
        `
            SELECT
                n.nspname AS "schemaName",
                p.proname AS name
            FROM pg_proc p
            JOIN pg_namespace n
              ON n.oid = p.pronamespace
            WHERE ${SYSTEM_SCHEMA_FILTER}
            ORDER BY n.nspname, p.proname
        `,
        { database },
    );

    return result.rows
        .map(row => {
            const name = qualifyName(row.schemaName, row.name);
            if (!name) return null;
            return { label: name, value: name };
        })
        .filter((row): row is DatabaseFunctionMeta => Boolean(row));
}

async function getDatabaseSummary(datasource: PostgresDatasource, options: DatabaseSummaryOptions): Promise<DatabaseSummary> {
    const rows = await getDatabaseTablesDetail(datasource, options.database);
    const tables = rows.filter(row => isTableLike(row.engine));
    const views = rows.filter(row => row.engine === 'view');
    const materializedViews = rows.filter(row => row.engine === 'materialized_view');
    const recentTables = [...rows]
        .sort((a, b) => {
            const left = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const right = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return right - left;
        })
        .slice(0, 5)
        .map(row => ({
            name: row.name,
            lastUpdatedAt: row.lastModified ?? null,
        }));

    const topTablesByBytes = [...tables]
        .sort((a, b) => (b.totalBytes ?? 0) - (a.totalBytes ?? 0))
        .slice(0, 5)
        .map(row => ({
            name: row.name,
            bytes: row.totalBytes ?? null,
            rowsEstimate: row.totalRows ?? null,
            comment: row.comment ?? null,
        }));

    const topTablesByRows = [...tables]
        .sort((a, b) => (b.totalRows ?? 0) - (a.totalRows ?? 0))
        .slice(0, 5)
        .map(row => ({
            name: row.name,
            bytes: row.totalBytes ?? null,
            rowsEstimate: row.totalRows ?? null,
            comment: row.comment ?? null,
        }));

    const lastUpdatedAt = recentTables[0]?.lastUpdatedAt ?? null;

    return {
        databaseName: options.database,
        catalogName: options.catalogName ?? null,
        schemaName: options.schemaName ?? null,
        engine: options.engine ?? 'postgres',
        cluster: options.cluster ?? null,
        tablesCount: tables.length,
        viewsCount: views.length,
        materializedViewsCount: materializedViews.length,
        totalBytes: tables.reduce<number>((sum, row) => sum + (row.totalBytes ?? 0), 0),
        totalRowsEstimate: tables.reduce<number>((sum, row) => sum + (row.totalRows ?? 0), 0),
        lastUpdatedAt,
        lastQueriedAt: null,
        topTablesByBytes,
        topTablesByRows,
        recentTables,
        oneLineSummary: null,
    };
}

export function createPostgresMetadataCapability(datasource: PostgresDatasource): PostgresMetadataAPI {
    return {
        getDatabases: () => getDatabases(datasource),
        getTables: database => getTables(datasource, database),
        getSchema: database => getSchema(datasource, database),
        getTableColumns: (database, table) => getTableColumns(datasource, database, table),
        getTablesOnly: database => getTablesOnly(datasource, database),
        getViews: database => getViews(datasource, database),
        getMaterializedViews: database => getMaterializedViews(datasource, database),
        getFunctions: database => getFunctions(datasource, database),
        getDatabaseSummary: options => getDatabaseSummary(datasource, options),
        getDatabaseTablesDetail: database => getDatabaseTablesDetail(datasource, database),
    };
}
