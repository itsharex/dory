'use client';

import { buildExplorerBreadcrumbs, getExplorerHeaderBadgeLabel } from '@/lib/explorer/routing';
import type { ExplorerBaseParams, ExplorerResolvedRoute } from '@/lib/explorer/types';
import { ExplorerHeader } from './explorer-header';
import { ObjectNotFound } from './object-not-found';
import { getExplorerViewRegistry } from './core/view-registry';
import { RootView } from './resources/database/views/root-view';

type ExplorerRouterProps = {
    baseParams: ExplorerBaseParams;
    route: ExplorerResolvedRoute;
};

export function ExplorerRouter({ baseParams, route }: ExplorerRouterProps) {
    const paramsWithCatalog = {
        ...baseParams,
        catalog: route.catalog,
    };
    const routeKey = `${route.pageType}:${route.normalizedSlug.join('/')}`;
    const breadcrumbs = buildExplorerBreadcrumbs(paramsWithCatalog, route.resource);
    const badgeLabel = getExplorerHeaderBadgeLabel(route.resource);
    const views = getExplorerViewRegistry(route);
    const NamespaceComponent = views.namespace;
    const SchemaComponent = views.schema;
    const ObjectComponent = views.object;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <ExplorerHeader breadcrumbs={breadcrumbs} badgeLabel={badgeLabel} />
            <div className="min-h-0 flex-1 overflow-auto">
                {route.pageType === 'root' ? <RootView organization={baseParams.organization} connectionId={baseParams.connectionId} catalog={route.catalog} /> : null}
                {route.pageType === 'namespace' && route.resource ? (
                    <NamespaceComponent
                        key={routeKey}
                        baseParams={paramsWithCatalog}
                        catalog={route.catalog}
                        resource={route.resource as Extract<typeof route.resource, { kind: 'database' | 'list' }>}
                    />
                ) : null}
                {route.pageType === 'schemaSummary' && route.resource ? (
                    <SchemaComponent
                        key={routeKey}
                        baseParams={paramsWithCatalog}
                        catalog={route.catalog}
                        resource={route.resource as Extract<typeof route.resource, { kind: 'schema' | 'list' }>}
                    />
                ) : null}
                {route.pageType === 'object' && route.resource ? (
                    <ObjectComponent
                        key={routeKey}
                        catalog={route.catalog}
                        resource={route.resource as Extract<typeof route.resource, { kind: 'object' }>}
                    />
                ) : null}
                {route.pageType === 'notFound' ? <ObjectNotFound /> : null}
            </div>
        </div>
    );
}
