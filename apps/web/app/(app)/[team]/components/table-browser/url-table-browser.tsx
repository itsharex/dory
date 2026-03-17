'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/registry/new-york-v4/ui/card';
import { useTranslations } from 'next-intl';
import { TableViewTabs, type TableSubTab } from './table-view-tabs';

type UrlTableBrowserProps = {
    catalog?: string;
    databaseName?: string;
    tableName?: string;
    initialTab?: TableSubTab;
};

export default function UrlTableBrowser({ catalog, databaseName, tableName, initialTab = 'overview' }: UrlTableBrowserProps) {
    const [currentTab, setCurrentTab] = useState<TableSubTab>(initialTab);
    const t = useTranslations('TableBrowser');

    useEffect(() => {
        setCurrentTab(initialTab);
    }, [catalog, databaseName, initialTab, tableName]);

    if (!databaseName || !tableName) {
        return (
            <Card className="m-6">
                <CardContent className="text-sm text-muted-foreground">{t('Select table to browse schema')}</CardContent>
            </Card>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col">
            <TableViewTabs
                databaseName={databaseName}
                tableName={tableName}
                activeSubTab={currentTab}
                onSubTabChange={value => setCurrentTab(value)}
            />
        </div>
    );
}
