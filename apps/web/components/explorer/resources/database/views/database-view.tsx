'use client';

import { useTranslations } from 'next-intl';
import DatabaseSummary from '@/components/explorer/resources/database/components/database-summary';
import type { ExplorerBaseParams, ExplorerListKind, ExplorerResource } from '@/lib/explorer/types';
import { ExtensionsTab } from '../tabs/extensions-tab';
import { SchemasTab } from '../tabs/schemas-tab';
import { SearchResourceTab } from '@/components/explorer/resources/search/tabs/search-tab';
import { ExplorerTabsShell, type ExplorerTab } from '@/components/explorer/resources/shared/components/explorer-tabs-shell';

type DatabaseTab = 'summary' | 'schemas' | 'search' | 'extensions';

type DatabaseViewProps = {
    baseParams: ExplorerBaseParams;
    catalog: string;
    resource: Extract<ExplorerResource, { kind: 'database' | 'list' }>;
};

function resolveInitialTab(resource: Extract<ExplorerResource, { kind: 'database' | 'list' }>): DatabaseTab {
    if (resource.kind !== 'list') return 'summary';

    const map: Partial<Record<ExplorerListKind, DatabaseTab>> = {
        schemas: 'schemas',
        tables: 'search',
        views: 'search',
        materializedViews: 'search',
        functions: 'search',
        sequences: 'search',
    };

    return map[resource.listKind] ?? 'summary';
}

export function DatabaseResourceView({ baseParams, catalog, resource }: DatabaseViewProps) {
    const t = useTranslations('PostgresExplorer');
    const initialTab = resolveInitialTab(resource);
    const tabs: ExplorerTab<DatabaseTab>[] = [
        {
            value: 'summary',
            label: t('Tabs.summary'),
            content: <DatabaseSummary catalog={catalog} database={resource.database} />,
        },
        {
            value: 'schemas',
            label: t('Tabs.schemas'),
            content: (
                <SchemasTab
                    baseParams={baseParams}
                    database={resource.database}
                    searchPlaceholder={t('Schemas.SearchPlaceholder')}
                    emptyText={t('Schemas.Empty')}
                    filteredEmptyText={t('Schemas.FilteredEmpty')}
                />
            ),
        },
        {
            value: 'search',
            label: t('Tabs.search'),
            content: (
                <SearchResourceTab
                    baseParams={baseParams}
                    database={resource.database}
                    placeholder={t('Search.Placeholder')}
                    emptyText={t('Search.Empty')}
                />
            ),
        },
        {
            value: 'extensions',
            label: t('Tabs.extensions'),
            content: (
                <ExtensionsTab
                    database={resource.database}
                    searchPlaceholder={t('Extensions.SearchPlaceholder')}
                    emptyText={t('Extensions.Empty')}
                    filteredEmptyText={t('Extensions.FilteredEmpty')}
                />
            ),
        },
    ];

    return (
        <ExplorerTabsShell
            initialTab={initialTab}
            tabs={tabs}
            resetKey={`${resource.database}:${resource.kind === 'list' ? resource.listKind : 'summary'}`}
        />
    );
}
