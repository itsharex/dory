'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/registry/new-york-v4/ui/tabs';

export type ExplorerTab<Value extends string> = {
    value: Value;
    label: string;
    content: ReactNode;
};

type ExplorerTabsShellProps<Value extends string> = {
    initialTab: Value;
    tabs: ExplorerTab<Value>[];
    resetKey: string;
};

export function ExplorerTabsShell<Value extends string>({ initialTab, tabs, resetKey }: ExplorerTabsShellProps<Value>) {
    const [currentTab, setCurrentTab] = useState<Value>(initialTab);

    useEffect(() => {
        setCurrentTab(initialTab);
    }, [initialTab, resetKey]);

    return (
        <div className="p-6 h-full flex flex-col">
            <Tabs value={currentTab} onValueChange={value => setCurrentTab(value as Value)} className="flex h-full flex-col">
                <TabsList className="justify-start">
                    {tabs.map(tab => (
                        <TabsTrigger key={tab.value} value={tab.value} className="cursor-pointer">
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <div className="mt-1 flex-1 min-h-0">
                    {tabs.map(tab => (
                        <TabsContent key={tab.value} value={tab.value} className="h-full mt-0 data-[state=inactive]:hidden" forceMount>
                            {tab.content}
                        </TabsContent>
                    ))}
                </div>
            </Tabs>
        </div>
    );
}
