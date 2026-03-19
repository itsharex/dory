import type { ExplorerResource } from '../types';

export function resolvePostgresExplorerResource(resource?: ExplorerResource): ExplorerResource | undefined {
    if (resource?.kind === 'object' && !resource.schema) {
        const [schema, ...rest] = resource.name.split('.');
        if (schema && rest.length > 0) {
            return {
                ...resource,
                schema,
                name: rest.join('.'),
            };
        }
    }

    return resource;
}
