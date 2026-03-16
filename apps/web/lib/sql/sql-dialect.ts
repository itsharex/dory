import type { ConnectionDialect } from '@/types';
import type { ConnectionType } from '@/types/connections';
import type { SqlLanguage } from 'sql-formatter';

export type SqlDialectParser = {
    getSuggestionAtCaretPosition?: (sql: string, caretPos: { lineNumber: number; column: number }) => unknown;
    getAllEntities?: (sql: string, caretPos?: { lineNumber: number; column: number }) => any[] | null;
};

type SqlParserKey = 'mysql' | 'postgres';

export interface SqlDialectConfig {
    dialect: ConnectionDialect;
    parserKey: SqlParserKey;
    monacoLanguageId: string;
    formatterLanguage: SqlLanguage;
}

const SQL_DIALECT_CONFIGS: Record<ConnectionDialect, SqlDialectConfig> = {
    clickhouse: {
        dialect: 'clickhouse',
        parserKey: 'mysql',
        monacoLanguageId: 'mysql',
        formatterLanguage: 'clickhouse',
    },
    duckdb: {
        dialect: 'duckdb',
        parserKey: 'mysql',
        monacoLanguageId: 'mysql',
        formatterLanguage: 'duckdb',
    },
    mysql: {
        dialect: 'mysql',
        parserKey: 'mysql',
        monacoLanguageId: 'mysql',
        formatterLanguage: 'mysql',
    },
    postgres: {
        dialect: 'postgres',
        parserKey: 'postgres',
        monacoLanguageId: 'pgsql',
        formatterLanguage: 'postgresql',
    },
    unknown: {
        dialect: 'unknown',
        parserKey: 'mysql',
        monacoLanguageId: 'mysql',
        formatterLanguage: 'sql',
    },
};

const SQL_DIALECT_BY_CONNECTION_TYPE: Partial<Record<ConnectionType, ConnectionDialect>> = {
    clickhouse: 'clickhouse',
    mysql: 'mysql',
    postgres: 'postgres',
};

const parserCache = new Map<SqlParserKey, Promise<SqlDialectParser>>();

const createParser = async (parserKey: SqlParserKey): Promise<SqlDialectParser> => {
    const dt = await import('dt-sql-parser');

    if (parserKey === 'postgres') {
        return new dt.PostgreSQL();
    }

    return new dt.MySQL();
};

export const normalizeSqlDialect = (value?: string | null): ConnectionDialect => {
    switch ((value ?? '').toLowerCase()) {
        case 'clickhouse':
            return 'clickhouse';
        case 'duckdb':
            return 'duckdb';
        case 'mysql':
            return 'mysql';
        case 'postgres':
        case 'postgresql':
            return 'postgres';
        default:
            return 'unknown';
    }
};

export const getSqlDialectConfig = (dialect?: ConnectionDialect): SqlDialectConfig => {
    return SQL_DIALECT_CONFIGS[dialect ?? 'unknown'] ?? SQL_DIALECT_CONFIGS.unknown;
};

export const getSqlDialectConfigForConnectionType = (connectionType?: ConnectionType): SqlDialectConfig => {
    const dialect = connectionType ? SQL_DIALECT_BY_CONNECTION_TYPE[connectionType] : undefined;
    return getSqlDialectConfig(dialect ?? 'unknown');
};

export const getSqlDialectParser = async (dialect?: ConnectionDialect): Promise<SqlDialectParser> => {
    const config = getSqlDialectConfig(dialect);
    const cached = parserCache.get(config.parserKey);
    if (cached) return cached;

    const parserPromise = createParser(config.parserKey);
    parserCache.set(config.parserKey, parserPromise);
    return parserPromise;
};
