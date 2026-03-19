'use client';

import type { ExplorerResource } from '@/lib/explorer/types';
import { TableColumns } from '../components/table-columns';
import { useTable } from '../hooks/use-table';

type ColumnsTabProps = {
    resource: Extract<ExplorerResource, { kind: 'object' }>;
};

export function ColumnsTab({ resource }: ColumnsTabProps) {
    const { database, tableName } = useTable(resource);
    return <TableColumns database={database} table={tableName} />;
}
