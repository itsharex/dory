import type { ExplorerObjectResource } from '@/lib/explorer/types';
import type { ExplorerTableDriver } from '../types';

function getQualifiedName(resource: ExplorerObjectResource): string {
    return resource.schema ? `${resource.schema}.${resource.name}` : resource.name;
}

export const clickhouseTableDriver: ExplorerTableDriver = {
    getTableBrowserDriver: () => 'clickhouse',
    getQualifiedName,
    getTableIndexes: resource => ({
        database: resource.database,
        table: getQualifiedName(resource),
    }),
};
