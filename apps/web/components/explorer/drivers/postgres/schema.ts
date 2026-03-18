import type { ExplorerListKind } from '@/lib/explorer/types';
import type { ExplorerSchemaDriver } from '../types';

const ENDPOINTS: Partial<Record<ExplorerListKind, string>> = {
    schemas: 'schemas',
    tables: 'tables',
    views: 'views',
    materializedViews: 'materialized-views',
    functions: 'functions',
    sequences: 'sequences',
};

export const postgresSchemaDriver: ExplorerSchemaDriver = {
    getListEndpoint(listKind: ExplorerListKind) {
        return ENDPOINTS[listKind] ?? null;
    },
};
