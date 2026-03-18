import type { ComponentType } from 'react';
import type { ExplorerBaseParams, ExplorerResource } from '@/lib/explorer/types';

export type NamespaceViewComponent = ComponentType<{
    baseParams: ExplorerBaseParams;
    catalog: string;
    resource: Extract<ExplorerResource, { kind: 'database' | 'list' }>;
}>;

export type SchemaViewComponent = ComponentType<{
    baseParams: ExplorerBaseParams;
    catalog: string;
    resource: Extract<ExplorerResource, { kind: 'schema' | 'list' }>;
}>;

export type ObjectViewComponent = ComponentType<{
    catalog: string;
    resource: Extract<ExplorerResource, { kind: 'object' }>;
}>;

export type ExplorerViewRegistry = {
    namespace: NamespaceViewComponent;
    schema: SchemaViewComponent;
    object: ObjectViewComponent;
};
