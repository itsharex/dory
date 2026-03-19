import { resolveExplorerDriver } from '@/lib/explorer/capabilities';
import type { ExplorerDriver } from '@/lib/explorer/types';
import { clickhouseExplorerDriver } from './clickhouse';
import { mysqlExplorerDriver } from './mysql';
import { postgresExplorerDriver } from './postgres';
import { noopSchemaDriver } from './shared';
import type { ExplorerDriverModule } from './types';

const DRIVERS: Partial<Record<ExplorerDriver, ExplorerDriverModule>> = {
    postgres: postgresExplorerDriver,
    clickhouse: clickhouseExplorerDriver,
    mysql: mysqlExplorerDriver,
};

function createFallbackDriver(driver: ExplorerDriver): ExplorerDriverModule {
    return {
        id: driver,
        views: {},
        table: {
            getTableBrowserDriver: () => driver,
            getQualifiedName: resource => (resource.schema ? `${resource.schema}.${resource.name}` : resource.name),
            getTableIndexes: resource => ({
                database: resource.database,
                table: resource.schema ? `${resource.schema}.${resource.name}` : resource.name,
            }),
        },
        schema: noopSchemaDriver,
    };
}

export function getExplorerDriver(driver?: string | null): ExplorerDriverModule {
    const resolved = resolveExplorerDriver(driver);
    return DRIVERS[resolved] ?? createFallbackDriver(resolved);
}
