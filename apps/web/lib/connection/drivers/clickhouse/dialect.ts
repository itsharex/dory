import type { DatasourceDialect } from '@/lib/connection/registry/types';

export const ClickhouseDialect: DatasourceDialect = {
    id: 'clickhouse',
    parameterStyle: 'named',
    supports: {
        queryCancellation: true,
        queryInsights: true,
        tableInfo: true,
    },
};
