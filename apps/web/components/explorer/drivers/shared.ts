import type { ExplorerListKind } from '@/lib/explorer/types';
import type { ExplorerSchemaDriver } from './types';

export const noopSchemaDriver: ExplorerSchemaDriver = {
    getListEndpoint(_listKind: ExplorerListKind) {
        return null;
    },
};
