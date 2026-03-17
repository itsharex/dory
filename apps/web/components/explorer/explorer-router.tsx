'use client';

import { buildExplorerBreadcrumbs, getExplorerHeaderBadgeLabel } from '@/lib/explorer/routing';
import type { ExplorerBaseParams, ExplorerResolvedRoute } from '@/lib/explorer/types';
import { ExplorerHeader } from './explorer-header';
import { ObjectNotFound } from './object-not-found';
import { NamespaceView } from './views/namespace-view';
import { ObjectView } from './views/object-view';
import { RootView } from './views/root-view';
import { SchemaSummaryView } from './views/schema-summary-view';

type ExplorerRouterProps = {
    baseParams: ExplorerBaseParams;
    route: ExplorerResolvedRoute;
};

export function ExplorerRouter({ baseParams, route }: ExplorerRouterProps) {
    const paramsWithCatalog = {
        ...baseParams,
        catalog: route.catalog,
    };
    const breadcrumbs = buildExplorerBreadcrumbs(paramsWithCatalog, route.resource);
    const badgeLabel = getExplorerHeaderBadgeLabel(route.resource);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <ExplorerHeader breadcrumbs={breadcrumbs} badgeLabel={badgeLabel} />
            <div className="min-h-0 flex-1 overflow-auto">
                {route.pageType === 'root' ? <RootView team={baseParams.team} connectionId={baseParams.connectionId} catalog={route.catalog} /> : null}
                {route.pageType === 'namespace' && route.resource ? (
                    <NamespaceView catalog={route.catalog} resource={route.resource as Extract<typeof route.resource, { kind: 'database' | 'list' }>} />
                ) : null}
                {route.pageType === 'schemaSummary' && route.resource ? (
                    <SchemaSummaryView baseParams={paramsWithCatalog} resource={route.resource as Extract<typeof route.resource, { kind: 'schema' | 'list' }>} />
                ) : null}
                {route.pageType === 'object' && route.resource ? (
                    <ObjectView catalog={route.catalog} resource={route.resource as Extract<typeof route.resource, { kind: 'object' }>} />
                ) : null}
                {route.pageType === 'notFound' ? <ObjectNotFound /> : null}
            </div>
        </div>
    );
}
