import type { ExplorerResource } from '../types';

export function resolveMysqlExplorerResource(resource?: ExplorerResource): ExplorerResource | undefined {
    if (!resource) return resource;

    if (resource.kind === 'schema') {
        return {
            kind: 'database',
            database: resource.database,
        };
    }

    if (resource.kind === 'list' || resource.kind === 'object') {
        return {
            ...resource,
            schema: undefined,
        };
    }

    return resource;
}
