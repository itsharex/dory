import { QueryInsightsFilters, QueryInsightsSummary, QueryTimelinePoint, QueryInsightsRow } from '@/types/monitoring';
import { TablePropertiesRow, TableStats } from '@/types/table-info';

export type ConnectionType = 'clickhouse' | 'postgres';

export interface BaseConfig {
    id: string; // datasource_id
    type: ConnectionType;
    host: string;
    port?: number | string;
    username?: string;
    password?: string;
    database?: string; // Default database
    options?: Record<string, any>; // Extra driver options (TLS, schema, account, settings)
    configVersion?: string | number; // ✅ Optional: version awareness
    updatedAt?: string | number; // ✅ Optional: version awareness
}

export type ColumnMeta = {
    name: string;
    type?: string;
};

export type QueryContext = {
    database?: string;
    schema?: string;
    queryId?: string;
    statementTimeoutMs?: number;
};

export interface QueryResult<Row = any> {
    rows: Row[];
    rowCount?: number;
    limited?: boolean;
    limit?: number;
    columns?: ColumnMeta[];
    tookMs?: number;
    statistics?: Record<string, unknown>;
}

export interface HealthInfo {
    ok: boolean;
    message?: string;
    tookMs?: number;
}

export interface DatabaseMeta {
    label: string;
    value: string;
}

export interface TableMeta {
    label: string;
    value: string;
    database?: string;
}

export type Pagination = {
    pageIndex: number;
    pageSize: number;
};

export type QueryInsightsImpl = {
    summary: (filters: QueryInsightsFilters) => Promise<QueryInsightsSummary>;
    timeline: (filters: QueryInsightsFilters) => Promise<QueryTimelinePoint[]>;
    queryLogs: (
        filters: QueryInsightsFilters,
        pagination?: Pagination,
    ) => Promise<{ rows: QueryInsightsRow[]; total: number }>;
    recentQueries: (filters: QueryInsightsFilters, options?: { limit?: number }) => Promise<QueryInsightsRow[]>;
    slowQueries: (
        filters: QueryInsightsFilters,
        pagination?: Pagination,
    ) => Promise<{ rows: QueryInsightsRow[]; total: number }>;
    errorQueries: (
        filters: QueryInsightsFilters,
        pagination?: Pagination,
    ) => Promise<{ rows: QueryInsightsRow[]; total: number }>;
};

export type QueryInsightsAPI = QueryInsightsImpl;
export type GetTableInfoAPI = {
    properties: (database: string, table: string) => Promise<TablePropertiesRow | null>;
    ddl: (database: string, table: string) => Promise<string | null>;
    stats: (database: string, table: string) => Promise<TableStats | null>;
};

export type ConnectionMetadataAPI = {
    getDatabases: () => Promise<DatabaseMeta[]>;
    getTables: (database?: string) => Promise<TableMeta[]>;
};

export type ConnectionCapabilities = {
    metadata?: ConnectionMetadataAPI;
    queryInsights?: QueryInsightsAPI;
    tableInfo?: GetTableInfoAPI;
    privileges?: Record<string, unknown>;
};
