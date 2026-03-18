'use client';

import { Activity, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/registry/new-york-v4/ui/tabs';
import DatabaseSummary from '../components/database-summary';
import DatabaseTables from '../tabs/tables-tab';
import DatabaseViews from '../tabs/views-tab';
import DatabaseMaterializedViews from '../tabs/materialized-views-tab';
import type { ExplorerListKind, ExplorerResource } from '@/lib/explorer/types';

type SubTab = 'summary' | 'tables' | 'views' | 'materialized-views';

const SUB_TABS: SubTab[] = ['summary', 'tables', 'views', 'materialized-views'];

function resolveInitialTab(resource: Extract<ExplorerResource, { kind: 'database' | 'list' }>): SubTab {
    if (resource.kind !== 'list' || resource.schema) return 'summary';

    const map: Partial<Record<ExplorerListKind, SubTab>> = {
        tables: 'tables',
        views: 'views',
        materializedViews: 'materialized-views',
    };

    return map[resource.listKind] ?? 'summary';
}

type FallbackDatabaseViewProps = {
    catalog: string;
    resource: Extract<ExplorerResource, { kind: 'database' | 'list' }>;
};

export function FallbackDatabaseView({ catalog, resource }: FallbackDatabaseViewProps) {
    const [currentTab, setCurrentTab] = useState<SubTab>(() => resolveInitialTab(resource));
    const t = useTranslations('Catalog');

    useEffect(() => {
        setCurrentTab(resolveInitialTab(resource));
    }, [resource]);

    return (
        <div className="p-6 h-full flex flex-col">
            <Tabs value={currentTab} onValueChange={value => setCurrentTab(value as SubTab)} className="flex flex-col h-full">
                <TabsList className="justify-start">
                    {SUB_TABS.map(tab => (
                        <TabsTrigger key={tab} value={tab} className="cursor-pointer">
                            {t(`Tabs.${tab}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <div className="mt-1 flex-1 min-h-0">
                    <TabsContent value="summary" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                        <Activity mode={currentTab === 'summary' ? 'visible' : 'hidden'}>
                            <DatabaseSummary catalog={catalog} database={resource.database} />
                        </Activity>
                    </TabsContent>
                    <TabsContent value="tables" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                        <Activity mode={currentTab === 'tables' ? 'visible' : 'hidden'}>
                            <DatabaseTables />
                        </Activity>
                    </TabsContent>
                    <TabsContent value="views" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                        <Activity mode={currentTab === 'views' ? 'visible' : 'hidden'}>
                            <DatabaseViews />
                        </Activity>
                    </TabsContent>
                    <TabsContent value="materialized-views" className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                        <Activity mode={currentTab === 'materialized-views' ? 'visible' : 'hidden'}>
                            <DatabaseMaterializedViews />
                        </Activity>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
