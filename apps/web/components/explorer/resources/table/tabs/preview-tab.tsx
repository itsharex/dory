'use client';

import type { ExplorerResource } from '@/lib/explorer/types';
import { TablePreview } from '../components/table-preview';
import { useTable } from '../hooks/use-table';

type PreviewTabProps = {
    resource: Extract<ExplorerResource, { kind: 'object' }>;
};

export function PreviewTab({ resource }: PreviewTabProps) {
    const { connectionId, database, tableName } = useTable(resource);

    return <TablePreview connectionId={connectionId} database={database} table={tableName} />;
}
