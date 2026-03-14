import type { BaseConfig, ConnectionType } from '../base/types';
import type { BaseConnection } from '../base/base-connection';

export type DataSourceType = ConnectionType;

export type DatasourceDialect = {
    id: DataSourceType;
    parameterStyle: 'named' | 'positional';
    supports: {
        queryCancellation: boolean;
        queryInsights: boolean;
        tableInfo: boolean;
    };
};

export type DatasourceCtor = new (config: BaseConfig) => BaseConnection;

export function isDatasourceType(value: unknown): value is DataSourceType {
    return value === 'clickhouse' || value === 'postgres';
}
