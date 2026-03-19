'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/new-york-v4/ui/card';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { buildExplorerListPath } from '@/lib/explorer/build-path';
import { formatListKindLabel } from '@/lib/explorer/routing';
import type { ExplorerBaseParams, ExplorerListKind, ExplorerResource } from '@/lib/explorer/types';

type FallbackSchemaViewProps = {
    baseParams: ExplorerBaseParams;
    resource: Extract<ExplorerResource, { kind: 'schema' | 'list' }>;
};

const SCHEMA_LISTS: ExplorerListKind[] = ['tables', 'views', 'materializedViews', 'functions', 'sequences'];

export function FallbackSchemaView({ baseParams, resource }: FallbackSchemaViewProps) {
    const activeList = resource.kind === 'list' ? resource.listKind : null;
    const schemaName = resource.schema;

    return (
        <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold">{schemaName}</h1>
                {activeList ? <Badge variant="outline">{formatListKindLabel(activeList)}</Badge> : null}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Schema explorer</CardTitle>
                    <CardDescription>
                        Use explicit schema routes for schema-scoped lists, and keep object selection aligned with driver capabilities.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {SCHEMA_LISTS.map(listKind => (
                        <Link
                            key={listKind}
                            href={buildExplorerListPath(baseParams, {
                                database: resource.database,
                                schema: schemaName,
                                listKind,
                            })}
                            className="block"
                        >
                            <div className="rounded-lg border p-4 transition-colors hover:bg-muted/40">
                                <div className="text-sm font-medium">{formatListKindLabel(listKind)}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Open {formatListKindLabel(listKind).toLowerCase()} within this schema.
                                </div>
                            </div>
                        </Link>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
