'use client';

import { Activity, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/registry/new-york-v4/ui/tabs';
import { getDriverCapabilities, supportsDatabaseSummary } from '@/lib/explorer/capabilities';
import { currentConnectionAtom } from '@/shared/stores/app.store';
import DatabaseSummary from '../components/database-summary';
import DatabaseTables from '../tabs/tables-tab';
import DatabaseViews from '../tabs/views-tab';
import DatabaseMaterializedViews from '../tabs/materialized-views-tab';
import type { ExplorerListKind, ExplorerResource } from '@/lib/explorer/types';

type SubTab = 'summary' | 'tables' | 'views' | 'materialized-views';

function getAvailableTabs(driver?: string | null): SubTab[] {
    const capabilities = getDriverCapabilities(driver);
    const tabs: SubTab[] = [];

    if (supportsDatabaseSummary(driver)) {
        tabs.push('summary');
    }

    if (capabilities.listKinds.includes('tables')) {
        tabs.push('tables');
    }

    if (capabilities.listKinds.includes('views')) {
        tabs.push('views');
    }

    if (capabilities.listKinds.includes('materializedViews')) {
        tabs.push('materialized-views');
    }

    return tabs;
}

function resolveInitialTab(resource: Extract<ExplorerResource, { kind: 'database' | 'list' }>, availableTabs: SubTab[]): SubTab {
    const fallbackTab = availableTabs[0] ?? 'tables';

    if (resource.kind !== 'list' || resource.schema) {
        return availableTabs.includes('summary') ? 'summary' : fallbackTab;
    }

    const map: Partial<Record<ExplorerListKind, SubTab>> = {
        tables: 'tables',
        views: 'views',
        materializedViews: 'materialized-views',
    };

    const resolvedTab = map[resource.listKind];

    if (resolvedTab && availableTabs.includes(resolvedTab)) {
        return resolvedTab;
    }

    return fallbackTab;
}

type FallbackDatabaseViewProps = {
    catalog: string;
    resource: Extract<ExplorerResource, { kind: 'database' | 'list' }>;
};

export function FallbackDatabaseView({ catalog, resource }: FallbackDatabaseViewProps) {
    const currentConnection = useAtomValue(currentConnectionAtom);
    const t = useTranslations('Catalog');
    const availableTabs = useMemo(() => getAvailableTabs(currentConnection?.connection?.type), [currentConnection?.connection?.type]);
    const [currentTab, setCurrentTab] = useState<SubTab>(() => resolveInitialTab(resource, availableTabs));

    useEffect(() => {
        setCurrentTab(resolveInitialTab(resource, availableTabs));
    }, [availableTabs, resource]);

    return (
        <div className="p-6 h-full flex flex-col">
            <Tabs value={currentTab} onValueChange={value => setCurrentTab(value as SubTab)} className="flex flex-col h-full">
                <TabsList className="justify-start">
                    {availableTabs.map(tab => (
                        <TabsTrigger key={tab} value={tab} className="cursor-pointer">
                            {t(`Tabs.${tab}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <div className="mt-1 flex-1 min-h-0">
                    {availableTabs.includes('summary') ? (
                        <TabsContent value="summary" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                            <Activity mode={currentTab === 'summary' ? 'visible' : 'hidden'}>
                                <DatabaseSummary catalog={catalog} database={resource.database} />
                            </Activity>
                        </TabsContent>
                    ) : null}
                    {availableTabs.includes('tables') ? (
                        <TabsContent value="tables" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                            <Activity mode={currentTab === 'tables' ? 'visible' : 'hidden'}>
                                <DatabaseTables catalog={catalog} database={resource.database} />
                            </Activity>
                        </TabsContent>
                    ) : null}
                    {availableTabs.includes('views') ? (
                        <TabsContent value="views" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                            <Activity mode={currentTab === 'views' ? 'visible' : 'hidden'}>
                                <DatabaseViews database={resource.database} />
                            </Activity>
                        </TabsContent>
                    ) : null}
                    {availableTabs.includes('materialized-views') ? (
                        <TabsContent value="materialized-views" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                            <Activity mode={currentTab === 'materialized-views' ? 'visible' : 'hidden'}>
                                <DatabaseMaterializedViews database={resource.database} />
                            </Activity>
                        </TabsContent>
                    ) : null}
                </div>
            </Tabs>
        </div>
    );
}
