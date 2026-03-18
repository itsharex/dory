'use client';

import type { ExplorerResource } from '@/lib/explorer/types';
import { getExplorerDriver } from '@/components/explorer/drivers';
import { useExplorerConnectionContext } from '@/components/explorer/core/explorer-store';

export function useTable(resource: Extract<ExplorerResource, { kind: 'object' }>) {
    const { connectionId, connectionType } = useExplorerConnectionContext();
    const driver = getExplorerDriver(connectionType);

    return {
        connectionId,
        driver,
        database: resource.database,
        tableName: driver.table.getQualifiedName(resource),
    };
}
