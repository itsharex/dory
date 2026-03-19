'use client';

import type { ExplorerResource } from '@/lib/explorer/types';
import { TableIndexes } from '../components/table-indexes';

type IndexesTabProps = {
    resource: Extract<ExplorerResource, { kind: 'object' }>;
};

export function IndexesTab({ resource }: IndexesTabProps) {
    return <TableIndexes resource={resource} />;
}
