'use client';

import { TableOverview } from '@/app/(app)/[team]/components/table-browser/components/overview';
import TableStats from '@/app/(app)/[team]/components/table-browser/components/stats';
import TableStructure from '@/app/(app)/[team]/components/table-browser/components/structure';
import { UrlDataPreview } from '@/app/(app)/[team]/components/table-browser/components/data-preview';
import type { ExplorerResource } from '@/lib/explorer/types';
import { useTranslations } from 'next-intl';
import { PostgresTabsShell, type PostgresExplorerTab } from './postgres-tabs-shell';
import { PostgresTableIndexesTab } from './postgres-table-indexes-tab';

type TableTab = 'overview' | 'data' | 'structure' | 'stats' | 'indexes';

type PostgresTableViewProps = {
    catalog: string;
    resource: Extract<ExplorerResource, { kind: 'object' }>;
};

export function PostgresTableView({ catalog, resource }: PostgresTableViewProps) {
    const t = useTranslations('PostgresExplorer');
    const qualifiedName = resource.schema ? `${resource.schema}.${resource.name}` : resource.name;
    const tabs: PostgresExplorerTab<TableTab>[] = [
        {
            value: 'overview',
            label: t('Tabs.overview'),
            content: <TableOverview databaseName={resource.database} tableName={qualifiedName} />,
        },
        {
            value: 'data',
            label: t('Tabs.data'),
            content: <UrlDataPreview />,
        },
        {
            value: 'structure',
            label: t('Tabs.structure'),
            content: <TableStructure databaseName={resource.database} tableName={qualifiedName} />,
        },
        {
            value: 'stats',
            label: t('Tabs.stats'),
            content: <TableStats databaseName={resource.database} tableName={qualifiedName} />,
        },
        {
            value: 'indexes',
            label: t('Tabs.indexes'),
            content: <PostgresTableIndexesTab database={resource.database} table={qualifiedName} emptyText={t('Indexes.Empty')} />,
        },
    ];

    return <PostgresTabsShell initialTab="overview" tabs={tabs} resetKey={`${resource.database}:${qualifiedName}`} />;
}
